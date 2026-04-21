import type {
  CreateStudentFormValues,
  FeeStatus,
  FeeType,
  PaginatedStudentFeeOverview,
  PaginatedStudents,
  StudentDto,
  StudentClass,
  StudentFeeOverviewSortBy,
  StudentGender,
  StudentImportValidRow,
  StudentSection,
  StudentStatus,
  TenantType,
  ValidateStudentImportResponse,
} from "../types";
import { ymdToBusinessMidnightIso } from "../utils/timezone";
import { apiClient } from "./client";

const ALLOWED_STUDENT_PHOTO_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

/** Max upload size (must match server presign policy). */
export const STUDENT_PHOTO_MAX_BYTES = 5 * 1024 * 1024;

export async function uploadStudentPhotoAndGetUrl(
  studentId: string,
  file: File,
): Promise<string> {
  if (file.size > STUDENT_PHOTO_MAX_BYTES) {
    throw new Error("Photo must be at most 5 MB.");
  }
  const contentType = file.type;
  if (!ALLOWED_STUDENT_PHOTO_TYPES.has(contentType)) {
    throw new Error("Choose a JPEG, PNG, WebP, or GIF image.");
  }
  const { data } = await apiClient.post<{
    uploadUrl: string;
    publicUrl: string;
    expiresIn: number;
    maxBytes: number;
  }>(`/students/${studentId}/photo/presign`, { contentType });
  const res = await fetch(data.uploadUrl, {
    method: "PUT",
    body: file,
    headers: {
      "Content-Type": contentType,
    },
  });
  if (!res.ok) {
    throw new Error(
      "Could not upload the photo. Check storage settings or try again.",
    );
  }
  return data.publicUrl;
}

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
    alternatePhone: s.alternatePhone ?? "",
    scholarId: s.scholarId ?? "",
    panNumber: s.panNumber ?? "",
    dateOfBirth: s.dateOfBirth ? String(s.dateOfBirth).slice(0, 10) : "",
    gender: (s.gender as StudentGender | undefined) ?? "",
    address: s.address ?? "",
    class: s.class ?? "1st",
    section: s.section ?? "A",
    courseId: s.courseId ?? "",
    courseDurationMonths:
      s.courseDurationMonths != null ? String(s.courseDurationMonths) : "",
    feeTemplateId: "",
    feeTemplateDiscountPercent: "",
    assignmentAnchorDate: "",
    feeEndDate: "",
    useCustomInstallments: false,
    customInstallments: [],
    photoUrl: s.photoUrl ?? "",
  };
}

export function buildStudentJsonBody(
  values: CreateStudentFormValues,
  tenantType: TenantType,
  options?: {
    includeFeeAssignment?: boolean;
    /** When set, only the matching schedule fields are sent (installment anchor vs lump-sum due date). */
    feeTemplateIsInstallment?: boolean;
    /** PATCH: send null for cleared optional profile fields. */
    forPatch?: boolean;
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

  const altDigits = normalizeTenDigitPhone(values.alternatePhone ?? "");

  const forPatch = options?.forPatch === true;
  const dobRaw = trimOrEmpty(values.dateOfBirth ?? "");
  const genderRaw = trimOrEmpty(values.gender ?? "");
  const addrRaw = trimOrEmpty(values.address ?? "");
  if (forPatch) {
    studentBody.dateOfBirth = dobRaw === "" ? null : dobRaw;
    studentBody.gender = genderRaw === "" ? null : genderRaw;
    studentBody.address = addrRaw === "" ? null : addrRaw;
    studentBody.alternatePhone = altDigits === "" ? null : altDigits;
  } else {
    if (dobRaw !== "") studentBody.dateOfBirth = dobRaw;
    if (genderRaw !== "") studentBody.gender = genderRaw;
    if (addrRaw !== "") studentBody.address = addrRaw;
    if (altDigits !== "") studentBody.alternatePhone = altDigits;
  }

  const photoRaw = trimOrEmpty(values.photoUrl ?? "");
  if (forPatch) {
    studentBody.photoUrl = photoRaw === "" ? null : photoRaw;
  } else if (photoRaw !== "") {
    studentBody.photoUrl = photoRaw;
  }

  if (tenantType === "SCHOOL") {
    studentBody.class = values.class;
    studentBody.section = values.section;
    const cid = trimOrUndefined(values.courseId);
    if (cid !== undefined) studentBody.courseId = cid;
  } else {
    studentBody.courseId = trimOrEmpty(values.courseId);
    const cdRaw = trimOrEmpty(values.courseDurationMonths ?? "");
    const cdNum = Number(cdRaw);
    const valid =
      cdRaw !== "" && Number.isInteger(cdNum) && cdNum >= 1 && cdNum <= 12;
    if (forPatch) {
      studentBody.courseDurationMonths = valid ? cdNum : null;
    } else if (valid) {
      studentBody.courseDurationMonths = cdNum;
    }
  }

  let feeAssignment: Record<string, unknown> | undefined;
  if (options?.includeFeeAssignment) {
    const tid = trimOrUndefined(values.feeTemplateId ?? "");
    if (tid !== undefined) {
      feeAssignment = {
        templateId: tid,
      };
      const discountRaw = trimOrUndefined(
        values.feeTemplateDiscountPercent ?? "",
      );
      if (discountRaw !== undefined) {
        const discount = Number(discountRaw);
        if (Number.isFinite(discount)) {
          feeAssignment.discount = discount;
        }
      }
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
    buildStudentJsonBody(values, tenantType, { forPatch: true }),
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
