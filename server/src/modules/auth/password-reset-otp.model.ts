import mongoose, { Schema, Document, Model } from "mongoose";

/**
 * One active password-reset flow per (phone, tenantId). A new request replaces the previous row.
 */
export interface IPasswordResetOtp extends Document {
  phone: string;
  tenantId: mongoose.Types.ObjectId;
  /** bcrypt hash of the numeric OTP; removed after successful verify */
  otpHash?: string;
  otpExpiresAt: Date;
  attempts: number;
  /** true after successful OTP verification; unlocks reset until resetExpiresAt */
  verified: boolean;
  /** deadline to call POST /auth/reset-password after verify */
  resetExpiresAt: Date | null;
  /** true after password was updated */
  consumed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const passwordResetOtpSchema = new Schema<IPasswordResetOtp>(
  {
    phone: { type: String, required: true, trim: true, index: true },
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    otpHash: { type: String },
    otpExpiresAt: { type: Date, required: true, index: true },
    attempts: { type: Number, required: true, default: 0 },
    verified: { type: Boolean, required: true, default: false },
    resetExpiresAt: { type: Date, default: null },
    consumed: { type: Boolean, required: true, default: false },
  },
  { timestamps: true },
);

passwordResetOtpSchema.index({ phone: 1, tenantId: 1 });

export const PasswordResetOtp: Model<IPasswordResetOtp> =
  mongoose.models.PasswordResetOtp ??
  mongoose.model<IPasswordResetOtp>("PasswordResetOtp", passwordResetOtpSchema);
