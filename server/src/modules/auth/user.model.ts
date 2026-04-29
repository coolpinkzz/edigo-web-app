import mongoose, { Schema, Document, Model } from "mongoose";
import { Role } from "../../types/roles";

export interface IUser extends Document {
  phone: string;
  password: string;
  name: string;
  tenantId: mongoose.Types.ObjectId;
  role: Role;
  isActive: boolean;
  /**
   * Subset of branches this user may access. Empty or unset = all branches in tenant.
   */
  branchIds?: string[];
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    phone: { type: String, required: true, trim: true },
    password: { type: String, required: true, select: false },
    name: { type: String, required: true, trim: true },
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
    role: {
      type: String,
      required: true,
      enum: ["SUPER_ADMIN", "TENANT_ADMIN", "STAFF", "VIEWER"],
      default: "VIEWER",
    },
    isActive: { type: Boolean, default: true },
    branchIds: {
      type: [{ type: String, trim: true }],
    },
  },
  { timestamps: true },
);

// Compound index: one phone per tenant
userSchema.index({ phone: 1, tenantId: 1 }, { unique: true });
userSchema.index({ tenantId: 1 });
userSchema.index({ tenantId: 1, branchIds: 1 });

export const User: Model<IUser> =
  mongoose.models.User ?? mongoose.model<IUser>("User", userSchema);
