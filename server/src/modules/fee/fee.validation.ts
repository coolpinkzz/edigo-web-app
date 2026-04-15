import type { Request } from "express";
import Joi from "joi";
import { FEE_STATUSES, FEE_TYPES, FeeStatus, FeeType } from "./fee.model";
import type { CreateFeeInput } from "./fee.types";
import {
  STUDENT_CLASSES,
  STUDENT_SECTIONS,
  StudentSection,
} from "../student/student.model";

/** Stripe-style idempotency header for POST /fees. */
const IDEMPOTENCY_KEY_RE = /^[a-zA-Z0-9_-]{1,128}$/;

/**
 * Returns undefined if the header is absent or blank.
 * @throws Error if the header is present but invalid
 */
export function parseIdempotencyKeyHeader(req: Request): string | undefined {
  const raw = req.get("Idempotency-Key");
  if (raw === undefined || raw === null) {
    return undefined;
  }
  const trimmed = raw.trim();
  if (trimmed === "") {
    return undefined;
  }
  if (!IDEMPOTENCY_KEY_RE.test(trimmed)) {
    throw new Error(
      "Idempotency-Key must be 1–128 characters (letters, digits, underscore, hyphen)",
    );
  }
  return trimmed;
}

const feeTypeField = Joi.string()
  .valid(...FEE_TYPES)
  .messages({
    "any.only": `feeType must be one of: ${FEE_TYPES.join(", ")}`,
  });

const feeStatusField = Joi.string()
  .valid(...FEE_STATUSES)
  .messages({
    "any.only": `status must be one of: ${FEE_STATUSES.join(", ")}`,
  });

const mongoId24 = Joi.string()
  .hex()
  .length(24)
  .required()
  .messages({ "string.length": "id must be a valid 24-character hex id" });

/** Shared with POST /students when assigning a fee template at student creation. */
export const feeTemplateCreateOverridesSchema = Joi.object({
  title: Joi.string().trim().optional(),
  description: Joi.string().trim().optional().allow("", null).empty([null, ""]),
  category: Joi.string().trim().optional().allow("", null).empty([null, ""]),
  metadata: Joi.object().unknown(true).optional(),
  startDate: Joi.date().optional(),
  endDate: Joi.date().optional(),
  tags: Joi.array().items(Joi.string().trim()).optional(),
});

const sourceField = Joi.string()
  .valid("CUSTOM", "TEMPLATE")
  .required()
  .messages({
    "any.only": "source must be CUSTOM or TEMPLATE",
  });

/** POST /fees — CUSTOM: manual fields; TEMPLATE: templateId + optional overrides (data copied from template). */
const createFeeBodySchema = Joi.object({
  source: sourceField,
  studentId: mongoId24,
  templateId: Joi.when("source", {
    is: "TEMPLATE",
    then: mongoId24.required(),
    otherwise: Joi.forbidden().messages({
      "any.unknown": "templateId is only allowed when source is TEMPLATE",
    }),
  }),
  assignmentAnchorDate: Joi.when("source", {
    is: "TEMPLATE",
    then: Joi.date().optional(),
    otherwise: Joi.forbidden(),
  }),
  feeOverrides: Joi.when("source", {
    is: "TEMPLATE",
    then: feeTemplateCreateOverridesSchema.optional(),
    otherwise: Joi.forbidden(),
  }),
  title: Joi.when("source", {
    is: "CUSTOM",
    then: Joi.string().trim().required(),
    otherwise: Joi.forbidden(),
  }),
  description: Joi.when("source", {
    is: "CUSTOM",
    then: Joi.string().trim().optional().allow("", null).empty([null, ""]),
    otherwise: Joi.forbidden(),
  }),
  feeType: Joi.when("source", {
    is: "CUSTOM",
    then: feeTypeField.required(),
    otherwise: Joi.forbidden(),
  }),
  category: Joi.when("source", {
    is: "CUSTOM",
    then: Joi.string().trim().optional().allow("", null).empty([null, ""]),
    otherwise: Joi.forbidden(),
  }),
  metadata: Joi.when("source", {
    is: "CUSTOM",
    then: Joi.object().unknown(true).optional(),
    otherwise: Joi.forbidden(),
  }),
  totalAmount: Joi.when("source", {
    is: "CUSTOM",
    then: Joi.number().positive().required(),
    otherwise: Joi.forbidden(),
  }),
  paidAmount: Joi.when("source", {
    is: "CUSTOM",
    then: Joi.number().min(0).optional(),
    otherwise: Joi.forbidden(),
  }),
  startDate: Joi.when("source", {
    is: "CUSTOM",
    then: Joi.date().optional(),
    otherwise: Joi.forbidden(),
  }),
  endDate: Joi.when("source", {
    is: "CUSTOM",
    then: Joi.date().optional(),
    otherwise: Joi.forbidden(),
  }),
  tags: Joi.when("source", {
    is: "CUSTOM",
    then: Joi.array().items(Joi.string().trim()).optional(),
    otherwise: Joi.forbidden(),
  }),
}).unknown(false);

/** GET /fees */
const listFeesQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  studentId: Joi.string().hex().length(24).optional().allow("", null).empty([null, ""]),
  status: feeStatusField.optional().allow("", null).empty([null, ""]),
  feeType: feeTypeField.optional().allow("", null).empty([null, ""]),
}).unknown(false);

const studentClassField = Joi.string()
  .valid(...STUDENT_CLASSES)
  .messages({
    "any.only": `class must be one of: ${STUDENT_CLASSES.join(", ")}`,
  });

const studentSectionField = Joi.string()
  .valid(...STUDENT_SECTIONS)
  .messages({
    "any.only": `section must be one of: ${STUDENT_SECTIONS.join(", ")}`,
  });

/** GET /fees/overdue */
const listOverdueFeesQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  feeType: feeTypeField.optional().allow("", null).empty([null, ""]),
  class: studentClassField.optional().allow("", null).empty([null, ""]),
  courseId: Joi.string()
    .hex()
    .length(24)
    .optional()
    .allow("", null)
    .empty([null, ""]),
  search: Joi.string().trim().max(200).optional().allow("", null).empty([null, ""]),
}).unknown(false);

const assignCustomInstallmentSchema = Joi.object({
  amount: Joi.number().positive().required(),
  dueDate: Joi.date().required(),
});

const assignTemplateBodySchema = Joi.object({
  templateId: mongoId24,
  assignmentType: Joi.string().valid("CLASS", "STUDENTS").required(),
  studentIds: Joi.when("assignmentType", {
    is: "STUDENTS",
    then: Joi.array()
      .items(Joi.string().hex().length(24))
      .min(1)
      .max(500)
      .required(),
    otherwise: Joi.forbidden(),
  }),
  class: Joi.when("assignmentType", {
    is: "CLASS",
    then: studentClassField.required(),
    otherwise: Joi.forbidden(),
  }),
  section: Joi.when("assignmentType", {
    is: "CLASS",
    then: studentSectionField.optional(),
    otherwise: Joi.forbidden(),
  }),
  customInstallments: Joi.array()
    .items(assignCustomInstallmentSchema)
    .min(1)
    .optional(),
  perStudentDiscounts: Joi.object()
    .pattern(/^[a-fA-F0-9]{24}$/, Joi.number().min(0).max(100))
    .optional(),
}).unknown(false);

const feeIdParamsSchema = Joi.object({
  feeId: mongoId24,
});

const feeAndInstallmentParamsSchema = Joi.object({
  feeId: mongoId24,
  installmentId: mongoId24,
});

/** PATCH /fees/:feeId */
const updateFeeBodySchema = Joi.object({
  title: Joi.string().trim().min(1).optional(),
  description: Joi.string().trim().optional().allow("", null).empty([null, ""]),
  feeType: feeTypeField.optional(),
  category: Joi.string().trim().optional().allow("", null).empty([null, ""]),
  metadata: Joi.object().unknown(true).optional(),
  totalAmount: Joi.number().positive().optional(),
  paidAmount: Joi.number().min(0).optional(),
  startDate: Joi.date().optional(),
  endDate: Joi.date().optional(),
  tags: Joi.array().items(Joi.string().trim()).optional(),
})
  .min(1)
  .messages({
    "object.min": "Request body must contain at least one field to update",
  });

const installmentRowSchema = Joi.object({
  amount: Joi.number().positive().required(),
  dueDate: Joi.date().required(),
  paidAmount: Joi.number().min(0).optional(),
  lateFee: Joi.number().min(0).optional(),
  discount: Joi.number().min(0).optional(),
  metadata: Joi.object().unknown(true).optional(),
});

/** POST /fees/:feeId/installments */
const addInstallmentsBodySchema = Joi.object({
  installments: Joi.array().items(installmentRowSchema).min(1).required(),
});

/** PATCH /fees/:feeId/installments/:installmentId */
const updateInstallmentBodySchema = Joi.object({
  amount: Joi.number().positive().optional(),
  paidAmount: Joi.number().min(0).optional(),
  dueDate: Joi.date().optional(),
  lateFee: Joi.number().min(0).optional(),
  discount: Joi.number().min(0).optional(),
  metadata: Joi.object().unknown(true).optional(),
})
  .min(1)
  .messages({
    "object.min": "Request body must contain at least one field to update",
  });

export const createFeeSchema = {
  body: createFeeBodySchema,
};

export const listFeesSchema = {
  query: listFeesQuerySchema,
};

export const listOverdueFeesSchema = {
  query: listOverdueFeesQuerySchema,
};

export const assignTemplateToStudentsSchema = {
  body: assignTemplateBodySchema,
};

export const feeIdParamsOnlySchema = {
  params: feeIdParamsSchema,
};

export const recalculateFeeSchema = {
  params: feeIdParamsSchema,
};

export const updateFeeSchema = {
  params: feeIdParamsSchema,
  body: updateFeeBodySchema,
};

export const addInstallmentsSchema = {
  params: feeIdParamsSchema,
  body: addInstallmentsBodySchema,
};

export const updateInstallmentSchema = {
  params: feeAndInstallmentParamsSchema,
  body: updateInstallmentBodySchema,
};

export type CreateFeeBody = CreateFeeInput;

export interface ListFeesQuery {
  page: number;
  limit: number;
  studentId?: string;
  status?: FeeStatus;
  feeType?: FeeType;
}

export interface ListOverdueFeesQuery {
  page: number;
  limit: number;
  feeType?: FeeType;
  class?: string;
  courseId?: string;
  search?: string;
}

export interface AssignTemplateToStudentsBody {
  templateId: string;
  assignmentType: "CLASS" | "STUDENTS";
  studentIds?: string[];
  class?: string;
  section?: StudentSection;
  customInstallments?: {
    amount: number;
    dueDate: Date;
  }[];
  /** Percentage discount on principal totalAmount (0-100). */
  perStudentDiscounts?: Record<string, number>;
}

export interface AddInstallmentsBody {
  installments: {
    amount: number;
    dueDate: Date;
    paidAmount?: number;
    lateFee?: number;
    discount?: number;
    metadata?: Record<string, unknown>;
  }[];
}

export interface UpdateFeeBody {
  title?: string;
  description?: string;
  feeType?: FeeType;
  category?: string;
  metadata?: Record<string, unknown>;
  totalAmount?: number;
  paidAmount?: number;
  startDate?: Date;
  endDate?: Date;
  tags?: string[];
}

export interface UpdateInstallmentBody {
  amount?: number;
  paidAmount?: number;
  dueDate?: Date;
  lateFee?: number;
  discount?: number;
  metadata?: Record<string, unknown>;
}
