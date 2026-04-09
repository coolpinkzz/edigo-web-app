import type {
  AssignTemplateToFeesPayload,
  AssignTemplateToFeesResult,
  FeeDto,
  FeeType,
  FeeWithInstallments,
  ManualPaymentMethod,
  PaginatedFees,
  PaginatedOverdueFees,
  FeeStatus,
  PatchFeePayload,
  UpdateFeePaymentPayload,
  UpdateInstallmentPayload,
  UpdateInstallmentResult,
} from "../types";
import { apiClient } from "./client";

export interface ListFeesParams {
  page?: number;
  limit?: number;
  studentId?: string;
  status?: FeeStatus;
  feeType?: FeeType;
}

export interface ListOverdueFeesParams {
  page?: number;
  limit?: number;
  feeType?: FeeType;
  class?: string;
  /** Academy tenants: filter by student course id. */
  courseId?: string;
  search?: string;
}

export async function listFees(
  params: ListFeesParams = {},
): Promise<PaginatedFees> {
  const { data } = await apiClient.get<PaginatedFees>("/fees", {
    params: {
      page: params.page ?? 1,
      limit: params.limit ?? 50,
      studentId: params.studentId,
      status: params.status,
      feeType: params.feeType,
    },
  });
  return data;
}

export async function listOverdueFees(
  params: ListOverdueFeesParams = {},
): Promise<PaginatedOverdueFees> {
  const { data } = await apiClient.get<PaginatedOverdueFees>("/fees/overdue", {
    params: {
      page: params.page ?? 1,
      limit: params.limit ?? 20,
      feeType: params.feeType,
      class: params.class,
      courseId: params.courseId,
      search: params.search,
    },
  });
  return data;
}

export async function getFee(feeId: string): Promise<FeeWithInstallments> {
  const { data } = await apiClient.get<FeeWithInstallments>(`/fees/${feeId}`);
  return data;
}

/** Merge manual payment info into existing installment metadata (server replaces `metadata` on PATCH). */
export function buildInstallmentPaymentPayload(
  existingMetadata: Record<string, unknown> | undefined,
  input: {
    paidAmount: number;
    paymentMethod: ManualPaymentMethod;
    paymentReference: string;
  },
): UpdateInstallmentPayload {
  const base =
    existingMetadata &&
    typeof existingMetadata === "object" &&
    !Array.isArray(existingMetadata)
      ? { ...existingMetadata }
      : {};
  return {
    paidAmount: input.paidAmount,
    metadata: {
      ...base,
      paymentMethod: input.paymentMethod,
      paymentReference: input.paymentReference.trim(),
      lastPaymentRecordedAt: new Date().toISOString(),
    },
  };
}

/** Merge manual payment info into fee metadata for lump-sum fees. */
export function buildFeeLumpSumPaymentPayload(
  existingMetadata: Record<string, unknown> | undefined,
  input: {
    paidAmount: number;
    paymentMethod: ManualPaymentMethod;
    paymentReference: string;
  },
): UpdateFeePaymentPayload {
  const base =
    existingMetadata &&
    typeof existingMetadata === "object" &&
    !Array.isArray(existingMetadata)
      ? { ...existingMetadata }
      : {};
  return {
    paidAmount: input.paidAmount,
    metadata: {
      ...base,
      paymentMethod: input.paymentMethod,
      paymentReference: input.paymentReference.trim(),
      lastPaymentRecordedAt: new Date().toISOString(),
    },
  };
}

export async function updateInstallment(
  feeId: string,
  installmentId: string,
  body: UpdateInstallmentPayload,
): Promise<UpdateInstallmentResult> {
  const { data } = await apiClient.patch<UpdateInstallmentResult>(
    `/fees/${feeId}/installments/${installmentId}`,
    body,
  );
  return data;
}

export async function updateFeePayment(
  feeId: string,
  body: UpdateFeePaymentPayload,
): Promise<FeeDto> {
  const { data } = await apiClient.patch<FeeDto>(`/fees/${feeId}`, body);
  return data;
}

/** PATCH /fees/:feeId — update schedule, title, amounts, etc. */
export async function patchFee(
  feeId: string,
  body: PatchFeePayload,
): Promise<FeeDto> {
  const { data } = await apiClient.patch<FeeDto>(`/fees/${feeId}`, body);
  return data;
}

export async function assignTemplateToFees(
  body: AssignTemplateToFeesPayload,
): Promise<AssignTemplateToFeesResult> {
  const { data } = await apiClient.post<AssignTemplateToFeesResult>(
    "/fees/assign",
    body,
  );
  return data;
}
