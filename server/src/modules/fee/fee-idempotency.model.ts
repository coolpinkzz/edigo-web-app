import mongoose, { Schema, Document, Model } from "mongoose";

/**
 * Maps tenant + client idempotency key → fee + request fingerprint.
 * TTL on expiresAt drops old keys automatically (does not delete fees).
 */
export interface IFeeIdempotency extends Document {
  tenantId: string;
  key: string;
  requestHash: string;
  feeId: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const FeeIdempotencySchema = new Schema<IFeeIdempotency>(
  {
    tenantId: { type: String, required: true, index: true },
    key: { type: String, required: true, trim: true },
    requestHash: { type: String, required: true },
    feeId: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

FeeIdempotencySchema.index({ tenantId: 1, key: 1 }, { unique: true });
FeeIdempotencySchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0 },
);

export const FeeIdempotency: Model<IFeeIdempotency> =
  mongoose.models.FeeIdempotency ??
  mongoose.model<IFeeIdempotency>("FeeIdempotency", FeeIdempotencySchema);
