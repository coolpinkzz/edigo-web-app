/** GET /courses — serialized course row. */
export interface CourseDto {
  id: string;
  tenantId: string;
  name: string;
  shortCode?: string;
  description?: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedCourses {
  data: CourseDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreateCourseBody {
  name: string;
  shortCode?: string;
  description?: string;
  sortOrder?: number;
  isActive?: boolean;
}
