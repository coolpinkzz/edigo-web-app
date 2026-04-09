import mongoose, { Schema, Document, Model } from "mongoose";

/**
 * Append-only log of manual (non-gateway) credits: staff edits to fee/installment
 * `paidAmount`. Gateway flows use `Payment` + `applyPaymentCredit` and are not logged here.
 */
export interface IManualPaymentCredit extends Document {
  tenantId: string;
  feeId: string;
  studentId: string;
  installmentId?: string;
  /** Rupees (same unit as Fee.totalAmount). */
  amount: number;
  /** When the credit was recorded (defaults to request time). */
  recordedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ManualPaymentCreditSchema = new Schema<IManualPaymentCredit>(
  {
    tenantId: { type: String, required: true, index: true },
    feeId: { type: String, required: true, index: true },
    studentId: { type: String, required: true, index: true },
    installmentId: { type: String, trim: true, index: true, sparse: true },
    amount: { type: Number, required: true },
    recordedAt: { type: Date, required: true, index: true },
  },
  { timestamps: true },
);

ManualPaymentCreditSchema.index({ tenantId: 1, recordedAt: 1 });

export const ManualPaymentCredit: Model<IManualPaymentCredit> =
  mongoose.models.ManualPaymentCredit ??
  mongoose.model<IManualPaymentCredit>(
    "ManualPaymentCredit",
    ManualPaymentCreditSchema,
  );
