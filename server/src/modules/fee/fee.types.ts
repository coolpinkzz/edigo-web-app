import type { FeeType, FeeSource } from "./fee.model";

/** Overrides when instantiating a fee from a template (assignment snapshot only). */
export interface FeeTemplateCreateOverrides {
  title?: string;
  description?: string;
  category?: string;
  metadata?: Record<string, unknown>;
  startDate?: Date;
  endDate?: Date;
  tags?: string[];
}

/** Resolved snapshot fields after merging template + assignment overrides (bulk assign). */
export interface FeeTemplateMergedSnapshot {
  title: string;
  description?: string;
  category?: string;
  metadata?: Record<string, unknown>;
  startDate?: Date;
  endDate?: Date;
  tags?: string[];
}

export interface CreateFeeCustomInput {
  source: "CUSTOM";
  studentId: string;
  title: string;
  description?: string;
  feeType: FeeType;
  category?: string;
  metadata?: Record<string, unknown>;
  totalAmount: number;
  paidAmount?: number;
  startDate?: Date;
  endDate?: Date;
  tags?: string[];
}

export interface CreateFeeFromTemplateInput {
  source: "TEMPLATE";
  templateId: string;
  studentId: string;
  /** Installment due dates = anchor + template.defaultInstallments[].dueInDays (IST). */
  assignmentAnchorDate?: Date;
  feeOverrides?: FeeTemplateCreateOverrides;
}

export type CreateFeeInput = CreateFeeCustomInput | CreateFeeFromTemplateInput;
