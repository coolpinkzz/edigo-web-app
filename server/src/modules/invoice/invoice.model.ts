import mongoose, { Schema, Document, Model } from "mongoose";

export interface IInvoice extends Document {
  /** Human-readable unique id, e.g. INV-2026-A1B2C3 */
  invoiceNumber: string;

  /** Our Payment document id (one invoice per successful payment). */
  paymentId: string;

  tenantId: string;
  studentId: string;
  feeId: string;
  installmentId?: string;

  /** Amount actually applied, in smallest currency unit (paise for INR). */
  amount: number;
  currency: string;

  /** e.g. Razorpay online checkout */
  paymentMethod: string;

  /** Gateway payment id when available */
  razorpayPaymentId?: string;

  issuedAt: Date;

  /** Denormalized fields at time of issue */
  schoolName: string;
  studentName: string;
  studentClass: string;
  studentSection: string;
  studentCourse?: string;
  admissionId?: string;
  scholarId?: string;
  parentName?: string;
  parentPhone?: string;

  feeTitle: string;
  feeType?: string;
  installmentLabel?: string;

  createdAt: Date;
  updatedAt: Date;
}

const InvoiceSchema = new Schema<IInvoice>(
  {
    invoiceNumber: { type: String, required: true, trim: true, unique: true },
    paymentId: { type: String, required: true, trim: true, unique: true },

    tenantId: { type: String, required: true, index: true },
    studentId: { type: String, required: true, index: true },
    feeId: { type: String, required: true, index: true },
    installmentId: { type: String, trim: true, sparse: true, index: true },

    amount: { type: Number, required: true },
    currency: { type: String, required: true, default: "INR", trim: true },

    paymentMethod: { type: String, required: true, trim: true },
    razorpayPaymentId: { type: String, trim: true },

    issuedAt: { type: Date, required: true, index: true },

    schoolName: { type: String, required: true, trim: true },
    studentName: { type: String, required: true, trim: true },
    studentClass: { type: String, required: true, trim: true },
    studentSection: { type: String, required: true, trim: true },
    studentCourse: { type: String, trim: true },
    admissionId: { type: String, trim: true },
    scholarId: { type: String, trim: true },
    parentName: { type: String, trim: true },
    parentPhone: { type: String, trim: true },

    feeTitle: { type: String, required: true, trim: true },
    feeType: { type: String, trim: true },
    installmentLabel: { type: String, trim: true },
  },
  { timestamps: true },
);

InvoiceSchema.index({ tenantId: 1, issuedAt: -1 });

export const Invoice: Model<IInvoice> =
  mongoose.models.Invoice ?? mongoose.model<IInvoice>("Invoice", InvoiceSchema);
