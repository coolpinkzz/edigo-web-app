import mongoose, { FilterQuery } from "mongoose";
import { Tenant } from "../auth/tenant.model";
import { Course } from "../course/course.model";
import { assertCourseBelongsToTenant } from "../course/course.service";
import {
  createFeeFromTemplateSnapshot,
  CustomAssignmentInstallmentRow,
  parseTemplateYmdIst,
  resolveInstallmentAssignmentAnchor,
  serializeFee,
} from "../fee/fee.service";
import type { FeeTemplateCreateOverrides } from "../fee/fee.types";
import { FeeTemplate, IFeeTemplate } from "../fee-template/fee-template.model";
import { TenantType } from "../../types/tenant";
import {
  IStudent,
  Student,
  StudentClass,
  StudentSection,
  StudentStatus,
} from "./student.model";

export interface CreateStudentInput {
  studentName: string;
  admissionId?: string;
  scholarId?: string;
  parentName: string;
  parentPhoneNumber: string;
  alternatePhone?: string;
  parentEmail?: string;
  panNumber?: string;
  class?: StudentClass;
  section?: StudentSection;
  courseId?: string;
  status?: StudentStatus;
  joinedAt?: Date;
  leftAt?: Date;
  tags?: string[];
  /** When set, a fee is created from this template after the student row is inserted. */
  feeTemplateId?: string;
  assignmentAnchorDate?: Date;
  feeOverrides?: FeeTemplateCreateOverrides;
  useCustomInstallments?: boolean;
  customInstallments?: CustomAssignmentInstallmentRow[];
}

export type UpdateStudentInput = Partial<CreateStudentInput>;

export interface ListStudentsParams {
  page: number;
  limit: number;
  status?: StudentStatus;
  class?: StudentClass;
  section?: StudentSection;
  /** Case-insensitive substring match on studentName, admissionId, or scholarId. */
  search?: string;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeCourseId(
  courseId: string | undefined | null,
): string | undefined {
  if (courseId === undefined || courseId === null || courseId === "") {
    return undefined;
  }
  return courseId;
}

export async function getTenantType(tenantId: string): Promise<TenantType> {
  const t = await Tenant.findById(tenantId).select("tenantType").lean().exec();
  return t?.tenantType ?? "SCHOOL";
}

/** GET responses: academy rows never surface class/section; school rows keep them. */
export function applyTenantResponseShape(
  tenantType: TenantType,
  s: SerializedStudent,
): SerializedStudent {
  if (tenantType === "ACADEMY") {
    return { ...s, class: null, section: null };
  }
  return s;
}

export interface SerializedStudent {
  id: string;
  tenantId: string;
  studentName: string;
  admissionId?: string;
  scholarId?: string;
  parentName: string;
  parentPhoneNumber: string;
  alternatePhone?: string;
  parentEmail?: string;
  panNumber?: string;
  class: StudentClass | null;
  section: StudentSection | null;
  courseId: string | null;
  status: StudentStatus;
  joinedAt?: Date;
  leftAt?: Date;
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export type StudentPublic = SerializedStudent & {
  course?: { id: string; name: string };
};

/** POST /students when `feeTemplateId` was provided and fee creation succeeded. */
export type StudentCreatedResult = StudentPublic & {
  feeFromTemplate?: ReturnType<typeof serializeFee>;
};

export interface PaginatedStudents {
  data: StudentPublic[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function serializeStudent(doc: IStudent): SerializedStudent {
  return {
    id: doc._id.toString(),
    tenantId: doc.tenantId,
    studentName: doc.studentName,
    admissionId: doc.admissionId,
    scholarId: doc.scholarId,
    parentName: doc.parentName,
    parentPhoneNumber: doc.parentPhoneNumber,
    alternatePhone: doc.alternatePhone,
    parentEmail: doc.parentEmail,
    panNumber: doc.panNumber,
    class: doc.class ?? null,
    section: doc.section ?? null,
    courseId: doc.courseId ?? null,
    status: doc.status,
    joinedAt: doc.joinedAt,
    leftAt: doc.leftAt,
    tags: doc.tags,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

/** Batch-load course names for GET responses (academy tenants only). */
export async function attachCourseSummaries(
  tenantId: string,
  tenantType: TenantType,
  rows: SerializedStudent[],
): Promise<StudentPublic[]> {
  if (tenantType !== "ACADEMY") {
    return rows.map((r) => ({ ...r }));
  }

  const ids = [
    ...new Set(
      rows
        .map((r) => r.courseId)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  ];
  if (ids.length === 0) {
    return rows.map((r) => ({ ...r }));
  }

  const courses = await Course.find({
    tenantId,
    _id: { $in: ids },
  })
    .select({ name: 1 })
    .lean()
    .exec();

  const map = new Map(courses.map((c) => [String(c._id), String(c.name)]));

  return rows.map((r) => {
    const courseId = r.courseId;
    if (!courseId || !map.has(courseId)) {
      return { ...r };
    }
    return {
      ...r,
      course: { id: courseId, name: map.get(courseId)! },
    };
  });
}

function mergeStudentAssignmentOverrides(
  template: IFeeTemplate,
  overrides?: FeeTemplateCreateOverrides,
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
    title: overrides?.title ?? template.title,
    description: overrides?.description ?? template.description,
    category: overrides?.category ?? template.category,
    metadata: overrides?.metadata ?? template.metadata,
    startDate: overrides?.startDate,
    endDate: overrides?.endDate ?? parseTemplateYmdIst(template.defaultEndDate),
    tags: overrides?.tags ?? template.tags,
  };
}

function validateTemplateForStudentAssignment(template: IFeeTemplate): void {
  if (!template.isInstallment) {
    if (template.defaultInstallments?.length) {
      throw new Error(
        "Non-installment templates must not include defaultInstallments",
      );
    }
    return;
  }

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
  for (const row of template.defaultInstallments) {
    if (row.amount <= 0) {
      throw new Error("Each default installment amount must be positive");
    }
  }
}

async function assignFeeFromTemplateInTransaction(
  tenantId: string,
  studentId: string,
  input: CreateStudentInput,
  session: mongoose.ClientSession,
): Promise<ReturnType<typeof serializeFee> | undefined> {
  const tid = input.feeTemplateId?.trim();
  if (!tid) return undefined;

  if (!mongoose.isValidObjectId(tid)) {
    throw new Error("Invalid template id");
  }

  const template = await FeeTemplate.findOne({ _id: tid, tenantId })
    .session(session)
    .exec();
  if (!template) {
    throw new Error("Fee template not found");
  }

  validateTemplateForStudentAssignment(template);
  const merged = mergeStudentAssignmentOverrides(template, input.feeOverrides);
  const anchor = resolveInstallmentAssignmentAnchor(
    input.assignmentAnchorDate,
    template,
  );

  let customInstallments: CustomAssignmentInstallmentRow[] | undefined;
  if (template.isInstallment && input.useCustomInstallments === true) {
    if (!input.customInstallments?.length) {
      throw new Error(
        "customInstallments is required when useCustomInstallments is true",
      );
    }
    customInstallments = input.customInstallments;
  }

  return createFeeFromTemplateSnapshot(
    tenantId,
    template,
    studentId,
    anchor,
    merged,
    session,
    customInstallments,
  );
}

function createStudentDocPayload(
  tenantId: string,
  input: CreateStudentInput,
  courseId: string | undefined,
): Record<string, unknown> {
  return {
    tenantId,
    studentName: input.studentName,
    admissionId: input.admissionId,
    scholarId: input.scholarId,
    parentName: input.parentName,
    parentPhoneNumber: input.parentPhoneNumber,
    alternatePhone: input.alternatePhone,
    parentEmail: input.parentEmail,
    panNumber: input.panNumber,
    class: input.class,
    section: input.section,
    courseId,
    status: input.status ?? "ACTIVE",
    joinedAt: input.joinedAt,
    leftAt: input.leftAt,
    tags: input.tags,
  };
}

export async function createStudent(
  tenantId: string,
  input: CreateStudentInput,
): Promise<StudentCreatedResult> {
  const tenantType = await getTenantType(tenantId);
  const courseId = normalizeCourseId(input.courseId);

  if (tenantType === "SCHOOL") {
    if (!input.class || !input.section) {
      throw new Error("class and section are required for school tenants");
    }
    await assertCourseBelongsToTenant(tenantId, courseId);

    const session = await mongoose.startSession();
    let created: IStudent;
    let feeFromTemplate: ReturnType<typeof serializeFee> | undefined;
    try {
      session.startTransaction();
      const docs = await Student.create(
        [createStudentDocPayload(tenantId, input, courseId)],
        { session },
      );
      created = docs[0] as IStudent;
      feeFromTemplate = await assignFeeFromTemplateInTransaction(
        tenantId,
        created._id.toString(),
        input,
        session,
      );
      await session.commitTransaction();
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }

    const s = applyTenantResponseShape(tenantType, serializeStudent(created));
    const row = (await attachCourseSummaries(tenantId, tenantType, [s]))[0]!;
    return feeFromTemplate ? { ...row, feeFromTemplate } : row;
  }

  if (!courseId) {
    throw new Error("courseId is required for academy tenants");
  }
  await assertCourseBelongsToTenant(tenantId, courseId);

  const session = await mongoose.startSession();
  let created: IStudent;
  let feeFromTemplate: ReturnType<typeof serializeFee> | undefined;
  try {
    session.startTransaction();
    const docs = await Student.create(
      [createStudentDocPayload(tenantId, input, courseId)],
      { session },
    );
    created = docs[0] as IStudent;
    feeFromTemplate = await assignFeeFromTemplateInTransaction(
      tenantId,
      created._id.toString(),
      input,
      session,
    );
    await session.commitTransaction();
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }

  const s = applyTenantResponseShape(tenantType, serializeStudent(created));
  const row = (await attachCourseSummaries(tenantId, tenantType, [s]))[0]!;
  return feeFromTemplate ? { ...row, feeFromTemplate } : row;
}

export async function listStudents(
  tenantId: string,
  params: ListStudentsParams,
): Promise<PaginatedStudents> {
  const filter: FilterQuery<IStudent> = { tenantId };

  if (params.status !== undefined) {
    filter.status = params.status;
  }
  if (params.class !== undefined) {
    filter.class = params.class;
  }
  if (params.section !== undefined) {
    filter.section = params.section;
  }

  const q = params.search?.trim();
  if (q) {
    const rx = new RegExp(escapeRegex(q), "i");
    filter.$or = [{ studentName: rx }, { admissionId: rx }, { scholarId: rx }];
  }

  const skip = (params.page - 1) * params.limit;

  const [docs, total] = await Promise.all([
    Student.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(params.limit)
      .exec(),
    Student.countDocuments(filter).exec(),
  ]);

  const totalPages = total === 0 ? 0 : Math.ceil(total / params.limit);

  const tenantType = await getTenantType(tenantId);
  const serialized = docs.map((d) =>
    applyTenantResponseShape(tenantType, serializeStudent(d)),
  );
  const data = await attachCourseSummaries(tenantId, tenantType, serialized);

  return {
    data,
    total,
    page: params.page,
    limit: params.limit,
    totalPages,
  };
}

export async function getStudentById(
  tenantId: string,
  id: string,
): Promise<StudentPublic | null> {
  if (!mongoose.isValidObjectId(id)) {
    return null;
  }
  const doc = await Student.findOne({ _id: id, tenantId }).exec();
  if (!doc) {
    return null;
  }
  const tenantType = await getTenantType(tenantId);
  const s = applyTenantResponseShape(tenantType, serializeStudent(doc));
  return (await attachCourseSummaries(tenantId, tenantType, [s]))[0]!;
}

export async function updateStudent(
  tenantId: string,
  id: string,
  input: UpdateStudentInput,
): Promise<StudentPublic | null> {
  if (!mongoose.isValidObjectId(id)) {
    return null;
  }

  const existing = await Student.findOne({ _id: id, tenantId }).exec();
  if (!existing) {
    return null;
  }

  const tenantType = await getTenantType(tenantId);

  const patch: UpdateStudentInput = { ...input };
  if (tenantType === "ACADEMY") {
    if (input.class !== undefined || input.section !== undefined) {
      throw new Error("class and section are not used for academy tenants");
    }
    delete patch.class;
    delete patch.section;
  }

  if (Object.prototype.hasOwnProperty.call(patch, "courseId")) {
    patch.courseId = normalizeCourseId(patch.courseId);
    await assertCourseBelongsToTenant(tenantId, patch.courseId);
  }

  const nextClass =
    patch.class !== undefined ? patch.class : existing.class;
  const nextSection =
    patch.section !== undefined ? patch.section : existing.section;
  const nextCourseId = Object.prototype.hasOwnProperty.call(patch, "courseId")
    ? normalizeCourseId(patch.courseId)
    : existing.courseId;

  if (tenantType === "SCHOOL") {
    if (!nextClass || !nextSection) {
      throw new Error("class and section are required for school tenants");
    }
  } else if (!nextCourseId) {
    throw new Error("courseId is required for academy tenants");
  }

  const doc = await Student.findOneAndUpdate(
    { _id: id, tenantId },
    { $set: patch },
    { new: true, runValidators: true },
  ).exec();
  if (!doc) {
    return null;
  }
  const s = applyTenantResponseShape(tenantType, serializeStudent(doc));
  return (await attachCourseSummaries(tenantId, tenantType, [s]))[0]!;
}

export async function deleteStudent(
  tenantId: string,
  id: string,
): Promise<boolean> {
  if (!mongoose.isValidObjectId(id)) {
    return false;
  }
  const result = await Student.deleteOne({ _id: id, tenantId }).exec();
  return result.deletedCount === 1;
}
