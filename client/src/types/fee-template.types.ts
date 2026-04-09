import type { StudentClass, StudentSection } from './student.types'

export type FeeType = 'TUITION' | 'TRANSPORT' | 'HOSTEL' | 'OTHER'

export const FEE_TYPE_OPTIONS: { value: FeeType; label: string }[] = [
  { value: 'TUITION', label: 'Tuition' },
  { value: 'TRANSPORT', label: 'Transport' },
  { value: 'HOSTEL', label: 'Hostel' },
  { value: 'OTHER', label: 'Other' },
]

/** One row in the installment builder (UI uses calendar dates). */
export interface InstallmentFormRow {
  amount: number
  dueDate: string
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
