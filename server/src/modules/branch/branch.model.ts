import mongoose, { Schema, Document, Model } from "mongoose";

export interface IBranch extends Document {
  tenantId: mongoose.Types.ObjectId;
  name: string;
  /** Optional short code, unique per tenant when set. */
  code?: string;
  address?: string;
  createdAt: Date;
  updatedAt: Date;
}

const branchSchema = new Schema<IBranch>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true },
    address: { type: String, trim: true, maxlength: 1000 },
  },
  { timestamps: true },
);

branchSchema.index({ tenantId: 1, name: 1 }, { unique: true });
branchSchema.index(
  { tenantId: 1, code: 1 },
  {
    unique: true,
    partialFilterExpression: {
      code: { $type: "string", $nin: [null, ""] },
    },
  },
);

export const Branch: Model<IBranch> =
  mongoose.models.Branch ?? mongoose.model<IBranch>("Branch", branchSchema);
