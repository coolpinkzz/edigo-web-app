import mongoose, { Schema, Document, Model } from "mongoose";

/**
 * One SMS per IST calendar day per target: real installment id, or synthetic `lump:${feeId}`.
 */
export interface IReminderLog extends Document {
  runId: string;
  tenantId: string;
  installmentId: string;
  feeId: string;
  studentId: string;
  token: string;
  /** IST date string YYYY-MM-DD — unique with installmentId for daily dedupe */
  reminderDay: string;
  /** Phone last 4 digits only (PII minimization) */
  phoneSuffix?: string;
  sentAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ReminderLogSchema = new Schema<IReminderLog>(
  {
    runId: { type: String, required: true, index: true },
    tenantId: { type: String, required: true, index: true },
    installmentId: { type: String, required: true, index: true },
    feeId: { type: String, required: true },
    studentId: { type: String, required: true },
    token: { type: String, required: true },
    reminderDay: { type: String, required: true, trim: true },
    phoneSuffix: { type: String, trim: true },
    sentAt: { type: Date, required: true, default: () => new Date() },
  },
  { timestamps: true },
);

ReminderLogSchema.index({ installmentId: 1, reminderDay: 1 }, { unique: true });

export const ReminderLog: Model<IReminderLog> =
  mongoose.models.ReminderLog ??
  mongoose.model<IReminderLog>("ReminderLog", ReminderLogSchema);
