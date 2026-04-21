import Joi from "joi";
import { feeTemplateCreateOverridesSchema } from "../fee/fee.validation";
import {
  COURSE_DURATION_MONTHS_MAX,
  COURSE_DURATION_MONTHS_MIN,
  STUDENT_CLASSES,
  STUDENT_GENDERS,
  STUDENT_SECTIONS,
  STUDENT_STATUSES,
  StudentClass,
  StudentGender,
  StudentSection,
  StudentStatus,
} from "./student.model";
import type { FeeTemplateCreateOverrides } from "../fee/fee.types";
import type { StudentFeeOverviewSortBy } from "./student-fee-overview.service";

/**
 * Student HTTP validation (Joi).
 *
 * Schemas are composed in `routes/student.routes.ts` with the shared `validate()` middleware:
 * - Request shapes are validated before the controller runs.
 * - Export types below mirror validated payloads so controllers stay type-safe without
 *   re-implementing rules.
 */

/** Indian mobile: exactly 10 digits (no country code). */
const PHONE_10 = Joi.string()
  .pattern(/^\d{10}$/)
  .messages({
    "string.pattern.base": "parentPhoneNumber must be exactly 10 digits",
  });

const PHONE_10_ALT = Joi.string()
  .pattern(/^\d{10}$/)
  .messages({
    "string.pattern.base": "alternatePhone must be exactly 10 digits",
  });

/** Indian PAN: 5 letters, 4 digits, 1 letter (e.g. ABCDE1234F). */
const PAN = Joi.string()
  .trim()
  .uppercase()
  .pattern(/^[A-Z]{5}[0-9]{4}[A-Z]$/)
  .messages({
    "string.pattern.base": "panNumber must be a valid PAN (e.g. ABCDE1234F)",
  });

const statusField = Joi.string()
  .valid(...STUDENT_STATUSES)
  .messages({
    "any.only": `status must be one of: ${STUDENT_STATUSES.join(", ")}`,
  });

const classField = Joi.string()
  .trim()
  .valid(...STUDENT_CLASSES)
  .messages({
    "any.only": `class must be one of: ${STUDENT_CLASSES.join(", ")}`,
  });

const sectionField = Joi.string()
  .trim()
  .valid(...STUDENT_SECTIONS)
  .messages({
    "any.only": `section must be one of: ${STUDENT_SECTIONS.join(", ")}`,
  });

const genderField = Joi.string()
  .valid(...STUDENT_GENDERS)
  .messages({
    "any.only": `gender must be one of: ${STUDENT_GENDERS.join(", ")}`,
  });

const httpsPhotoUrl = Joi.string()
  .uri({ scheme: ["https"] })
  .max(2048)
  .messages({
    "string.uri": "photoUrl must be a valid https URL",
  });

const courseDurationMonthsField = Joi.number()
  .integer()
  .min(COURSE_DURATION_MONTHS_MIN)
  .max(COURSE_DURATION_MONTHS_MAX)
  .messages({
    "number.min": `courseDurationMonths must be at least ${COURSE_DURATION_MONTHS_MIN}`,
    "number.max": `courseDurationMonths must be at most ${COURSE_DURATION_MONTHS_MAX}`,
  });

/** Must match a Course document id for this tenant when set. */
const courseIdField = Joi.string()
  .trim()
  .optional()
  .allow("", null)
  .empty([null, ""])
  .hex()
  .length(24)
  .messages({
    "string.length": "courseId must be a valid 24-character hex id",
  });

const feeAssignmentTemplateIdField = Joi.string()
  .trim()
  .hex()
  .length(24)
  .required()
  .messages({
    "string.length": "feeAssignment.templateId must be a valid 24-character hex id",
  });

const customInstallmentRowSchema = Joi.object({
  amount: Joi.number().positive().required(),
  dueDate: Joi.date().required(),
});

const feeAssignmentSchema = Joi.object({
  templateId: feeAssignmentTemplateIdField,
  discount: Joi.number().min(0).max(100).optional(),
  useCustomInstallments: Joi.boolean().default(false),
  customInstallments: Joi.array()
    .items(customInstallmentRowSchema)
    .min(1)
    .optional(),
  assignmentAnchorDate: Joi.date().optional(),
  feeOverrides: feeTemplateCreateOverridesSchema.optional(),
})
  .custom((value: unknown, helpers) => {
    const v = value as {
      useCustomInstallments?: boolean;
      customInstallments?: unknown[];
    };
    if (v.useCustomInstallments === true) {
      if (!Array.isArray(v.customInstallments) || v.customInstallments.length === 0) {
        return helpers.error("any.custom", {
          message:
            "feeAssignment.customInstallments is required when useCustomInstallments is true",
        });
      }
    }
    return value;
  })
  .messages({
    "any.custom":
      "{{#message}}",
  });

const createStudentFieldsSchema = Joi.object({
  studentName: Joi.string().trim().required(),
  parentName: Joi.string().trim().required(),
  parentPhoneNumber: PHONE_10.required(),
  admissionId: Joi.string().trim().optional().allow("", null).empty([null, ""]),
  scholarId: Joi.string().trim().optional().allow("", null).empty([null, ""]),
  panNumber: PAN.optional().allow("", null).empty([null, ""]),
  alternatePhone: Joi.alternatives()
    .try(
      Joi.string().trim().allow("", null).empty([null, ""]),
      PHONE_10_ALT,
    )
    .optional(),
  parentEmail: Joi.string()
    .trim()
    .email()
    .optional()
    .allow("", null)
    .empty([null, ""]),
  class: classField.optional().allow("", null).empty([null, ""]),
  section: sectionField.optional().allow("", null).empty([null, ""]),
  courseId: courseIdField,
  status: statusField.optional(),
  joinedAt: Joi.date().optional(),
  leftAt: Joi.date().optional(),
  tags: Joi.array().items(Joi.string().trim()).optional(),
  dateOfBirth: Joi.date().optional(),
  gender: genderField.optional().allow("", null).empty([null, ""]),
  address: Joi.string().trim().optional().allow("", null).empty([null, ""]).max(500),
  courseDurationMonths: courseDurationMonthsField.optional(),
  photoUrl: httpsPhotoUrl.optional().allow("", null).empty([null, ""]),
});

/** POST /students — body */
const createStudentLegacyBodySchema = createStudentFieldsSchema.keys({
  /** When set, creates one fee from this tenant template after the student is saved (same as POST /fees source=TEMPLATE). */
  feeTemplateId: Joi.string()
    .trim()
    .optional()
    .allow("", null)
    .empty([null, ""])
    .hex()
    .length(24)
    .messages({
      "string.length": "feeTemplateId must be a valid 24-character hex id",
    }),
  assignmentAnchorDate: Joi.date().optional(),
  feeOverrides: feeTemplateCreateOverridesSchema.optional(),
})
  .with("assignmentAnchorDate", "feeTemplateId")
  .with("feeOverrides", "feeTemplateId");

const createStudentNestedBodySchema = Joi.object({
  student: createStudentFieldsSchema.required(),
  feeAssignment: feeAssignmentSchema.optional(),
}).unknown(false);

const createStudentBodyAlternatives = Joi.alternatives().try(
  createStudentLegacyBodySchema,
  createStudentNestedBodySchema,
);

const createStudentBodySchema = Joi.object()
  .unknown(true)
  .custom((value: unknown, helpers) => {
    const { error, value: parsed } = createStudentBodyAlternatives.validate(
      value,
    );
    if (error) {
      return helpers.error("any.custom", {
        message: error.details[0]?.message ?? "Invalid student create payload",
      });
    }
    return parsed;
  })
  .messages({
    "any.custom": "{{#message}}",
  });

/** PATCH /students/:id — body: at least one field; same rules when present */
const updateStudentBodySchema = Joi.object({
  studentName: Joi.string().trim().min(1).optional(),
  parentName: Joi.string().trim().min(1).optional(),
  parentPhoneNumber: PHONE_10.optional(),
  admissionId: Joi.string().trim().optional().allow("", null).empty([null, ""]),
  scholarId: Joi.string().trim().optional().allow("", null).empty([null, ""]),
  panNumber: PAN.optional().allow("", null).empty([null, ""]),
  alternatePhone: Joi.alternatives()
    .try(
      Joi.valid(null),
      Joi.string().trim().allow("", null).empty([null, ""]),
      PHONE_10_ALT,
    )
    .optional(),
  parentEmail: Joi.string()
    .trim()
    .email()
    .optional()
    .allow("", null)
    .empty([null, ""]),
  class: classField.optional().allow("", null).empty([null, ""]),
  section: sectionField.optional().allow("", null).empty([null, ""]),
  courseId: courseIdField,
  status: statusField.optional(),
  joinedAt: Joi.date().optional(),
  leftAt: Joi.date().optional(),
  tags: Joi.array().items(Joi.string().trim()).optional(),
  dateOfBirth: Joi.alternatives()
    .try(Joi.date(), Joi.valid(null))
    .optional(),
  gender: Joi.alternatives()
    .try(genderField, Joi.valid(null))
    .optional(),
  address: Joi.alternatives()
    .try(Joi.string().trim().max(500), Joi.valid(null))
    .optional(),
  courseDurationMonths: Joi.alternatives()
    .try(Joi.valid(null), courseDurationMonthsField)
    .optional(),
  photoUrl: Joi.alternatives()
    .try(Joi.valid(null), httpsPhotoUrl)
    .optional(),
})
  .min(1)
  .messages({
    "object.min": "Request body must contain at least one field to update",
  });

/** GET /students — query */
const listStudentsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  status: statusField.optional().allow("", null).empty([null, ""]),
  class: classField.optional().allow("", null).empty([null, ""]),
  section: sectionField.optional().allow("", null).empty([null, ""]),
  search: Joi.string()
    .trim()
    .max(200)
    .optional()
    .allow("", null)
    .empty([null, ""]),
}).unknown(false);

/** GET /students/fee-overview — query */
const feeOverviewQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  /** Student enrollment status (not fee status). */
  studentStatus: statusField.optional().allow("", null).empty([null, ""]),
  class: classField.optional().allow("", null).empty([null, ""]),
  section: sectionField.optional().allow("", null).empty([null, ""]),
  search: Joi.string()
    .trim()
    .max(200)
    .optional()
    .allow("", null)
    .empty([null, ""]),
  /** Comma-separated fee statuses, e.g. `PENDING,OVERDUE` */
  feeStatuses: Joi.string()
    .trim()
    .max(500)
    .optional()
    .allow("", null)
    .empty([null, ""]),
  /** Comma-separated fee types, e.g. `TUITION,TRANSPORT` */
  feeTypes: Joi.string()
    .trim()
    .max(500)
    .optional()
    .allow("", null)
    .empty([null, ""]),
  sortBy: Joi.string()
    .valid("studentName", "class", "pendingTotal", "createdAt")
    .default("studentName"),
  sortDir: Joi.string().valid("asc", "desc").default("asc"),
}).unknown(false);

/** MongoDB ObjectId for :id routes */
const mongoStudentIdParamsSchema = Joi.object({
  id: Joi.string()
    .hex()
    .length(24)
    .required()
    .messages({ "string.length": "id must be a valid 24-character hex id" }),
});

/**
 * Composed validators for `validate(...)` — one export per route group.
 */
export const createStudentSchema = {
  body: createStudentBodySchema,
};

export const updateStudentSchema = {
  params: mongoStudentIdParamsSchema,
  body: updateStudentBodySchema,
};

export const getStudentsSchema = {
  query: listStudentsQuerySchema,
};

export const feeOverviewSchema = {
  query: feeOverviewQuerySchema,
};

export const studentIdParamsSchema = {
  params: mongoStudentIdParamsSchema,
};

const presignStudentPhotoBodySchema = Joi.object({
  contentType: Joi.string()
    .valid("image/jpeg", "image/png", "image/webp", "image/gif")
    .required(),
}).unknown(false);

export const presignStudentPhotoSchema = {
  params: mongoStudentIdParamsSchema,
  body: presignStudentPhotoBodySchema,
};

/** POST /students/import/confirm — validated rows from /import/validate */
const importValidRowSchema = Joi.object({
  rowIndex: Joi.number().integer().min(2).required(),
  studentName: Joi.string().trim().required(),
  scholarId: Joi.string().trim().required(),
  parentName: Joi.string().trim().required(),
  parentPhoneNumber: PHONE_10.required(),
  panNumber: PAN.required(),
  class: classField.required(),
  section: sectionField.required(),
});

export const confirmStudentImportSchema = {
  body: Joi.object({
    validRows: Joi.array().items(importValidRowSchema).min(1).required(),
  }),
};

/**
 * Types aligned with Joi output (validated payloads for controllers).
 * Keep these in sync when changing schemas above.
 */
export interface CreateStudentBody {
  student?: {
    studentName: string;
    parentName: string;
    parentPhoneNumber: string;
    admissionId?: string;
    scholarId?: string;
    panNumber?: string;
    alternatePhone?: string;
    parentEmail?: string;
    class?: StudentClass;
    section?: StudentSection;
    courseId?: string;
    status?: StudentStatus;
    joinedAt?: Date;
    leftAt?: Date;
    tags?: string[];
    dateOfBirth?: Date;
    gender?: StudentGender;
    address?: string;
    courseDurationMonths?: number;
    photoUrl?: string;
  };
  feeAssignment?: {
    templateId: string;
    /** Optional principal discount percentage (0-100). */
    discount?: number;
    useCustomInstallments?: boolean;
    customInstallments?: {
      amount: number;
      dueDate: Date;
    }[];
    assignmentAnchorDate?: Date;
    feeOverrides?: FeeTemplateCreateOverrides;
  };
  studentName: string;
  parentName: string;
  parentPhoneNumber: string;
  admissionId?: string;
  scholarId?: string;
  panNumber?: string;
  alternatePhone?: string;
  parentEmail?: string;
  /** Required when tenant is SCHOOL (validated in service). */
  class?: StudentClass;
  /** Required when tenant is SCHOOL (validated in service). */
  section?: StudentSection;
  /** Required when tenant is ACADEMY (validated in service). */
  courseId?: string;
  status?: StudentStatus;
  joinedAt?: Date;
  leftAt?: Date;
  tags?: string[];
  dateOfBirth?: Date;
  gender?: StudentGender;
  address?: string;
  courseDurationMonths?: number;
  photoUrl?: string;
  /** Optional: instantiate this fee template for the new student (tenant-scoped). */
  feeTemplateId?: string;
  assignmentAnchorDate?: Date;
  feeOverrides?: FeeTemplateCreateOverrides;
}

export type UpdateStudentBody = Partial<
  Omit<
    CreateStudentBody,
    "feeTemplateId" | "assignmentAnchorDate" | "feeOverrides"
  >
> & {
  /** Set to `null` to remove the stored photo URL. */
  photoUrl?: string | null;
};

export interface ListStudentsQuery {
  page: number;
  limit: number;
  status?: StudentStatus;
  class?: StudentClass;
  section?: StudentSection;
  search?: string;
}

export interface FeeOverviewQuery {
  page: number;
  limit: number;
  studentStatus?: StudentStatus;
  class?: StudentClass;
  section?: StudentSection;
  search?: string;
  feeStatuses?: string;
  feeTypes?: string;
  sortBy: StudentFeeOverviewSortBy;
  sortDir: "asc" | "desc";
}

/** POST /students/import/confirm (after Joi validation) */
export interface ConfirmStudentImportBody {
  validRows: {
    rowIndex: number;
    studentName: string;
    scholarId: string;
    parentName: string;
    parentPhoneNumber: string;
    panNumber: string;
    class: StudentClass;
    section: StudentSection;
  }[];
}
