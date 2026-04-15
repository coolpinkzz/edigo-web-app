import type { FeeDto, FeeStatus } from "./fee.types";

/** Mirrors `server/src/modules/student/student.model` enums for selects and typing. */

export type StudentStatus = "ACTIVE" | "INACTIVE" | "DROPPED";

export const STUDENT_STATUSES: StudentStatus[] = [
  "ACTIVE",
  "INACTIVE",
  "DROPPED",
];

export const STUDENT_CLASSES = [
  "Nursery",
  "KG",
  "Prep",
  "1st",
  "2nd",
  "3rd",
  "4th",
  "5th",
  "6th",
  "7th",
  "8th",
  "9th",
  "10th",
  "11th",
  "12th",
] as const;

export type StudentClass = (typeof STUDENT_CLASSES)[number];

export const STUDENT_SECTIONS = ["A", "B", "C", "D"] as const;

export type StudentSection = (typeof STUDENT_SECTIONS)[number];

/** Course summary on GET when tenant is ACADEMY and `courseId` is set. */
export interface StudentCourseSummary {
  id: string;
  name: string;
}

/** Serialized student from GET/POST/PATCH (tenant-shaped: school vs academy fields). */
export interface StudentDto {
  id: string;
  tenantId: string;
  studentName: string;
  scholarId?: string;
  parentName: string;
  parentPhoneNumber: string;
  panNumber?: string;
  class: StudentClass | null;
  section: StudentSection | null;
  courseId: string | null;
  course?: StudentCourseSummary;
  status: StudentStatus;
  joinedAt?: string;
  createdAt: string;
  updatedAt: string;
  /** Present on POST /students when `feeTemplateId` was sent and fee creation succeeded. */
  feeFromTemplate?: FeeDto;
}

export interface PaginatedStudents {
  data: StudentDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** Form state for create / edit (maps to POST/PATCH bodies in `student.api`). */
export interface CreateStudentFormValues {
  studentName: string;
  parentName: string;
  parentPhoneNumber: string;
  scholarId: string;
  panNumber: string;
  /** Used when tenant is SCHOOL. */
  class: StudentClass | "";
  section: StudentSection | "";
  /** Used when tenant is ACADEMY (catalog id). */
  courseId: string;
  /** Create only: optional fee template id (POST /students `feeTemplateId`). */
  feeTemplateId: string;
  /** Create only: optional principal discount percentage (0-100) for selected fee template. */
  feeTemplateDiscountPercent: string;
  /** Create only: YYYY-MM-DD for installment anchor (optional). */
  assignmentAnchorDate: string;
  /** Create only: optional fee due date when assigning a template (`feeOverrides.endDate`). */
  feeEndDate: string;
  /** Create only: installment template path — default OFF. */
  useCustomInstallments: boolean;
  /** Create only: optional custom student-level installment structure. */
  customInstallments: {
    amount: number;
    dueDate: string;
  }[];
}

export const STUDENT_CLASS_OPTIONS: { value: StudentClass; label: string }[] =
  STUDENT_CLASSES.map((c) => ({ value: c, label: c }));

export const STUDENT_SECTION_OPTIONS: {
  value: StudentSection;
  label: string;
}[] = STUDENT_SECTIONS.map((s) => ({ value: s, label: `Section ${s}` }));

/** Row returned from POST /students/import/validate (ready for confirm). */
export interface StudentImportValidRow {
  rowIndex: number;
  studentName: string;
  scholarId: string;
  parentName: string;
  parentPhoneNumber: string;
  panNumber: string;
  class: StudentClass;
  section: StudentSection;
}

export interface StudentImportInvalidRow {
  rowIndex: number;
  row: Record<string, string>;
  errors: string[];
}

export interface ValidateStudentImportResponse {
  validRows: StudentImportValidRow[];
  invalidRows: StudentImportInvalidRow[];
}

/** GET /students/fee-overview — mirrors `student-fee-overview.service`. */
export type StudentFeeOverviewSortBy =
  | "studentName"
  | "class"
  | "pendingTotal"
  | "createdAt";

export interface StudentFeeSummaryDto {
  feeCount: number;
  pendingTotal: number;
  paidTotal: number;
  totalDue: number;
  rollupStatus: FeeStatus | null;
  countsByStatus: Record<FeeStatus, number>;
}

export interface StudentFeeOverviewRowDto {
  student: StudentDto;
  fees: FeeDto[];
  feeSummary: StudentFeeSummaryDto;
}

export interface PaginatedStudentFeeOverview {
  data: StudentFeeOverviewRowDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
