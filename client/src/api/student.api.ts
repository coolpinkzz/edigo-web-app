import type {
  CreateStudentFormValues,
  FeeStatus,
  FeeType,
  PaginatedStudentFeeOverview,
  PaginatedStudents,
  StudentDto,
  StudentClass,
  StudentFeeOverviewSortBy,
  StudentImportValidRow,
  StudentSection,
  StudentStatus,
  TenantType,
  ValidateStudentImportResponse,
} from "../types";
import { ymdToBusinessMidnightIso } from "../utils/timezone";
import { apiClient } from "./client";

export interface ListStudentsParams {
  page?: number;
  limit?: number;
  class?: StudentClass;
  section?: StudentSection;
  status?: StudentStatus;
  /** Case-insensitive match on name, admission ID, or scholar ID (server). */
  search?: string;
}

export interface StudentFeeOverviewParams {
  page?: number;
  limit?: number;
  studentStatus?: StudentStatus;
  class?: StudentClass;
  section?: StudentSection;
  search?: string;
  /** When non-empty, server keeps students with at least one fee matching these statuses. */
  feeStatuses?: FeeStatus[];
  /** When non-empty, same for fee types. */
  feeTypes?: FeeType[];
  sortBy?: StudentFeeOverviewSortBy;
  sortDir?: "asc" | "desc";
}

function trimOrEmpty(s: string): string {
  return s.trim();
}

function trimOrUndefined(s: string): string | undefined {
  const t = s.trim();
  return t === "" ? undefined : t;
}

function normalizeTenDigitPhone(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 10);
}

export function studentToFormValues(s: StudentDto): CreateStudentFormValues {
  return {
    studentName: s.studentName,
    parentName: s.parentName,
    parentPhoneNumber: s.parentPhoneNumber,
    scholarId: s.scholarId ?? "",
    panNumber: s.panNumber ?? "",
    class: s.class ?? "1st",
    section: s.section ?? "A",
    courseId: s.courseId ?? "",
    feeTemplateId: "",
    assignmentAnchorDate: "",
    feeEndDate: "",
    useCustomInstallments: false,
    customInstallments: [],
  };
}


export function buildStudentJsonBody(
  values: CreateStudentFormValues,
  tenantType: TenantType,
  options?: {
    includeFeeAssignment?: boolean;
    /** When set, only the matching schedule fields are sent (installment anchor vs lump-sum due date). */
    feeTemplateIsInstallment?: boolean;
  },
): Record<string, unknown> {
  const parentPhoneNumber = normalizeTenDigitPhone(values.parentPhoneNumber);

  const studentBody: Record<string, unknown> = {
    studentName: trimOrEmpty(values.studentName),
    parentName: trimOrEmpty(values.parentName),
    parentPhoneNumber,
  };

  const scholarId = trimOrUndefined(values.scholarId);
  if (scholarId !== undefined) studentBody.scholarId = scholarId;

  const pan = trimOrEmpty(values.panNumber).toUpperCase();
  if (pan !== "") studentBody.panNumber = pan;

  if (tenantType === "SCHOOL") {
    studentBody.class = values.class;
    studentBody.section = values.section;
    const cid = trimOrUndefined(values.courseId);
    if (cid !== undefined) studentBody.courseId = cid;
  } else {
    studentBody.courseId = trimOrEmpty(values.courseId);
  }

  let feeAssignment: Record<string, unknown> | undefined;
  if (options?.includeFeeAssignment) {
    const tid = trimOrUndefined(values.feeTemplateId ?? "");
    if (tid !== undefined) {
      feeAssignment = {
        templateId: tid,
      };
      const isInst = options.feeTemplateIsInstallment === true;
      const isLump = options.feeTemplateIsInstallment === false;
      if (isInst) {
        const anchor = trimOrUndefined(values.assignmentAnchorDate ?? "");
        if (anchor !== undefined) {
          feeAssignment.assignmentAnchorDate = ymdToBusinessMidnightIso(anchor);
        }
        const customInstallments = values.customInstallments
          .map((row) => ({
            amount: Number(row.amount),
            dueDate: trimOrEmpty(row.dueDate),
          }))
          .filter((row) => row.dueDate !== "");
        if (values.useCustomInstallments) {
          feeAssignment.useCustomInstallments = true;
          feeAssignment.customInstallments = customInstallments.map((row) => ({
            amount: row.amount,
            dueDate: ymdToBusinessMidnightIso(row.dueDate),
          }));
        } else {
          feeAssignment.useCustomInstallments = false;
        }
      }
      if (isLump) {
        const feeEnd = trimOrUndefined(values.feeEndDate ?? "");
        if (feeEnd !== undefined) {
          feeAssignment.feeOverrides = {
            endDate: ymdToBusinessMidnightIso(feeEnd),
          };
        }
      }
    }
  }
  if (options?.includeFeeAssignment) {
    return {
      student: studentBody,
      ...(feeAssignment ? { feeAssignment } : {}),
    };
  }

  return studentBody;
}

export async function getStudentFeeOverview(
  params: StudentFeeOverviewParams = {},
): Promise<PaginatedStudentFeeOverview> {
  const { data } = await apiClient.get<PaginatedStudentFeeOverview>(
    "/students/fee-overview",
    {
      params: {
        page: params.page ?? 1,
        limit: params.limit ?? 20,
        studentStatus: params.studentStatus,
        class: params.class,
        section: params.section,
        search: params.search,
        feeStatuses:
          params.feeStatuses?.length !== undefined &&
          params.feeStatuses.length > 0
            ? params.feeStatuses.join(",")
            : undefined,
        feeTypes:
          params.feeTypes?.length !== undefined && params.feeTypes.length > 0
            ? params.feeTypes.join(",")
            : undefined,
        sortBy: params.sortBy ?? "studentName",
        sortDir: params.sortDir ?? "asc",
      },
    },
  );
  return data;
}

export async function listStudents(
  params: ListStudentsParams = {},
): Promise<PaginatedStudents> {
  const { data } = await apiClient.get<PaginatedStudents>("/students", {
    params: {
      page: params.page ?? 1,
      limit: params.limit ?? 20,
      class: params.class,
      section: params.section,
      status: params.status,
      search: params.search,
    },
  });
  return data;
}

export async function getStudent(studentId: string): Promise<StudentDto> {
  const { data } = await apiClient.get<StudentDto>(`/students/${studentId}`);
  return data;
}

export async function createStudent(
  values: CreateStudentFormValues,
  tenantType: TenantType,
  options?: { feeTemplateIsInstallment?: boolean },
): Promise<StudentDto> {
  const { data } = await apiClient.post<StudentDto>(
    "/students/create",
    buildStudentJsonBody(values, tenantType, {
      includeFeeAssignment: true,
      feeTemplateIsInstallment: options?.feeTemplateIsInstallment,
    }),
  );
  return data;
}

export async function updateStudent(
  studentId: string,
  values: CreateStudentFormValues,
  tenantType: TenantType,
): Promise<StudentDto> {
  const { data } = await apiClient.patch<StudentDto>(
    `/students/${studentId}`,
    buildStudentJsonBody(values, tenantType),
  );
  return data;
}

export async function deleteStudent(studentId: string): Promise<void> {
  await apiClient.delete(`/students/${studentId}`);
}

export async function validateStudentImport(
  file: File,
): Promise<ValidateStudentImportResponse> {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await apiClient.post<ValidateStudentImportResponse>(
    "/students/import/validate",
    formData,
    {
      transformRequest: [
        (body, headers) => {
          if (body instanceof FormData) {
            delete headers["Content-Type"];
          }
          return body;
        },
      ],
    },
  );
  return data;
}

export async function confirmStudentImport(
  validRows: StudentImportValidRow[],
): Promise<{ inserted: number }> {
  const { data } = await apiClient.post<{ inserted: number }>(
    "/students/import/confirm",
    { validRows },
  );
  return data;
}
