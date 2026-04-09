import mongoose, { Schema, Document, Model } from "mongoose";
import { FEE_TYPES, FeeType } from "../fee/fee.model";

/**
 * Blueprint for installments: amounts + days from assignment anchor (IST).
 */
export interface IDefaultInstallmentTemplate {
  amount: number;
  dueInDays: number;
  lateFee?: number;
  discount?: number;
  metadata?: Record<string, unknown>;
}

export interface IFeeTemplate extends Document {
  tenantId: string;

  title: string;
  description?: string;

  feeType: FeeType;
  category?: string;

  totalAmount: number;
  isInstallment: boolean;

  /** Required when isInstallment is true; sum of amount must equal totalAmount. */
  defaultInstallments: IDefaultInstallmentTemplate[];

  /**
   * YYYY-MM-DD (IST calendar day): earliest due date from the template builder.
   * Used as the default assignment anchor so installment calendar dates match the blueprint.
   */
  installmentAnchorDate?: string;

  /**
   * YYYY-MM-DD: default fee `endDate` for lump-sum templates (overdue when unpaid after this day IST).
   * Ignored for installment plans (installment due dates apply instead).
   */
  defaultEndDate?: string;

  metadata?: Record<string, unknown>;

  tags?: string[];

  createdAt: Date;
  updatedAt: Date;
}

const DefaultInstallmentTemplateSchema = new Schema<IDefaultInstallmentTemplate>(
  {
    amount: { type: Number, required: true },
    dueInDays: { type: Number, required: true, min: 0 },
    lateFee: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    metadata: { type: Schema.Types.Mixed },
  },
  { _id: false },
);

const FeeTemplateSchema = new Schema<IFeeTemplate>(
  {
    tenantId: { type: String, required: true, index: true },

    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },

    feeType: {
      type: String,
      enum: FEE_TYPES,
      required: true,
      index: true,
    },

    category: { type: String, trim: true },

    totalAmount: { type: Number, required: true },
    isInstallment: { type: Boolean, default: false },

    defaultInstallments: {
      type: [DefaultInstallmentTemplateSchema],
      default: [],
    },

    installmentAnchorDate: { type: String, trim: true },

    defaultEndDate: { type: String, trim: true },

    metadata: { type: Schema.Types.Mixed },

    tags: [{ type: String, trim: true }],
  },
  { timestamps: true },
);

FeeTemplateSchema.index({ tenantId: 1, feeType: 1 });

export const FeeTemplate: Model<IFeeTemplate> =
  mongoose.models.FeeTemplate ??
  mongoose.model<IFeeTemplate>("FeeTemplate", FeeTemplateSchema);
