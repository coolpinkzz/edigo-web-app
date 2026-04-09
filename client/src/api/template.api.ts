import type {
  AssignFeeTemplateBody,
  CreateFeeTemplateFormValues,
  FeeTemplateAssignResult,
  FeeTemplateDto,
  FeeType,
  PaginatedFeeTemplates,
} from '../types'
import {
  buildDefaultInstallments,
  earliestDueDateString,
} from '../utils/installments'
import { apiClient } from './client'

function buildFeeTemplateBody(values: CreateFeeTemplateFormValues) {
  const defaultInstallments = values.isInstallment
    ? buildDefaultInstallments(values.installments)
    : []
  const installmentAnchorDate = values.isInstallment
    ? earliestDueDateString(values.installments)
    : undefined

  const defaultEnd = values.defaultEndDate?.trim()

  return {
    title: values.title.trim(),
    feeType: values.feeType,
    totalAmount: values.totalAmount,
    isInstallment: values.isInstallment,
    defaultInstallments,
    ...(installmentAnchorDate ? { installmentAnchorDate } : {}),
    ...(!values.isInstallment && defaultEnd ? { defaultEndDate: defaultEnd } : {}),
  }
}

/**
 * POST /fee-templates
 * Maps UI installments (amount + dueDate) → API `defaultInstallments` (amount + dueInDays).
 */
export async function createFeeTemplate(
  values: CreateFeeTemplateFormValues,
): Promise<FeeTemplateDto> {
  const { data } = await apiClient.post<FeeTemplateDto>(
    '/fee-templates',
    buildFeeTemplateBody(values),
  )
  return data
}

/** GET /fee-templates/:templateId */
export async function getFeeTemplate(templateId: string): Promise<FeeTemplateDto> {
  const { data } = await apiClient.get<FeeTemplateDto>(
    `/fee-templates/${templateId}`,
  )
  return data
}

/** DELETE /fee-templates/:templateId */
export async function deleteFeeTemplate(templateId: string): Promise<void> {
  await apiClient.delete(`/fee-templates/${templateId}`)
}

export interface ListFeeTemplatesParams {
  page?: number
  limit?: number
  feeType?: FeeType
}

export async function listFeeTemplates(
  params: ListFeeTemplatesParams = {},
): Promise<PaginatedFeeTemplates> {
  const { data } = await apiClient.get<PaginatedFeeTemplates>('/fee-templates', {
    params: {
      page: params.page ?? 1,
      limit: params.limit ?? 50,
      feeType: params.feeType,
    },
  })
  return data
}

/** POST /fee-templates/:templateId/assign — bulk create fees from template (STAFF). */
export async function assignFeeTemplate(
  templateId: string,
  body: AssignFeeTemplateBody,
): Promise<FeeTemplateAssignResult> {
  const { data } = await apiClient.post<FeeTemplateAssignResult>(
    `/fee-templates/${templateId}/assign`,
    body,
  )
  return data
}
