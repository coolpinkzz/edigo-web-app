import mongoose, { Schema, Document, Model } from "mongoose";

export type PaymentStatus = "INITIATED" | "SUCCESS" | "FAILED";

export const PAYMENT_STATUSES: PaymentStatus[] = [
  "INITIATED",
  "SUCCESS",
  "FAILED",
];

export interface IPayment extends Document {
  tenantId: string;
  studentId: string;
  feeId: string;
  /** Set when the fee uses installments; omitted for lump-sum fees. */
  installmentId?: string;

  /** Amount in smallest currency unit (e.g. paise for INR), aligned with Razorpay. */
  amount: number;
  /** Portion of `amount` allocated to fee principal (paise). */
  principalAmount?: number;
  /** Portion of `amount` allocated to overdue penalty (paise). */
  penaltyAmount?: number;
  /** Overdue days at order creation for installment payments. */
  overdueDaysAtCreation?: number;
  currency: string;

  status: PaymentStatus;

  razorpayOrderId: string;
  razorpayPaymentId?: string;
  /** Razorpay settlement id once payment is included in a settlement (from payment fetch). */
  razorpaySettlementId?: string;
  razorpaySignature?: string;

  /** Set when a shareable Razorpay Payment Link is created for this payment. */
  razorpayPaymentLinkId?: string;
  paymentLinkShortUrl?: string;

  /** Client-supplied key; unique per tenant for safe retries. */
  idempotencyKey: string;
  /** Hash of create-order payload to detect conflicting reuse of the same key. */
  idempotencyPayloadHash: string;

  /** Optional failure / reconciliation notes */
  failureReason?: string;

  /** Opaque token from reminder SMS (`GET /pay/:token`); not set for staff create-order. */
  payToken?: string;

  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema = new Schema<IPayment>(
  {
    tenantId: { type: String, required: true, index: true },
    studentId: { type: String, required: true, index: true },
    feeId: { type: String, required: true, index: true },
    installmentId: { type: String, trim: true, index: true, sparse: true },

    amount: { type: Number, required: true },
    principalAmount: { type: Number, min: 0 },
    penaltyAmount: { type: Number, min: 0 },
    overdueDaysAtCreation: { type: Number, min: 0 },
    currency: { type: String, required: true, default: "INR", trim: true },

    status: {
      type: String,
      enum: PAYMENT_STATUSES,
      default: "INITIATED",
      index: true,
    },

    razorpayOrderId: { type: String, required: true, trim: true, unique: true },
    razorpayPaymentId: { type: String, trim: true, sparse: true },
    razorpaySettlementId: { type: String, trim: true, sparse: true, index: true },
    razorpaySignature: { type: String, trim: true, sparse: true },

    razorpayPaymentLinkId: { type: String, trim: true, sparse: true },
    paymentLinkShortUrl: { type: String, trim: true, sparse: true },

    idempotencyKey: { type: String, required: true, trim: true },
    idempotencyPayloadHash: { type: String, required: true },

    failureReason: { type: String, trim: true },

    payToken: { type: String, trim: true, sparse: true, index: true },
  },
  { timestamps: true },
);

PaymentSchema.index({ tenantId: 1, idempotencyKey: 1 }, { unique: true });
PaymentSchema.index({ tenantId: 1, studentId: 1 });
PaymentSchema.index({ tenantId: 1, feeId: 1 });
PaymentSchema.index({ razorpayPaymentLinkId: 1 }, { sparse: true, unique: true });
PaymentSchema.index({ payToken: 1, status: 1 });

export const Payment: Model<IPayment> =
  mongoose.models.Payment ?? mongoose.model<IPayment>("Payment", PaymentSchema);
