import Joi from "joi";
import { QUOTATION_STATUSES } from "./quotation.model";
import {
  STUDENT_CLASSES,
  STUDENT_GENDERS,
  STUDENT_SECTIONS,
} from "../student/student.model";

/** Indian mobile: exactly 10 digits (aligned with student validation). */
const PHONE_10 = Joi.string()
  .pattern(/^\d{10}$/)
  .messages({
    "string.pattern.base": "phone must be exactly 10 digits",
  });

const objectId = Joi.string().hex().length(24).messages({
  "string.length": "must be a valid 24-character hex id",
});

const optionalHttpUrl = Joi.string()
  .trim()
  .uri({ scheme: ["http", "https"] })
  .max(2048)
  .allow("", null)
  .empty([null, ""]);

function validateCourseXor(
  v: Record<string, unknown>,
  helpers: Joi.CustomHelpers,
  mode: "create" | "patch",
): Record<string, unknown> {
  const hasCourseId = Object.prototype.hasOwnProperty.call(v, "courseId");
  const hasCustom = Object.prototype.hasOwnProperty.call(
    v,
    "courseCustomName",
  );
  const id =
    typeof v.courseId === "string"
      ? v.courseId.trim()
      : String(v.courseId ?? "");
  const custom =
    typeof v.courseCustomName === "string"
      ? v.courseCustomName.trim()
      : String(v.courseCustomName ?? "");

  if (mode === "patch" && !hasCourseId && !hasCustom) {
    return v;
  }
  if (mode === "create" || hasCourseId || hasCustom) {
    if (!id && !custom) {
      return helpers.message({
        custom:
          mode === "create"
            ? "Either courseId or courseCustomName is required"
            : "courseId or courseCustomName must be non-empty when updating course",
      }) as never;
    }
    if (id && custom) {
      return helpers.message({
        custom: "Provide either courseId or courseCustomName, not both",
      }) as never;
    }
  }
  return v;
}

const baseFields = {
  name: Joi.string().trim().min(1).max(200).required(),
  parentName: Joi.string().trim().min(1).max(200).required(),
  gender: Joi.string()
    .valid(...STUDENT_GENDERS)
    .required(),
  age: Joi.number().integer().min(3).max(100).required(),
  courseId: objectId.allow(null, "").empty([null, ""]),
  courseCustomName: Joi.string().trim().max(200).allow("", null),
  phone: PHONE_10.required(),
  address: Joi.string().trim().min(1).max(2000).required(),
  email: Joi.string().trim().email().allow("", null).empty([null, ""]),
  branchId: objectId.required(),
  discountPercent: Joi.number().min(0).max(100).required(),
  websiteUrl: optionalHttpUrl,
  youtubeUrl: optionalHttpUrl,
  instagramUrl: optionalHttpUrl,
  feeTemplateId: objectId.required(),
  validUntil: Joi.date().iso().required(),
  preferredTimeSlot: Joi.string().trim().min(1).max(500).required(),
  class: Joi.string()
    .valid(...STUDENT_CLASSES)
    .allow("", null)
    .empty([null, ""]),
  section: Joi.string()
    .valid(...STUDENT_SECTIONS)
    .allow("", null)
    .empty([null, ""]),
  quotationOverview: Joi.string()
    .trim()
    .max(4000)
    .allow("", null)
    .empty([null, ""]),
  notes: Joi.string().trim().max(4000).allow("", null).empty([null, ""]),
};

/** Create: course vs class+section validated in service from tenantType. */
export const createQuotationSchema = Joi.object(baseFields).required();

export type CreateQuotationBody = {
  name: string;
  parentName: string;
  gender: (typeof STUDENT_GENDERS)[number];
  age: number;
  courseId?: string;
  courseCustomName?: string;
  phone: string;
  address: string;
  email?: string;
  branchId: string;
  discountPercent: number;
  websiteUrl?: string;
  youtubeUrl?: string;
  instagramUrl?: string;
  feeTemplateId: string;
  validUntil: string | Date;
  preferredTimeSlot: string;
  class?: string;
  section?: string;
  quotationOverview?: string;
  notes?: string;
};

const patchFields = {
  name: Joi.string().trim().min(1).max(200),
  parentName: Joi.string().trim().min(1).max(200),
  gender: Joi.string().valid(...STUDENT_GENDERS),
  age: Joi.number().integer().min(3).max(100),
  courseId: objectId.allow(null, "").empty([null, ""]),
  courseCustomName: Joi.string().trim().max(200).allow("", null),
  phone: PHONE_10,
  address: Joi.string().trim().min(1).max(2000),
  email: Joi.string().trim().email().allow("", null).empty([null, ""]),
  branchId: objectId,
  discountPercent: Joi.number().min(0).max(100),
  websiteUrl: optionalHttpUrl,
  youtubeUrl: optionalHttpUrl,
  instagramUrl: optionalHttpUrl,
  feeTemplateId: objectId,
  validUntil: Joi.date().iso(),
  preferredTimeSlot: Joi.string().trim().min(1).max(500),
  class: Joi.string()
    .valid(...STUDENT_CLASSES)
    .allow("", null)
    .empty([null, ""]),
  section: Joi.string()
    .valid(...STUDENT_SECTIONS)
    .allow("", null)
    .empty([null, ""]),
  quotationOverview: Joi.string()
    .trim()
    .max(4000)
    .allow("", null)
    .empty([null, ""]),
  notes: Joi.string().trim().max(4000).allow("", null).empty([null, ""]),
  status: Joi.string().valid(...QUOTATION_STATUSES),
};

export const updateQuotationSchema = Joi.object(patchFields)
  .min(1)
  .custom((v, h) => validateCourseXor(v as Record<string, unknown>, h, "patch"))
  .required();

export type UpdateQuotationBody = Partial<CreateQuotationBody> & {
  status?: (typeof QUOTATION_STATUSES)[number];
};

export const quotationIdParamsSchema = Joi.object({
  id: objectId.required(),
}).required();

export const listQuotationsQuerySchema = Joi.object({
  branchId: Joi.string().trim().hex().length(24).allow("", null),
  status: Joi.string().valid(...QUOTATION_STATUSES),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
}).required();

export type ListQuotationsQuery = {
  branchId?: string;
  status?: (typeof QUOTATION_STATUSES)[number];
  page: number;
  limit: number;
};

/** Public accept (same PDF token); class/section required for school tenants at runtime. */
export const quotationAcceptPublicBodySchema = Joi.object({
  token: Joi.string().trim().required(),
  class: Joi.string()
    .valid(...STUDENT_CLASSES)
    .allow("", null)
    .empty([null, ""]),
  section: Joi.string()
    .valid(...STUDENT_SECTIONS)
    .allow("", null)
    .empty([null, ""]),
}).required();

export type QuotationAcceptPublicBody = {
  token: string;
  class?: string;
  section?: string;
};

/** Staff accept-checkout (school tenants need class + section on the body). */
export const quotationAcceptStaffBodySchema = Joi.object({
  class: Joi.string()
    .valid(...STUDENT_CLASSES)
    .allow("", null)
    .empty([null, ""]),
  section: Joi.string()
    .valid(...STUDENT_SECTIONS)
    .allow("", null)
    .empty([null, ""]),
}).required();

export type QuotationAcceptStaffBody = {
  class?: string;
  section?: string;
};
