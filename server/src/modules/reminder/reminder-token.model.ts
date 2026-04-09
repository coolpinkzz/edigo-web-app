import mongoose, { Schema, Document, Model } from "mongoose";

/**
 * Opaque token for `GET /pay/:token` — not guessable (unlike raw installment ObjectIds).
 */
export interface IReminderToken extends Document {
  token: string;
  installmentId: string;
  feeId: string;
  studentId: string;
  tenantId: string;
  expiresAt: Date;
  lastAccessAt?: Date;
  accessCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const ReminderTokenSchema = new Schema<IReminderToken>(
  {
    token: { type: String, required: true, unique: true, trim: true },
    /**
     * Installment ObjectId string, or synthetic `lump:${feeId}` for lump-sum fees
     * (SMS link target; one row per installment or per lump-sum fee).
     */
    installmentId: { type: String, required: true, unique: true, index: true },
    feeId: { type: String, required: true, index: true },
    studentId: { type: String, required: true, index: true },
    tenantId: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true, index: true },
    lastAccessAt: { type: Date },
    accessCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

ReminderTokenSchema.index({ tenantId: 1, installmentId: 1 });

export const ReminderToken: Model<IReminderToken> =
  mongoose.models.ReminderToken ??
  mongoose.model<IReminderToken>("ReminderToken", ReminderTokenSchema);
