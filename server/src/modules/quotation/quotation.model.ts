import mongoose, { Schema, Document, Model } from "mongoose";
import { FEE_TYPES, FeeType } from "../fee/fee.model";
import {
  STUDENT_CLASSES,
  STUDENT_GENDERS,
  STUDENT_SECTIONS,
  StudentClass,
  StudentGender,
  StudentSection,
} from "../student/student.model";

export const QUOTATION_STATUSES = [
  "DRAFT",
  "SENT",
  "PENDING_PAYMENT",
  "ACCEPTED",
  "REJECTED",
  "EXPIRED",
] as const;

export type QuotationStatus = (typeof QUOTATION_STATUSES)[number];

export interface IQuotation extends Document {
  tenantId: string;
  branchId: string;
  quotationRef: string;

  name: string;
  parentName: string;
  gender: StudentGender;
  age: number;
  /** When set, must reference Course in tenant (ACADEMY). */
  courseId?: string;
  /** Display line for PDF (from Course.name, custom entry, or class/section for SCHOOL). */
  courseDisplayName: string;
  /** SCHOOL tenants: class for enrolment; optional if legacy quote had only course text. */
  schoolClass?: StudentClass;
  /** SCHOOL tenants: section for enrolment. */
  schoolSection?: StudentSection;
  phone: string;
  address: string;
  email?: string;

  /** 0–100; discount applied to fee structure base total for quoted amount. */
  discountPercent: number;

  websiteUrl?: string;
  youtubeUrl?: string;
  instagramUrl?: string;

  status: QuotationStatus;
  feeTemplateId: string;
  feeStructureTitle: string;
  feeStructureTotalAmount: number;
  feeStructureType: FeeType;
  feeStructureIsInstallment: boolean;

  validUntil: Date;
  /** Preferred class / visit time (e.g. "Evening 6–8pm"). */
  preferredTimeSlot: string;

  /** Optional intro / overview on the PDF (above course & fee). */
  quotationOverview?: string;
  /** Shown on PDF footer as remarks. */
  notes?: string;

  createdByUserId: string;

  pdfRelativePath?: string;
  pdfGeneratedAt?: Date;
  /** Raw token for `GET /public/quotations/:id/pdf?token=`; never log in plain text. */
  pdfAccessToken?: string;
  pdfAccessExpiresAt?: Date;
  lastPdfAccessAt?: Date;
  smsSentAt?: Date;

  /** Set after successful accept + student create; first payment still pending. */
  conversionStudentId?: string;
  conversionFeeId?: string;
  /** Opaque pay token for GET /pay/:token (same mechanism as fee reminders). */
  checkoutPayToken?: string;
  checkoutPayTokenExpiresAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

const QuotationSchema = new Schema<IQuotation>(
  {
    tenantId: { type: String, required: true, index: true },
    branchId: { type: String, required: true, index: true },
    quotationRef: { type: String, required: true, trim: true },

    name: { type: String, required: true, trim: true },
    parentName: { type: String, required: true, trim: true },
    gender: {
      type: String,
      required: true,
      enum: STUDENT_GENDERS,
    },
    age: { type: Number, required: true },
    courseId: { type: String, trim: true, index: true, sparse: true },
    courseDisplayName: { type: String, required: true, trim: true },
    schoolClass: { type: String, trim: true, enum: STUDENT_CLASSES },
    schoolSection: { type: String, trim: true, enum: STUDENT_SECTIONS },
    phone: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },

    discountPercent: { type: Number, required: true, default: 0 },

    websiteUrl: { type: String, trim: true },
    youtubeUrl: { type: String, trim: true },
    instagramUrl: { type: String, trim: true },

    status: {
      type: String,
      required: true,
      enum: QUOTATION_STATUSES,
      default: "DRAFT",
      index: true,
    },
    feeTemplateId: { type: String, required: true, index: true },
    feeStructureTitle: { type: String, required: true, trim: true },
    feeStructureTotalAmount: { type: Number, required: true },
    feeStructureType: { type: String, required: true, enum: FEE_TYPES },
    feeStructureIsInstallment: { type: Boolean, required: true },

    validUntil: { type: Date, required: true },
    preferredTimeSlot: { type: String, required: true, trim: true },

    quotationOverview: { type: String, trim: true, maxlength: 4000 },
    notes: { type: String, trim: true, maxlength: 4000 },

    createdByUserId: { type: String, required: true, index: true },

    pdfRelativePath: { type: String, trim: true },
    pdfGeneratedAt: { type: Date },
    pdfAccessToken: { type: String, trim: true, sparse: true, unique: true },
    pdfAccessExpiresAt: { type: Date },
    lastPdfAccessAt: { type: Date },
    smsSentAt: { type: Date },

    conversionStudentId: { type: String, trim: true, sparse: true, index: true },
    conversionFeeId: { type: String, trim: true, sparse: true, index: true },
    checkoutPayToken: { type: String, trim: true, sparse: true },
    checkoutPayTokenExpiresAt: { type: Date },
  },
  { timestamps: true },
);

QuotationSchema.index({ tenantId: 1, quotationRef: 1 }, { unique: true });
QuotationSchema.index({ tenantId: 1, branchId: 1, updatedAt: -1 });
QuotationSchema.index({ tenantId: 1, status: 1, updatedAt: -1 });

export const Quotation: Model<IQuotation> =
  mongoose.models.Quotation ??
  mongoose.model<IQuotation>("Quotation", QuotationSchema);
