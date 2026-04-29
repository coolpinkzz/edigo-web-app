import mongoose, { Schema, Document, Model } from "mongoose";

export interface IQuotationSequence extends Document {
  tenantId: string;
  year: number;
  seq: number;
}

const QuotationSequenceSchema = new Schema<IQuotationSequence>(
  {
    tenantId: { type: String, required: true },
    year: { type: Number, required: true },
    seq: { type: Number, required: true, default: 0 },
  },
  { collection: "quotation_sequences" },
);

QuotationSequenceSchema.index({ tenantId: 1, year: 1 }, { unique: true });

export const QuotationSequence: Model<IQuotationSequence> =
  mongoose.models.QuotationSequence ??
  mongoose.model<IQuotationSequence>(
    "QuotationSequence",
    QuotationSequenceSchema,
  );
