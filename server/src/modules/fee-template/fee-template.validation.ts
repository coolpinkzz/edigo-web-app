import Joi from "joi";
import { FEE_TYPES, FeeType } from "../fee/fee.model";
import {
  STUDENT_CLASSES,
  STUDENT_SECTIONS,
  StudentClass,
  StudentSection,
} from "../student/student.model";

const feeTypeField = Joi.string()
  .valid(...FEE_TYPES)
  .messages({
    "any.only": `feeType must be one of: ${FEE_TYPES.join(", ")}`,
  });

const mongoId24 = Joi.string()
  .hex()
  .length(24)
  .required()
  .messages({ "string.length": "id must be a valid 24-character hex id" });

const defaultInstallmentTemplateSchema = Joi.object({
  amount: Joi.number().positive().required(),
  dueInDays: Joi.number().integer().min(0).required(),
  lateFee: Joi.number().min(0).optional(),
  discount: Joi.number().min(0).optional(),
  metadata: Joi.object().unknown(true).optional(),
});

const isoDateOnly = Joi.string()
  .pattern(/^\d{4}-\d{2}-\d{2}$/)
  .messages({
    "string.pattern.base": "installmentAnchorDate must be YYYY-MM-DD",
  });

const createFeeTemplateBodySchema = Joi.object({
  title: Joi.string().trim().required(),
  description: Joi.string().trim().optional().allow("", null).empty([null, ""]),
  feeType: feeTypeField.required(),
  category: Joi.string().trim().optional().allow("", null).empty([null, ""]),
  totalAmount: Joi.number().positive().required(),
  isInstallment: Joi.boolean().required(),
  defaultInstallments: Joi.when("isInstallment", {
    is: true,
    then: Joi.array()
      .items(defaultInstallmentTemplateSchema)
      .min(1)
      .required(),
    otherwise: Joi.array().length(0).optional(),
  }),
  installmentAnchorDate: Joi.when("isInstallment", {
    is: true,
    then: isoDateOnly.required(),
    otherwise: isoDateOnly.forbidden(),
  }),
  /** Lump-sum only: default fee due date (YYYY-MM-DD). */
  defaultEndDate: Joi.when("isInstallment", {
    is: false,
    then: isoDateOnly.optional().allow("", null).empty([null, ""]),
    otherwise: Joi.forbidden(),
  }),
  metadata: Joi.object().unknown(true).optional(),
  tags: Joi.array().items(Joi.string().trim()).optional(),
});

const listFeeTemplatesQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  feeType: feeTypeField.optional().allow("", null).empty([null, ""]),
}).unknown(false);

const feeAssignmentOverridesSchema = Joi.object({
  title: Joi.string().trim().optional(),
  description: Joi.string().trim().optional().allow("", null).empty([null, ""]),
  category: Joi.string().trim().optional().allow("", null).empty([null, ""]),
  metadata: Joi.object().unknown(true).optional(),
  startDate: Joi.date().optional(),
  endDate: Joi.date().optional(),
  tags: Joi.array().items(Joi.string().trim()).optional(),
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

const assignTemplateBodySchema = Joi.object({
  studentIds: Joi.array()
    .items(Joi.string().hex().length(24))
    .min(1)
    .max(500)
    .optional(),
  class: classField.optional(),
  section: sectionField.when("class", {
    is: Joi.exist(),
    then: Joi.optional(),
    otherwise: Joi.forbidden(),
  }),
  assignmentAnchorDate: Joi.date().optional(),
  feeOverrides: feeAssignmentOverridesSchema.optional(),
  perStudentOverrides: Joi.object()
    .pattern(
      /^[a-fA-F0-9]{24}$/,
      feeAssignmentOverridesSchema,
    )
    .optional(),
})
  .xor("studentIds", "class")
  .messages({
    "object.missing": "Either studentIds or class is required",
  });

const templateIdParamsSchema = Joi.object({
  templateId: mongoId24,
});

const assignTemplateParamsSchema = Joi.object({
  id: mongoId24,
});

export const createFeeTemplateSchema = {
  body: createFeeTemplateBodySchema,
};

export const listFeeTemplatesSchema = {
  query: listFeeTemplatesQuerySchema,
};

export const templateIdParamsOnlySchema = {
  params: templateIdParamsSchema,
};

export const updateFeeTemplateSchema = {
  params: templateIdParamsSchema,
  body: createFeeTemplateBodySchema,
};

export const assignFeeTemplateSchema = {
  params: assignTemplateParamsSchema,
  body: assignTemplateBodySchema,
};

export interface CreateFeeTemplateBody {
  title: string;
  description?: string;
  feeType: FeeType;
  category?: string;
  totalAmount: number;
  isInstallment: boolean;
  defaultInstallments: {
    amount: number;
    dueInDays: number;
    lateFee?: number;
    discount?: number;
    metadata?: Record<string, unknown>;
  }[];
  /** Required when isInstallment (YYYY-MM-DD). */
  installmentAnchorDate?: string;
  /** Lump-sum only: default due date on fees created from this template. */
  defaultEndDate?: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
}

/** Same payload as create; used for PATCH /fee-templates/:templateId */
export type UpdateFeeTemplateBody = CreateFeeTemplateBody;

export interface ListFeeTemplatesQuery {
  page: number;
  limit: number;
  feeType?: FeeType;
}

export interface AssignFeeTemplateBody {
  studentIds?: string[];
  class?: StudentClass;
  section?: StudentSection;
  assignmentAnchorDate?: Date;
  feeOverrides?: FeeAssignmentOverridesBody;
  perStudentOverrides?: Record<string, FeeAssignmentOverridesBody>;
}

export interface FeeAssignmentOverridesBody {
  title?: string;
  description?: string;
  category?: string;
  metadata?: Record<string, unknown>;
  startDate?: Date;
  endDate?: Date;
  tags?: string[];
}
