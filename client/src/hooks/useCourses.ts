import { useQuery } from "@tanstack/react-query";
import { listCourses } from "../api/course.api";
import type { ListCoursesParams } from "../api/course.api";
import { coursesQueryKey } from "../constants/query-keys";

export function useCourses(
  params: ListCoursesParams = {},
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: [...coursesQueryKey, params] as const,
    queryFn: () => listCourses(params),
    enabled: options?.enabled ?? true,
  });
}
