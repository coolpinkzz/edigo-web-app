import type {
  CourseDto,
  CreateCourseBody,
  PaginatedCourses,
} from "../types";
import { apiClient } from "./client";

export interface ListCoursesParams {
  page?: number;
  limit?: number;
  includeInactive?: boolean;
}

export async function listCourses(
  params: ListCoursesParams = {},
): Promise<PaginatedCourses> {
  const { data } = await apiClient.get<PaginatedCourses>("/courses", {
    params: {
      page: params.page ?? 1,
      limit: params.limit ?? 50,
      includeInactive: params.includeInactive,
    },
  });
  return data;
}

export async function getCourse(courseId: string): Promise<CourseDto> {
  const { data } = await apiClient.get<CourseDto>(`/courses/${courseId}`);
  return data;
}

export async function createCourse(body: CreateCourseBody): Promise<CourseDto> {
  const { data } = await apiClient.post<CourseDto>("/courses", body);
  return data;
}

export async function updateCourse(
  courseId: string,
  body: Partial<CreateCourseBody>,
): Promise<CourseDto> {
  const { data } = await apiClient.patch<CourseDto>(
    `/courses/${courseId}`,
    body,
  );
  return data;
}

export async function deleteCourse(courseId: string): Promise<void> {
  await apiClient.delete(`/courses/${courseId}`);
}
