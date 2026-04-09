import type { FeeType } from "./fee-template.types";

/** Mirrors server `fee.model` / `serializeFee`. */
export type FeeStatus = "PENDING" | "PARTIAL" | "PAID" | "OVERDUE";

export const FEE_STATUS_OPTIONS: { value: FeeStatus; label: string }[] = [
  { value: "PENDING", label: "Pending" },
  { value: "PARTIAL", label: "Partial" },
  { value: "PAID", label: "Paid" },
  { value: "OVERDUE", label: "Overdue" },
];

export type FeeSource = "TEMPLATE" | "CUSTOM";

export interface FeeDto {
  id: string;
  tenantId: string;
  studentId: string;
  source: FeeSource;
  templateId?: string;
  title: string;
  description?: string;
  feeType: FeeType;
  category?: string;
  metadata?: Record<string, unknown>;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  isInstallment: boolean;
  status: FeeStatus;
  startDate?: string;
  endDate?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

/** Mirrors server `serializeInstallment`. */
export interface InstallmentDto {
  id: string;
  feeId: string;
  amount: number;
  paidAmount: number;
  dueDate: string;
  status: FeeStatus;
  lateFee: number;
  discount: number;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedFees {
  data: FeeDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** GET /fees/overdue — installment lines and lump-sum overdue fees (empty `installmentId`). */
export interface OverdueFeeInstallmentRow {
  studentId: string;
  studentName: string;
  parentPhoneNumber: string;
  feeTitle: string;
  installmentAmount: number;
  paidAmount: number;
  pendingAmount: number;
  dueDate: string;
  daysOverdue: number;
  /** Empty string for lump-sum rows; reminders use `feeId` in that case. */
  installmentId: string;
  feeId: string;
}

export interface PaginatedOverdueFees {
  data: OverdueFeeInstallmentRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  summary: {
    totalOverdueAmount: number;
    totalStudents: number;
  };
}

/** GET /fees/:feeId */
export interface FeeWithInstallments {
  fee: FeeDto;
  installments: InstallmentDto[];
}

/** PATCH /fees/:feeId/installments/:installmentId */
export interface UpdateInstallmentPayload {
  amount?: number;
  paidAmount?: number;
  dueDate?: string;
  lateFee?: number;
  discount?: number;
  metadata?: Record<string, unknown>;
}

export interface UpdateInstallmentResult {
  fee: FeeDto;
  installment: InstallmentDto;
}

/** Payment method for manual cash/cheque recording (stored in installment `metadata`). */
export type ManualPaymentMethod = "CASH" | "CHEQUE";

/** PATCH /fees/:feeId — minimal shape for recording lump-sum payment */
export interface UpdateFeePaymentPayload {
  paidAmount: number;
  metadata?: Record<string, unknown>;
}

/** PATCH /fees/:feeId — optional fields (dates as ISO strings). */
export interface PatchFeePayload {
  title?: string;
  description?: string;
  feeType?: FeeType;
  category?: string;
  metadata?: Record<string, unknown>;
  totalAmount?: number;
  paidAmount?: number;
  startDate?: string;
  endDate?: string;
  tags?: string[];
}

export interface AssignFeeCustomInstallmentPayload {
  amount: number;
  dueDate: string;
}

export interface AssignTemplateToStudentsPayload {
  templateId: string;
  assignmentType: "STUDENTS";
  studentIds: string[];
  customInstallments?: AssignFeeCustomInstallmentPayload[];
}

export interface AssignTemplateToClassPayload {
  templateId: string;
  assignmentType: "CLASS";
  class: string;
  section?: string;
  customInstallments?: AssignFeeCustomInstallmentPayload[];
}

export type AssignTemplateToFeesPayload =
  | AssignTemplateToStudentsPayload
  | AssignTemplateToClassPayload;

export interface AssignTemplateToFeesResult {
  assignedCount: number;
  skippedDuplicateCount: number;
}
