import mongoose, { Schema, Document, Model } from "mongoose";

export type FeeType = "TUITION" | "TRANSPORT" | "HOSTEL" | "OTHER";

export const FEE_TYPES: FeeType[] = [
  "TUITION",
  "TRANSPORT",
  "HOSTEL",
  "OTHER",
];

export type FeeStatus = "PENDING" | "PARTIAL" | "PAID" | "OVERDUE";

export const FEE_STATUSES: FeeStatus[] = [
  "PENDING",
  "PARTIAL",
  "PAID",
  "OVERDUE",
];

export type FeeSource = "TEMPLATE" | "CUSTOM";

export const FEE_SOURCES: FeeSource[] = ["TEMPLATE", "CUSTOM"];

export interface IFee extends Document {
  tenantId: string;
  studentId: string;

  /** How this fee was created; fee data is always stored on the document (no live template link). */
  source: FeeSource;

  /** Snapshot reference when source is TEMPLATE; must be absent when source is CUSTOM. */
  templateId?: string;

  title: string;
  description?: string;

  feeType: FeeType;
  category?: string;

  metadata?: Record<string, unknown>;

  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;

  isInstallment: boolean;

  status: FeeStatus;

  startDate?: Date;
  endDate?: Date;

  tags?: string[];

  createdAt: Date;
  updatedAt: Date;
}

const FeeSchema = new Schema<IFee>(
  {
    tenantId: { type: String, required: true, index: true },
    studentId: { type: String, required: true, index: true },

    source: {
      type: String,
      enum: FEE_SOURCES,
      required: true,
      default: "CUSTOM",
      index: true,
    },

    templateId: { type: String, trim: true, index: true, sparse: true },

    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },

    feeType: {
      type: String,
      enum: FEE_TYPES,
      required: true,
      index: true,
    },

    category: { type: String, trim: true },

    metadata: {
      type: Schema.Types.Mixed,
    },

    totalAmount: { type: Number, required: true },
    paidAmount: { type: Number, default: 0 },
    pendingAmount: { type: Number, required: true },

    isInstallment: { type: Boolean, default: false },

    status: {
      type: String,
      enum: FEE_STATUSES,
      default: "PENDING",
      index: true,
    },

    startDate: { type: Date },
    endDate: { type: Date },

    tags: [{ type: String, trim: true }],
  },
  {
    timestamps: true,
  },
);

FeeSchema.index({ tenantId: 1, studentId: 1 });
FeeSchema.index({ tenantId: 1, status: 1 });
FeeSchema.index({ tenantId: 1, feeType: 1 });
FeeSchema.index({ tenantId: 1, templateId: 1 }, { sparse: true });
/** One TEMPLATE fee per student per template (duplicate assignment guard). */
FeeSchema.index(
  { tenantId: 1, studentId: 1, templateId: 1 },
  {
    unique: true,
    partialFilterExpression: { source: { $eq: "TEMPLATE" } },
  },
);

FeeSchema.pre("validate", function (next) {
  const doc = this as IFee;
  if (doc.source == null || doc.source === undefined) {
    if (doc.templateId != null && String(doc.templateId).trim() !== "") {
      doc.set("source", "TEMPLATE");
    } else {
      doc.set("source", "CUSTOM");
    }
  }
  const src = doc.source;
  const tid = doc.templateId;

  if (src === "TEMPLATE") {
    if (!tid || String(tid).trim() === "") {
      next(new Error("templateId is required when source is TEMPLATE"));
      return;
    }
  } else if (src === "CUSTOM") {
    if (tid != null && String(tid).trim() !== "") {
      next(new Error("templateId must not be set when source is CUSTOM"));
      return;
    }
  }
  next();
});

export const Fee: Model<IFee> =
  mongoose.models.Fee ?? mongoose.model<IFee>("Fee", FeeSchema);
