import mongoose, { Schema, Document, Model } from "mongoose";

/**
 * One row per parent SMS for absence per student per calendar day (dedupe).
 * Jobs are drained by the in-process attendance notification queue.
 */
export interface IAttendanceAbsenceNotification extends Document {
  tenantId: string;
  studentId: string;
  dateKey: string;
  attendanceId: string;
  jobStatus: "queued" | "sent" | "failed";
  queuedAt: Date;
  sentAt?: Date;
  lastError?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AttendanceAbsenceNotificationSchema =
  new Schema<IAttendanceAbsenceNotification>(
    {
      tenantId: { type: String, required: true, index: true },
      studentId: { type: String, required: true, trim: true },
      dateKey: { type: String, required: true, trim: true },
      attendanceId: { type: String, required: true, trim: true },
      jobStatus: {
        type: String,
        required: true,
        enum: ["queued", "sent", "failed"],
        default: "queued",
      },
      queuedAt: { type: Date, required: true, default: () => new Date() },
      sentAt: { type: Date },
      lastError: { type: String, trim: true },
    },
    { timestamps: true },
  );

AttendanceAbsenceNotificationSchema.index(
  { tenantId: 1, studentId: 1, dateKey: 1 },
  { unique: true },
);

export const AttendanceAbsenceNotification: Model<IAttendanceAbsenceNotification> =
  mongoose.models.AttendanceAbsenceNotification ??
  mongoose.model<IAttendanceAbsenceNotification>(
    "AttendanceAbsenceNotification",
    AttendanceAbsenceNotificationSchema,
  );
