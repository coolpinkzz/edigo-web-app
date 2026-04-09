import Joi from "joi";
import { ATTENDANCE_STATUSES } from "./attendance.model";
import {
  STUDENT_CLASSES,
  STUDENT_SECTIONS,
  type StudentClass,
  type StudentSection,
} from "../student/student.model";

const mongoId = Joi.string()
  .hex()
  .length(24)
  .required()
  .messages({ "string.length": "studentId must be a valid 24-character hex id" });

const classField = Joi.string()
  .trim()
  .valid(...STUDENT_CLASSES)
  .required();

const sectionField = Joi.string()
  .trim()
  .valid(...STUDENT_SECTIONS)
  .required();

const dateKeyField = Joi.string()
  .trim()
  .pattern(/^\d{4}-\d{2}-\d{2}$/)
  .required()
  .messages({
    "string.pattern.base": "date must be YYYY-MM-DD",
  });

const attendanceRecordSchema = Joi.object({
  studentId: mongoId,
  status: Joi.string()
    .valid(...ATTENDANCE_STATUSES)
    .required(),
  remark: Joi.string().trim().max(500).optional().allow("", null).empty([null, ""]),
});

export const markAttendanceSchema = {
  body: Joi.object({
    dateKey: dateKeyField,
    class: classField,
    section: sectionField,
    records: Joi.array().items(attendanceRecordSchema).min(1).required(),
  }).unknown(false),
};

export const getAttendanceSchema = {
  query: Joi.object({
    dateKey: dateKeyField,
    class: classField,
    section: sectionField,
  }).unknown(false),
};

const optionalClassField = Joi.string()
  .trim()
  .valid(...STUDENT_CLASSES)
  .optional();

const optionalSectionField = Joi.string()
  .trim()
  .valid(...STUDENT_SECTIONS)
  .optional();

const fromToDateRangeSchema = Joi.object({
  from: dateKeyField,
  to: dateKeyField,
  class: optionalClassField,
  section: optionalSectionField,
})
  .custom((value, helpers) => {
    if (value.from > value.to) {
      return helpers.error("any.invalid");
    }
    if (value.section && !value.class) {
      return helpers.error("any.invalid");
    }
    return value;
  })
  .unknown(false);

export const attendanceDashboardSummarySchema = {
  query: fromToDateRangeSchema,
};

export const attendanceDashboardTrendSchema = {
  query: fromToDateRangeSchema.keys({
    granularity: Joi.string()
      .valid("daily", "weekly", "monthly")
      .optional()
      .default("daily"),
  }),
};

export const attendanceDashboardRecordsSchema = {
  query: Joi.object({
    dateKey: dateKeyField,
    class: classField,
    section: sectionField,
    status: Joi.string()
      .valid(...ATTENDANCE_STATUSES)
      .optional(),
    page: Joi.number().integer().min(1).optional().default(1),
    limit: Joi.number().integer().min(1).max(200).optional().default(20),
  }).unknown(false),
};

export type MarkAttendanceBody = {
  dateKey: string;
  class: StudentClass;
  section: StudentSection;
  records: {
    studentId: string;
    status: (typeof ATTENDANCE_STATUSES)[number];
    remark?: string;
  }[];
};

export type GetAttendanceQuery = {
  dateKey: string;
  class: StudentClass;
  section: StudentSection;
};

export type AttendanceDashboardSummaryQuery = {
  from: string;
  to: string;
  class?: StudentClass;
  section?: StudentSection;
};

export type AttendanceDashboardTrendQuery = AttendanceDashboardSummaryQuery & {
  granularity: "daily" | "weekly" | "monthly";
};

export type AttendanceDashboardRecordsQuery = {
  dateKey: string;
  class: StudentClass;
  section: StudentSection;
  status?: (typeof ATTENDANCE_STATUSES)[number];
  page: number;
  limit: number;
};
