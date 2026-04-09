import mongoose, { Schema, Document, Model } from "mongoose";
import {
  STUDENT_CLASSES,
  STUDENT_SECTIONS,
  type StudentClass,
  type StudentSection,
} from "../student/student.model";

export const ATTENDANCE_STATUSES = ["PRESENT", "ABSENT"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export interface AttendanceRecord {
  studentId: string;
  status: AttendanceStatus;
  remark?: string;
}

export interface IAttendance extends Document {
  tenantId: string;
  /** Calendar date YYYY-MM-DD (as selected for the class session). */
  dateKey: string;
  class: StudentClass;
  section: StudentSection;
  records: AttendanceRecord[];
  markedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const RecordSchema = new Schema<AttendanceRecord>(
  {
    studentId: { type: String, required: true, trim: true },
    status: {
      type: String,
      required: true,
      enum: ATTENDANCE_STATUSES,
    },
    remark: { type: String, trim: true },
  },
  { _id: false },
);

const AttendanceSchema = new Schema<IAttendance>(
  {
    tenantId: { type: String, required: true, index: true },
    dateKey: { type: String, required: true, trim: true },
    class: {
      type: String,
      required: true,
      trim: true,
      enum: STUDENT_CLASSES,
    },
    section: {
      type: String,
      required: true,
      trim: true,
      enum: STUDENT_SECTIONS,
    },
    records: { type: [RecordSchema], required: true, default: [] },
    markedBy: { type: String, required: true, trim: true },
  },
  { timestamps: true },
);

AttendanceSchema.index(
  { tenantId: 1, class: 1, section: 1, dateKey: 1 },
  { unique: true },
);

export const Attendance: Model<IAttendance> =
  mongoose.models.Attendance ??
  mongoose.model<IAttendance>("Attendance", AttendanceSchema);
