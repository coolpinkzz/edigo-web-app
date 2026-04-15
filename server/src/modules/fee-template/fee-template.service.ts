import mongoose from "mongoose";
import { Fee } from "../fee/fee.model";
import {
  bulkCreateFeesFromTemplateSnapshot,
  CustomAssignmentInstallmentRow,
  parseTemplateYmdIst,
  resolveInstallmentAssignmentAnchor,
} from "../fee/fee.service";
import { Student } from "../student/student.model";
import type { StudentClass, StudentSection } from "../student/student.model";
import { FeeTemplate, IFeeTemplate } from "./fee-template.model";

export interface CreateFeeTemplateInput {
  title: string;
  description?: string;
  feeType: IFeeTemplate["feeType"];
  category?: string;
  totalAmount: number;
  isInstallment: boolean;
  defaultInstallments: IFeeTemplate["defaultInstallments"];
  /** YYYY-MM-DD; required for new installment templates (API validation). */
  installmentAnchorDate?: string;
  /** YYYY-MM-DD; lump-sum templates only — default `endDate` on instantiated fees. */
  defaultEndDate?: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
}

/** Applied at assignment time; becomes a snapshot on each Fee (template edits do not affect existing fees). */
export interface FeeAssignmentOverrides {
  title?: string;
  description?: string;
  category?: string;
  metadata?: Record<string, unknown>;
  startDate?: Date;
  endDate?: Date;
  tags?: string[];
  /** Discount percentage on principal totalAmount (0-100), applied at assignment snapshot time. */
  discount?: number;
}

const MAX_ASSIGN_BY_IDS = 500;
const MAX_ASSIGN_BY_CLASS_FILTER = 2000;

function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: number }).code === 11000
  );
}

export interface AssignTemplateInput {
  assignmentType?: "CLASS" | "STUDENTS";
  /** Explicit list; omit when using class filter. */
  studentIds?: string[];
  /** Filter by grade; omit when using studentIds. */
  class?: StudentClass;
  /** Optional; narrows the class filter to one section. */
  section?: StudentSection;
  /** Defaults to now; installment due dates = anchor + template.defaultInstallments[].dueInDays (IST). */
  assignmentAnchorDate?: Date;
  feeOverrides?: FeeAssignmentOverrides;
  /** Per-student overrides keyed by studentId (same shape as feeOverrides). */
  perStudentOverrides?: Record<string, FeeAssignmentOverrides>;
  /** Optional custom installment structure copied to each assigned student fee. */
  customInstallments?: CustomAssignmentInstallmentRow[];
}

function serializeFeeTemplate(doc: IFeeTemplate) {
  return {
    id: doc._id.toString(),
    tenantId: doc.tenantId,
    title: doc.title,
    description: doc.description,
    feeType: doc.feeType,
    category: doc.category,
    totalAmount: doc.totalAmount,
    isInstallment: doc.isInstallment,
    defaultInstallments: doc.defaultInstallments.map((r) => ({
      amount: r.amount,
      dueInDays: r.dueInDays,
      lateFee: r.lateFee ?? 0,
      discount: r.discount ?? 0,
      metadata: r.metadata,
    })),
    installmentAnchorDate: doc.installmentAnchorDate,
    defaultEndDate: doc.defaultEndDate,
    metadata: doc.metadata,
    tags: doc.tags,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function validateTemplateInstallments(template: {
  isInstallment: boolean;
  totalAmount: number;
  defaultInstallments: IFeeTemplate["defaultInstallments"];
}): void {
  if (template.isInstallment) {
    if (!template.defaultInstallments?.length) {
      throw new Error(
        "isInstallment templates require at least one default installment",
      );
    }
    const sum = template.defaultInstallments.reduce((s, r) => s + r.amount, 0);
    if (Math.abs(sum - template.totalAmount) > 1e-9) {
      throw new Error(
        `Sum of default installment amounts (${sum}) must equal totalAmount (${template.totalAmount})`,
      );
    }
    for (const r of template.defaultInstallments) {
      if (r.amount <= 0) {
        throw new Error("Each default installment amount must be positive");
      }
    }
  } else if (template.defaultInstallments?.length) {
    throw new Error(
      "Non-installment templates must not include defaultInstallments",
    );
  }
}

function mergeAssignmentOverrides(
  template: IFeeTemplate,
  global?: FeeAssignmentOverrides,
  perStudent?: FeeAssignmentOverrides,
): {
  title: string;
  description?: string;
  category?: string;
  metadata?: Record<string, unknown>;
  startDate?: Date;
  endDate?: Date;
  tags?: string[];
} {
  return {
    title: perStudent?.title ?? global?.title ?? template.title,
    description: perStudent?.description ?? global?.description ?? template.description,
    category: perStudent?.category ?? global?.category ?? template.category,
    metadata: perStudent?.metadata ?? global?.metadata ?? template.metadata,
    startDate: perStudent?.startDate ?? global?.startDate,
    endDate:
      perStudent?.endDate ??
      global?.endDate ??
      parseTemplateYmdIst(template.defaultEndDate),
    tags: perStudent?.tags ?? global?.tags ?? template.tags,
  };
}

function resolvePrincipalDiscountPercent(
  global?: FeeAssignmentOverrides,
  perStudent?: FeeAssignmentOverrides,
): number {
  const raw = perStudent?.discount ?? global?.discount ?? 0;
  if (!Number.isFinite(raw)) {
    throw new Error("discount must be a finite number");
  }
  if (raw < 0) {
    throw new Error("discount cannot be negative");
  }
  if (raw > 100) {
    throw new Error("discount cannot exceed 100%");
  }
  return raw;
}

async function loadTemplateOrThrow(
  tenantId: string,
  templateId: string,
): Promise<IFeeTemplate> {
  if (!mongoose.isValidObjectId(templateId)) {
    throw new Error("Invalid template id");
  }
  const t = await FeeTemplate.findOne({ _id: templateId, tenantId }).exec();
  if (!t) {
    throw new Error("Fee template not found");
  }
  return t;
}

export async function createFeeTemplate(
  tenantId: string,
  input: CreateFeeTemplateInput,
): Promise<ReturnType<typeof serializeFeeTemplate>> {
  validateTemplateInstallments(input);

  const created = await FeeTemplate.create({
    tenantId,
    title: input.title,
    description: input.description,
    feeType: input.feeType,
    category: input.category,
    totalAmount: input.totalAmount,
    isInstallment: input.isInstallment,
    defaultInstallments: input.isInstallment ? input.defaultInstallments : [],
    installmentAnchorDate: input.isInstallment
      ? input.installmentAnchorDate
      : undefined,
    defaultEndDate:
      !input.isInstallment && input.defaultEndDate?.trim()
        ? input.defaultEndDate.trim()
        : undefined,
    metadata: input.metadata,
    tags: input.tags,
  });

  return serializeFeeTemplate(created);
}

export interface ListFeeTemplatesParams {
  page: number;
  limit: number;
  feeType?: IFeeTemplate["feeType"];
}

export interface PaginatedFeeTemplates {
  data: ReturnType<typeof serializeFeeTemplate>[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export async function listFeeTemplates(
  tenantId: string,
  params: ListFeeTemplatesParams,
): Promise<PaginatedFeeTemplates> {
  const filter: mongoose.FilterQuery<IFeeTemplate> = { tenantId };
  if (params.feeType !== undefined) {
    filter.feeType = params.feeType;
  }

  const skip = (params.page - 1) * params.limit;

  const [docs, total] = await Promise.all([
    FeeTemplate.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(params.limit)
      .exec(),
    FeeTemplate.countDocuments(filter).exec(),
  ]);

  const totalPages = total === 0 ? 0 : Math.ceil(total / params.limit);

  return {
    data: docs.map(serializeFeeTemplate),
    total,
    page: params.page,
    limit: params.limit,
    totalPages,
  };
}

export async function getFeeTemplateById(
  tenantId: string,
  templateId: string,
): Promise<ReturnType<typeof serializeFeeTemplate> | null> {
  if (!mongoose.isValidObjectId(templateId)) {
    return null;
  }
  const doc = await FeeTemplate.findOne({ _id: templateId, tenantId }).exec();
  return doc ? serializeFeeTemplate(doc) : null;
}

export async function updateFeeTemplate(
  tenantId: string,
  templateId: string,
  input: CreateFeeTemplateInput,
): Promise<ReturnType<typeof serializeFeeTemplate> | null> {
  if (!mongoose.isValidObjectId(templateId)) {
    return null;
  }
  validateTemplateInstallments(input);

  const $set: Record<string, unknown> = {
    title: input.title,
    description: input.description,
    feeType: input.feeType,
    category: input.category,
    totalAmount: input.totalAmount,
    isInstallment: input.isInstallment,
    defaultInstallments: input.isInstallment ? input.defaultInstallments : [],
    metadata: input.metadata,
    tags: input.tags,
  };

  const $unset: Record<string, string> = {};

  if (input.isInstallment) {
    $set.installmentAnchorDate = input.installmentAnchorDate;
    $unset.defaultEndDate = "";
  } else {
    $unset.installmentAnchorDate = "";
    const de = input.defaultEndDate?.trim();
    if (de) $set.defaultEndDate = de;
    else $unset.defaultEndDate = "";
  }

  const updated = await FeeTemplate.findOneAndUpdate(
    { _id: templateId, tenantId },
    Object.keys($unset).length > 0 ? { $set, $unset } : { $set },
    { new: true, runValidators: true },
  ).exec();

  return updated ? serializeFeeTemplate(updated) : null;
}

export async function deleteFeeTemplate(
  tenantId: string,
  templateId: string,
): Promise<{ deleted: true } | null> {
  if (!mongoose.isValidObjectId(templateId)) {
    return null;
  }

  const existing = await FeeTemplate.findOne({
    _id: templateId,
    tenantId,
  }).exec();
  if (!existing) {
    return null;
  }

  const refCount = await Fee.countDocuments({
    tenantId,
    templateId,
    source: "TEMPLATE",
  }).exec();

  if (refCount > 0) {
    throw new Error(
      `Cannot delete: ${refCount} fee record(s) were created from this template`,
    );
  }

  await FeeTemplate.deleteOne({ _id: templateId, tenantId }).exec();
  return { deleted: true };
}

export async function assignFeeTemplateToStudents(
  tenantId: string,
  templateId: string,
  input: AssignTemplateInput,
): Promise<{
  assignedCount: number;
  skippedDuplicateCount: number;
}> {
  const template = await loadTemplateOrThrow(tenantId, templateId);
  validateTemplateInstallments(template);

  if (!template.isInstallment && input.customInstallments?.length) {
    throw new Error(
      "customInstallments can only be used with installment templates",
    );
  }

  const anchor = resolveInstallmentAssignmentAnchor(
    input.assignmentAnchorDate,
    template,
  );

  let candidateIds: string[];

  if (input.assignmentType === "STUDENTS") {
    if (!input.studentIds?.length) {
      throw new Error("studentIds is required for assignmentType STUDENTS");
    }
    candidateIds = [...new Set(input.studentIds)];
    if (candidateIds.length > MAX_ASSIGN_BY_IDS) {
      throw new Error(`studentIds must not exceed ${MAX_ASSIGN_BY_IDS}`);
    }
  } else if (input.assignmentType === "CLASS") {
    if (input.class === undefined) {
      throw new Error("class is required for assignmentType CLASS");
    }
    const docs = await Student.find({
      tenantId,
      class: input.class,
      ...(input.section !== undefined ? { section: input.section } : {}),
    })
      .select("_id")
      .limit(MAX_ASSIGN_BY_CLASS_FILTER + 1)
      .lean()
      .exec();

    if (docs.length > MAX_ASSIGN_BY_CLASS_FILTER) {
      throw new Error(
        `Too many students match this filter (max ${MAX_ASSIGN_BY_CLASS_FILTER}); narrow the filter`,
      );
    }
    candidateIds = docs.map((d) => d._id.toString());
  } else if (input.studentIds?.length) {
    candidateIds = [...new Set(input.studentIds)];
    if (candidateIds.length > MAX_ASSIGN_BY_IDS) {
      throw new Error(`studentIds must not exceed ${MAX_ASSIGN_BY_IDS}`);
    }
  } else if (input.class !== undefined) {
    const docs = await Student.find({
      tenantId,
      class: input.class,
      ...(input.section !== undefined ? { section: input.section } : {}),
    })
      .select("_id")
      .limit(MAX_ASSIGN_BY_CLASS_FILTER + 1)
      .lean()
      .exec();

    if (docs.length > MAX_ASSIGN_BY_CLASS_FILTER) {
      throw new Error(
        `Too many students match this filter (max ${MAX_ASSIGN_BY_CLASS_FILTER}); narrow the filter`,
      );
    }
    candidateIds = docs.map((d) => d._id.toString());
  } else {
    throw new Error("Either studentIds or class is required");
  }

  if (candidateIds.length === 0) {
    return { assignedCount: 0, skippedDuplicateCount: 0 };
  }

  if (input.studentIds?.length) {
    const found = await Student.find({
      _id: { $in: candidateIds },
      tenantId,
    })
      .select("_id")
      .lean()
      .exec();

    if (found.length !== candidateIds.length) {
      const foundSet = new Set(found.map((d) => d._id.toString()));
      const missing = candidateIds.filter((id) => !foundSet.has(id));
      throw new Error(
        `Student(s) not found for this tenant: ${missing.join(", ")}`,
      );
    }
  }

  const existing = await Fee.find({
    tenantId,
    templateId,
    source: "TEMPLATE",
    studentId: { $in: candidateIds },
  })
    .select("studentId")
    .lean()
    .exec();

  const existingSet = new Set(existing.map((e) => e.studentId));
  const eligibleIds = candidateIds.filter((id) => !existingSet.has(id));
  const skippedDuplicateCount = candidateIds.length - eligibleIds.length;

  if (eligibleIds.length === 0) {
    return { assignedCount: 0, skippedDuplicateCount };
  }

  const rows = eligibleIds.map((studentId) => ({
    studentId,
    merged: mergeAssignmentOverrides(
      template,
      input.feeOverrides,
      input.perStudentOverrides?.[studentId],
    ),
    principalDiscountPercent: resolvePrincipalDiscountPercent(
      input.feeOverrides,
      input.perStudentOverrides?.[studentId],
    ),
  }));

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    await bulkCreateFeesFromTemplateSnapshot(
      tenantId,
      template,
      rows,
      anchor,
      session,
      input.customInstallments,
    );
    await session.commitTransaction();
  } catch (e) {
    await session.abortTransaction();
    if (isDuplicateKeyError(e)) {
      throw new Error(
        "Duplicate template assignment for one or more students (already assigned)",
      );
    }
    throw e;
  } finally {
    session.endSession();
  }

  return {
    assignedCount: eligibleIds.length,
    skippedDuplicateCount,
  };
}
