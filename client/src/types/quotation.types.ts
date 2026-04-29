import type { StudentGender } from "./student.types";

export type QuotationStatus =
  | "DRAFT"
  | "SENT"
  | "PENDING_PAYMENT"
  | "ACCEPTED"
  | "REJECTED"
  | "EXPIRED";

export type QuotationDto = {
  id: string;
  tenantId: string;
  branchId: string;
  branchName?: string;
  quotationRef: string;
  name: string;
  parentName: string;
  gender: StudentGender;
  age: number;
  courseId?: string;
  courseDisplayName: string;
  schoolClass?: string;
  schoolSection?: string;
  phone: string;
  address: string;
  email?: string;
  discountPercent: number;
  discountAmount: number;
  quotedTotal: number;
  websiteUrl?: string;
  youtubeUrl?: string;
  instagramUrl?: string;
  status: QuotationStatus;
  feeTemplateId: string;
  feeStructureTitle: string;
  feeStructureTotalAmount: number;
  feeStructureType: string;
  feeStructureIsInstallment: boolean;
  validUntil: string;
  preferredTimeSlot: string;
  /** Shown on the PDF after the ref/date block, before course & fee. */
  quotationOverview?: string;
  notes?: string;
  createdByUserId: string;
  pdfGeneratedAt?: string;
  pdfAccessExpiresAt?: string;
  smsSentAt?: string;
  conversionStudentId?: string;
  conversionFeeId?: string;
  checkoutPayTokenExpiresAt?: string;
  createdAt: string;
  updatedAt: string;
  /** Present only on POST /quotations/:id/send-sms when PDF was stored but SMS failed. */
  smsError?: string;
};

export type PaginatedQuotations = {
  data: QuotationDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type CreateQuotationPayload = {
  name: string;
  parentName: string;
  gender: StudentGender;
  age: number;
  courseId?: string;
  courseCustomName?: string;
  class?: string;
  section?: string;
  phone: string;
  address: string;
  email?: string;
  branchId: string;
  discountPercent: number;
  websiteUrl?: string;
  youtubeUrl?: string;
  instagramUrl?: string;
  feeTemplateId: string;
  validUntil: string;
  preferredTimeSlot: string;
  quotationOverview?: string;
  notes?: string;
};

export type UpdateQuotationPayload = Partial<CreateQuotationPayload> & {
  status?: QuotationStatus;
};
