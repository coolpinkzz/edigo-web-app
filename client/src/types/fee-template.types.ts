import type { StudentClass, StudentSection } from './student.types'

export type FeeType = 'ADMISSION' | 'RENEW'

export const FEE_TYPE_OPTIONS: { value: FeeType; label: string }[] = [
  { value: 'ADMISSION', label: 'New admission' },
  { value: 'RENEW', label: 'Renew' },
]

/** One row in the installment builder (UI uses calendar dates). */
export interface InstallmentFormRow {
  amount: number
  dueDate: string
  /** Per-day overdue penalty amount for this installment. */
  lateFee: number
}

/** Form values for Create Fee Template. */
export interface CreateFeeTemplateFormValues {
  title: string
  feeType: FeeType
  totalAmount: number
  isInstallment: boolean
  installments: InstallmentFormRow[]
  /** Lump-sum only: YYYY-MM-DD — stored on template as default fee due date. */
  defaultEndDate: string
}

/** Serialized fee template from API. */
export interface FeeTemplateDto {
  id: string
  tenantId: string
  title: string
  feeType: FeeType
  totalAmount: number
  isInstallment: boolean
  /** YYYY-MM-DD (IST calendar day); earliest due date from the template builder — default anchor when assigning. */
  installmentAnchorDate?: string
  /** YYYY-MM-DD; lump-sum templates — default `endDate` on fees created from this template. */
  defaultEndDate?: string
  defaultInstallments: {
    amount: number
    dueInDays: number
    lateFee?: number
    discount?: number
  }[]
  createdAt: string
  updatedAt: string
}

export interface PaginatedFeeTemplates {
  data: FeeTemplateDto[]
  total: number
  page: number
  limit: number
  totalPages: number
}

/** POST /fee-templates/:id/assign — XOR: either `class` or `studentIds`. */
export interface AssignFeeTemplateByClassBody {
  class: StudentClass
  section?: StudentSection
}

export interface AssignFeeTemplateByStudentsBody {
  studentIds: string[]
}

export type AssignFeeTemplateBody =
  | AssignFeeTemplateByClassBody
  | AssignFeeTemplateByStudentsBody

export interface FeeTemplateAssignResult {
  assignedCount: number
  skippedDuplicateCount: number
}
