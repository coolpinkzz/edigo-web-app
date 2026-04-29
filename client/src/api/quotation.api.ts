import type {
  CreateQuotationPayload,
  PaginatedQuotations,
  QuotationDto,
  UpdateQuotationPayload,
} from "../types/quotation.types";
import { apiClient } from "./client";

export type ListQuotationsParams = {
  branchId?: string;
  status?: string;
  page?: number;
  limit?: number;
};

export async function listQuotations(
  params?: ListQuotationsParams,
): Promise<PaginatedQuotations> {
  const { data } = await apiClient.get<PaginatedQuotations>("/quotations", {
    params: {
      branchId: params?.branchId,
      status: params?.status,
      page: params?.page,
      limit: params?.limit,
    },
  });
  return data;
}

export async function getQuotation(id: string): Promise<QuotationDto> {
  const { data } = await apiClient.get<QuotationDto>(`/quotations/${id}`);
  return data;
}

export async function createQuotation(
  body: CreateQuotationPayload,
): Promise<QuotationDto> {
  const { data } = await apiClient.post<QuotationDto>("/quotations", body);
  return data;
}

export async function updateQuotation(
  id: string,
  body: UpdateQuotationPayload,
): Promise<QuotationDto> {
  const { data } = await apiClient.patch<QuotationDto>(
    `/quotations/${id}`,
    body,
  );
  return data;
}

export async function sendQuotationPdfSms(
  id: string,
): Promise<QuotationDto> {
  const { data } = await apiClient.post<QuotationDto>(
    `/quotations/${id}/send-sms`,
  );
  return data;
}

/** Opens PDF in a new tab (JWT). */
export async function downloadQuotationPdfBlob(id: string): Promise<Blob> {
  const { data } = await apiClient.get<Blob>(`/quotations/${id}/pdf`, {
    responseType: "blob",
  });
  return data;
}
