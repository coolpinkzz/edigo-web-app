import mongoose, { FilterQuery } from "mongoose";
import { Student } from "../student/student.model";
import { Course, ICourse } from "./course.model";

export interface CreateCourseInput {
  name: string;
  shortCode?: string;
  description?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export type UpdateCourseInput = Partial<CreateCourseInput>;

export interface ListCoursesParams {
  page: number;
  limit: number;
  /** When false (default), only active courses. */
  includeInactive?: boolean;
}

export function serializeCourse(doc: ICourse) {
  return {
    id: doc._id.toString(),
    tenantId: doc.tenantId,
    name: doc.name,
    shortCode: doc.shortCode,
    description: doc.description,
    sortOrder: doc.sortOrder,
    isActive: doc.isActive,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

/**
 * Ensures `courseId` is a valid course in this tenant. Call when student.courseId is set.
 */
export async function assertCourseBelongsToTenant(
  tenantId: string,
  courseId: string | undefined,
): Promise<void> {
  if (courseId === undefined || courseId === null || courseId === "") {
    return;
  }
  if (!mongoose.isValidObjectId(courseId)) {
    throw new Error("courseId must be a valid course id");
  }
  const exists = await Course.findOne({
    _id: courseId,
    tenantId,
  })
    .select("_id")
    .lean()
    .exec();
  if (!exists) {
    throw new Error("Course not found for this tenant");
  }
}

export async function createCourse(
  tenantId: string,
  input: CreateCourseInput,
): Promise<ReturnType<typeof serializeCourse>> {
  const created = await Course.create({
    tenantId,
    name: input.name,
    shortCode: input.shortCode,
    description: input.description,
    sortOrder: input.sortOrder ?? 0,
    isActive: input.isActive ?? true,
  });
  return serializeCourse(created);
}

export async function listCourses(
  tenantId: string,
  params: ListCoursesParams,
): Promise<{
  data: ReturnType<typeof serializeCourse>[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  const filter: FilterQuery<ICourse> = { tenantId };
  if (!params.includeInactive) {
    filter.isActive = true;
  }

  const skip = (params.page - 1) * params.limit;

  const [docs, total] = await Promise.all([
    Course.find(filter)
      .sort({ sortOrder: 1, name: 1 })
      .skip(skip)
      .limit(params.limit)
      .exec(),
    Course.countDocuments(filter).exec(),
  ]);

  const totalPages = total === 0 ? 0 : Math.ceil(total / params.limit);

  return {
    data: docs.map(serializeCourse),
    total,
    page: params.page,
    limit: params.limit,
    totalPages,
  };
}

export async function getCourseById(
  tenantId: string,
  id: string,
): Promise<ReturnType<typeof serializeCourse> | null> {
  if (!mongoose.isValidObjectId(id)) {
    return null;
  }
  const doc = await Course.findOne({ _id: id, tenantId }).exec();
  return doc ? serializeCourse(doc) : null;
}

export async function updateCourse(
  tenantId: string,
  id: string,
  input: UpdateCourseInput,
): Promise<ReturnType<typeof serializeCourse> | null> {
  if (!mongoose.isValidObjectId(id)) {
    return null;
  }
  const doc = await Course.findOneAndUpdate(
    { _id: id, tenantId },
    { $set: input },
    { new: true, runValidators: true },
  ).exec();
  return doc ? serializeCourse(doc) : null;
}

export async function deleteCourse(
  tenantId: string,
  id: string,
): Promise<{ ok: true } | { ok: false; reason: "not_found" | "in_use" }> {
  if (!mongoose.isValidObjectId(id)) {
    return { ok: false, reason: "not_found" };
  }

  const inUse = await Student.countDocuments({
    tenantId,
    courseId: id,
  }).exec();
  if (inUse > 0) {
    return { ok: false, reason: "in_use" };
  }

  const result = await Course.deleteOne({ _id: id, tenantId }).exec();
  if (result.deletedCount !== 1) {
    return { ok: false, reason: "not_found" };
  }
  return { ok: true };
}
