import mongoose, { Schema, Document, Model } from "mongoose";
import { TENANT_TYPES, TenantType } from "../../types/tenant";

export interface ITenant extends Document {
  name: string;
  slug: string;
  /** SCHOOL: class + section; ACADEMY: course-oriented labels. */
  tenantType: TenantType;
  isActive: boolean;
  /** Razorpay Route linked account id (`acc_…`), when onboarding completed via API. */
  razorpayLinkedAccountId?: string;
  /** Mirrors Razorpay account status (e.g. `created`, `suspended`). */
  razorpayLinkedAccountStatus?: string;
  razorpayLinkedAccountCreatedAt?: Date;
  /** Route product config id (`acc_prd_…`) after POST …/accounts/:id/products. */
  razorpayRouteProductId?: string;
  /** Route product `activation_status` from Razorpay (e.g. `needs_clarification`, `activated`). */
  razorpayRouteActivationStatus?: string;
  createdAt: Date;
  updatedAt: Date;
}

const tenantSchema = new Schema<ITenant>(
  {
    name: { type: String, required: true, trim: true },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    tenantType: {
      type: String,
      enum: TENANT_TYPES,
      required: true,
      default: "SCHOOL",
    },
    isActive: { type: Boolean, default: true },
    razorpayLinkedAccountId: { type: String, trim: true },
    razorpayLinkedAccountStatus: { type: String, trim: true },
    razorpayLinkedAccountCreatedAt: { type: Date },
    razorpayRouteProductId: { type: String, trim: true },
    razorpayRouteActivationStatus: { type: String, trim: true },
  },
  { timestamps: true },
);

// Index for fast lookups by slug
tenantSchema.index({ slug: 1 });

export const Tenant: Model<ITenant> =
  mongoose.models.Tenant ?? mongoose.model<ITenant>("Tenant", tenantSchema);
