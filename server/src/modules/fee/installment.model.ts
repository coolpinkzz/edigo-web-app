import mongoose, { Schema, Document, Model } from "mongoose";
import { FEE_STATUSES, FeeStatus } from "./fee.model";

export interface IInstallment extends Document {
  feeId: string;

  amount: number;
  paidAmount: number;

  dueDate: Date;

  status: FeeStatus;

  lateFee: number;
  /** Paid portion of accrued late fee (same currency unit as amount). */
  lateFeePaid: number;
  discount: number;

  metadata?: Record<string, unknown>;

  createdAt: Date;
  updatedAt: Date;
}

const InstallmentSchema = new Schema<IInstallment>(
  {
    feeId: { type: String, required: true, index: true },

    amount: { type: Number, required: true },
    paidAmount: { type: Number, default: 0 },

    dueDate: { type: Date, required: true },

    status: {
      type: String,
      enum: FEE_STATUSES,
      default: "PENDING",
      index: true,
    },

    lateFee: { type: Number, default: 0 },
    lateFeePaid: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },

    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  },
);

InstallmentSchema.index({ feeId: 1, dueDate: 1 });

export const Installment: Model<IInstallment> =
  mongoose.models.Installment ??
  mongoose.model<IInstallment>("Installment", InstallmentSchema);
