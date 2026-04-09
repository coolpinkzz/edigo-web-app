import mongoose, { Schema, Document, Model } from "mongoose";

/**
 * Razorpay settlement batch (account-level). Synced from GET /v1/settlements.
 * Amounts stored in INR (rupees); Razorpay returns paise.
 */
export interface ISettlement extends Document {
  /** Razorpay settlement id (e.g. setl_xxx). */
  settlementId: string;
  /** Net amount settled to bank (INR). */
  amount: number;
  /** Razorpay fees (INR). */
  fees: number;
  /** Tax on fees (INR). */
  tax: number;
  /** When the settlement completed (if available). */
  settledAt?: Date | null;
  /** Razorpay status (e.g. processed, initiated). */
  status: string;
  currency: string;
  syncedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SettlementSchema = new Schema<ISettlement>(
  {
    settlementId: { type: String, required: true, unique: true, trim: true },
    amount: { type: Number, required: true },
    fees: { type: Number, required: true, default: 0 },
    tax: { type: Number, required: true, default: 0 },
    settledAt: { type: Date, default: null },
    status: { type: String, required: true, trim: true },
    currency: { type: String, default: "INR", trim: true },
    syncedAt: { type: Date, required: true },
  },
  { timestamps: true },
);

SettlementSchema.index({ settledAt: -1 });
SettlementSchema.index({ status: 1 });

export const Settlement: Model<ISettlement> =
  mongoose.models.Settlement ??
  mongoose.model<ISettlement>("Settlement", SettlementSchema);
