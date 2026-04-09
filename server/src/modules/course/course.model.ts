import mongoose, { Schema, Document, Model } from "mongoose";

export interface ICourse extends Document {
  tenantId: string;
  name: string;
  shortCode?: string;
  description?: string;
  /** Display order within tenant lists (lower first). */
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CourseSchema = new Schema<ICourse>(
  {
    tenantId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    shortCode: { type: String, trim: true },
    description: { type: String, trim: true },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

CourseSchema.index({ tenantId: 1, isActive: 1 });
CourseSchema.index({ tenantId: 1, sortOrder: 1, name: 1 });

export const Course: Model<ICourse> =
  mongoose.models.Course ?? mongoose.model<ICourse>("Course", CourseSchema);
