import mongoose, { Schema, Document, Model } from "mongoose";

export type StudentStatus = "ACTIVE" | "INACTIVE" | "DROPPED";

export const STUDENT_STATUSES: StudentStatus[] = [
  "ACTIVE",
  "INACTIVE",
  "DROPPED",
];

/** Canonical grade / class labels (Nursery through 12th). */
export const STUDENT_CLASSES = [
  "Nursery",
  "KG",
  "Prep",
  "1st",
  "2nd",
  "3rd",
  "4th",
  "5th",
  "6th",
  "7th",
  "8th",
  "9th",
  "10th",
  "11th",
  "12th",
] as const;

export type StudentClass = (typeof STUDENT_CLASSES)[number];

export const STUDENT_SECTIONS = ["A", "B", "C", "D"] as const;

export type StudentSection = (typeof STUDENT_SECTIONS)[number];

export const STUDENT_GENDERS = ["MALE", "FEMALE", "OTHER"] as const;

export type StudentGender = (typeof STUDENT_GENDERS)[number];

/** Allowed range for `courseDurationMonths` (enrollment length). */
export const COURSE_DURATION_MONTHS_MIN = 1;
export const COURSE_DURATION_MONTHS_MAX = 12;

export interface IStudent extends Document {
  tenantId: string;

  studentName: string;
  admissionId?: string;
  scholarId?: string;

  parentName: string;
  parentPhoneNumber: string;
  alternatePhone?: string;
  parentEmail?: string;

  panNumber?: string;

  dateOfBirth?: Date;
  gender?: StudentGender;
  /** Single-line mailing / contact address. */
  address?: string;

  /** Required for school tenants; omitted for academy. */
  class?: StudentClass;
  section?: StudentSection;
  /** Required for academy tenants; optional for school. */
  courseId?: string;
  /** Enrollment length in whole months (typically academy). */
  courseDurationMonths?: number;

  status: StudentStatus;

  joinedAt?: Date;
  leftAt?: Date;

  tags?: string[];

  /** Public HTTPS URL of the student photo (e.g. S3 or CloudFront). */
  photoUrl?: string;

  createdAt: Date;
  updatedAt: Date;
}

const StudentSchema = new Schema<IStudent>(
  {
    tenantId: { type: String, required: true, index: true },

    studentName: { type: String, required: true, trim: true },
    admissionId: { type: String, trim: true },
    scholarId: { type: String, trim: true },

    parentName: { type: String, required: true, trim: true },
    parentPhoneNumber: { type: String, required: true, trim: true },
    alternatePhone: { type: String, trim: true },
    parentEmail: { type: String, trim: true, lowercase: true },

    panNumber: { type: String, trim: true },

    dateOfBirth: { type: Date },
    gender: { type: String, trim: true },
    address: { type: String, trim: true, maxlength: 500 },

    class: {
      type: String,
      required: false,
      trim: true,
      enum: STUDENT_CLASSES,
    },
    section: {
      type: String,
      required: false,
      trim: true,
      enum: STUDENT_SECTIONS,
    },
    courseId: { type: String, trim: true },
    courseDurationMonths: { type: Number },

    status: {
      type: String,
      enum: STUDENT_STATUSES,
      default: "ACTIVE",
    },

    joinedAt: { type: Date },
    leftAt: { type: Date },

    tags: [{ type: String, trim: true }],

    photoUrl: { type: String, trim: true, maxlength: 2048 },
  },
  {
    timestamps: true,
  },
);

StudentSchema.index({ tenantId: 1, status: 1 });
StudentSchema.index({ tenantId: 1, class: 1 });
/** One non-empty scholarId per tenant (import + API rely on this). */
StudentSchema.index(
  { tenantId: 1, scholarId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      scholarId: { $type: "string", $nin: [null, ""] },
    },
  },
);

export const Student: Model<IStudent> =
  mongoose.models.Student ?? mongoose.model<IStudent>("Student", StudentSchema);
