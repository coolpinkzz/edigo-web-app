import crypto from "crypto";
import fs from "fs/promises";
import mongoose from "mongoose";
import path from "path";
import { Tenant } from "../auth/tenant.model";
import { assertBranchBelongsToTenant } from "../branch/branch.service";
import { Branch } from "../branch/branch.model";
import { Course } from "../course/course.model";
import { FeeTemplate } from "../fee-template/fee-template.model";
import { sendSms } from "../reminder/sms.service";
import { logger } from "../../utils/logger";
import { env } from "../../config/env";
import {
  assertDocumentBranchAccess,
  mergeBranchScopeOnQuery,
  resolveBranchScopeFromRequest,
  type BranchScope,
} from "../../types/branch-scope";
import type { JwtPayload } from "../../types/express";
import { ROLES } from "../../types/roles";
import {
  STUDENT_CLASSES,
  STUDENT_SECTIONS,
  type StudentClass,
  type StudentSection,
} from "../student/student.model";
import { getTenantType } from "../student/student.service";
import { buildQuotationPdfBuffer } from "./quotation-pdf.service";
import { IQuotation, Quotation, QuotationStatus } from "./quotation.model";
import { QuotationSequence } from "./quotation-sequence.model";
import type { CreateQuotationBody, UpdateQuotationBody } from "./quotation.validation";

const SCOPE = "quotation.service";

function roundMoney2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function quotedTotals(base: number, discountPercent: number): {
  discountAmount: number;
  quotedTotal: number;
} {
  const d = roundMoney2((base * discountPercent) / 100);
  const q = roundMoney2(Math.max(0, base - d));
  return { discountAmount: d, quotedTotal: q };
}

async function nextQuotationRef(tenantId: string): Promise<string> {
  const year = new Date().getFullYear();
  const updated = await QuotationSequence.findOneAndUpdate(
    { tenantId, year },
    { $inc: { seq: 1 }, $setOnInsert: { tenantId, year } },
    { new: true, upsert: true },
  ).exec();
  const n = updated.seq.toString().padStart(5, "0");
  return `QUO-${year}-${n}`;
}

function startOfTodayUtcDate(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export async function persistQuotationExpiredIfNeeded(
  doc: IQuotation,
): Promise<QuotationStatus> {
  let status = doc.status;
  if (
    (status === "DRAFT" || status === "SENT") &&
    doc.validUntil < startOfTodayUtcDate()
  ) {
    await Quotation.updateOne(
      { _id: doc._id, status: { $in: ["DRAFT", "SENT"] } },
      { $set: { status: "EXPIRED" } },
    ).exec();
    status = "EXPIRED";
  }
  return status;
}

async function loadFeeTemplateForTenant(
  tenantId: string,
  feeTemplateId: string,
): Promise<{
  title: string;
  totalAmount: number;
  feeType: import("../fee/fee.model").FeeType;
  isInstallment: boolean;
}> {
  const t = await FeeTemplate.findOne({
    _id: feeTemplateId,
    tenantId,
  }).exec();
  if (!t) {
    throw new Error("Fee structure not found");
  }
  return {
    title: t.title,
    totalAmount: t.totalAmount,
    feeType: t.feeType,
    isInstallment: Boolean(t.isInstallment),
  };
}

async function resolveCourseFields(
  tenantId: string,
  courseId: string | undefined,
  courseCustomName: string | undefined,
): Promise<{ courseId?: string; courseDisplayName: string }> {
  const id = courseId?.trim() ?? "";
  const custom = courseCustomName?.trim() ?? "";
  if (id) {
    if (!mongoose.isValidObjectId(id)) {
      throw new Error("Invalid course id");
    }
    const c = await Course.findOne({ _id: id, tenantId }).exec();
    if (!c) {
      throw new Error("Course not found");
    }
    return { courseId: id, courseDisplayName: c.name };
  }
  return { courseDisplayName: custom };
}

export type QuotationPublic = {
  id: string;
  tenantId: string;
  branchId: string;
  branchName?: string;
  quotationRef: string;
  name: string;
  parentName: string;
  gender: string;
  age: number;
  courseId?: string;
  courseDisplayName: string;
  phone: string;
  address: string;
  email?: string;
  discountPercent: number;
  discountAmount: number;
  quotedTotal: number;
  websiteUrl?: string;
  youtubeUrl?: string;
  instagramUrl?: string;
  status: QuotationStatus;
  feeTemplateId: string;
  feeStructureTitle: string;
  feeStructureTotalAmount: number;
  feeStructureType: string;
  feeStructureIsInstallment: boolean;
  validUntil: string;
  preferredTimeSlot: string;
  schoolClass?: string;
  schoolSection?: string;
  quotationOverview?: string;
  notes?: string;
  createdByUserId: string;
  pdfGeneratedAt?: string;
  pdfAccessExpiresAt?: string;
  smsSentAt?: string;
  conversionStudentId?: string;
  conversionFeeId?: string;
  checkoutPayTokenExpiresAt?: string;
  createdAt: string;
  updatedAt: string;
};

async function branchNameFor(
  tenantId: string,
  branchId: string,
): Promise<string | undefined> {
  if (!mongoose.isValidObjectId(branchId)) return undefined;
  const b = await Branch.findOne({ _id: branchId, tenantId }).exec();
  return b?.name;
}

async function toPublic(doc: IQuotation, tenantId: string): Promise<QuotationPublic> {
  const status = await persistQuotationExpiredIfNeeded(doc);
  const { discountAmount, quotedTotal } = quotedTotals(
    doc.feeStructureTotalAmount,
    doc.discountPercent,
  );
  const bName = await branchNameFor(tenantId, doc.branchId);
  return {
    id: doc._id.toString(),
    tenantId: doc.tenantId,
    branchId: doc.branchId,
    branchName: bName,
    quotationRef: doc.quotationRef,
    name: doc.name,
    parentName: doc.parentName,
    gender: doc.gender,
    age: doc.age,
    courseId: doc.courseId,
    courseDisplayName: doc.courseDisplayName,
    phone: doc.phone,
    address: doc.address,
    email: doc.email,
    discountPercent: doc.discountPercent,
    discountAmount,
    quotedTotal,
    websiteUrl: doc.websiteUrl,
    youtubeUrl: doc.youtubeUrl,
    instagramUrl: doc.instagramUrl,
    status,
    feeTemplateId: doc.feeTemplateId,
    feeStructureTitle: doc.feeStructureTitle,
    feeStructureTotalAmount: doc.feeStructureTotalAmount,
    feeStructureType: doc.feeStructureType,
    feeStructureIsInstallment: doc.feeStructureIsInstallment,
    validUntil: doc.validUntil.toISOString(),
    preferredTimeSlot: doc.preferredTimeSlot,
    schoolClass: doc.schoolClass,
    schoolSection: doc.schoolSection,
    quotationOverview: doc.quotationOverview,
    notes: doc.notes,
    createdByUserId: doc.createdByUserId,
    pdfGeneratedAt: doc.pdfGeneratedAt?.toISOString(),
    pdfAccessExpiresAt: doc.pdfAccessExpiresAt?.toISOString(),
    smsSentAt: doc.smsSentAt?.toISOString(),
    conversionStudentId: doc.conversionStudentId,
    conversionFeeId: doc.conversionFeeId,
    checkoutPayTokenExpiresAt: doc.checkoutPayTokenExpiresAt?.toISOString(),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

function quotationPdfDir(): string {
  const raw = env.quotationPdfDir.trim();
  if (raw) {
    return path.isAbsolute(raw) ? raw : path.join(process.cwd(), raw);
  }
  return path.join(process.cwd(), "uploads", "quotations");
}

function pdfTokenTtlDays(): number {
  return Math.min(env.quotationPdfTokenTtlDays, 365);
}

async function ensureQuotationPdfDir(): Promise<void> {
  const dir = quotationPdfDir();
  await fs.mkdir(dir, { recursive: true });
}

function relativePdfPath(tenantId: string, quotationId: string): string {
  return path.join(tenantId, `${quotationId}.pdf`);
}

export async function createQuotation(
  tenantId: string,
  user: JwtPayload,
  body: CreateQuotationBody,
): Promise<QuotationPublic> {
  await assertBranchBelongsToTenant(tenantId, body.branchId);
  const fee = await loadFeeTemplateForTenant(tenantId, body.feeTemplateId);
  const tenantType = await getTenantType(tenantId);

  let courseId: string | undefined;
  let courseDisplayName: string;
  let schoolClass: StudentClass | undefined;
  let schoolSection: StudentSection | undefined;

  if (tenantType === "SCHOOL") {
    const cls = body.class?.trim() ?? "";
    const sec = body.section?.trim() ?? "";
    if (!cls || !(STUDENT_CLASSES as readonly string[]).includes(cls)) {
      throw new Error("Class is required and must be a valid option");
    }
    if (!sec || !(STUDENT_SECTIONS as readonly string[]).includes(sec)) {
      throw new Error("Section is required and must be a valid option");
    }
    schoolClass = cls as StudentClass;
    schoolSection = sec as StudentSection;
    courseDisplayName = `${cls} — Sec. ${sec}`;
  } else {
    const hasId = Boolean(body.courseId?.trim());
    const hasName = Boolean(body.courseCustomName?.trim());
    if (hasId && hasName) {
      throw new Error("Provide either courseId or courseCustomName, not both");
    }
    const course = await resolveCourseFields(
      tenantId,
      hasId ? body.courseId : undefined,
      hasName ? body.courseCustomName : undefined,
    );
    if (!course.courseDisplayName.trim()) {
      throw new Error("Select a course or enter a custom program name");
    }
    courseId = course.courseId;
    courseDisplayName = course.courseDisplayName;
  }

  const ref = await nextQuotationRef(tenantId);

  const doc = await Quotation.create({
    tenantId,
    branchId: body.branchId,
    quotationRef: ref,
    name: body.name,
    parentName: body.parentName,
    gender: body.gender,
    age: body.age,
    courseId: tenantType === "SCHOOL" ? undefined : courseId,
    courseDisplayName,
    schoolClass,
    schoolSection,
    phone: body.phone,
    address: body.address,
    email: body.email?.trim() || undefined,
    discountPercent: body.discountPercent,
    websiteUrl: body.websiteUrl?.trim() || undefined,
    youtubeUrl: body.youtubeUrl?.trim() || undefined,
    instagramUrl: body.instagramUrl?.trim() || undefined,
    status: "DRAFT",
    feeTemplateId: body.feeTemplateId,
    feeStructureTitle: fee.title,
    feeStructureTotalAmount: fee.totalAmount,
    feeStructureType: fee.feeType,
    feeStructureIsInstallment: fee.isInstallment,
    validUntil: new Date(body.validUntil),
    preferredTimeSlot: body.preferredTimeSlot,
    quotationOverview: body.quotationOverview?.trim() || undefined,
    notes: body.notes?.trim() || undefined,
    createdByUserId: user.userId,
  });

  return toPublic(doc, tenantId);
}

export async function updateQuotation(
  tenantId: string,
  id: string,
  user: JwtPayload,
  body: UpdateQuotationBody,
): Promise<QuotationPublic | null> {
  if (!mongoose.isValidObjectId(id)) return null;
  const existing = await Quotation.findOne({ _id: id, tenantId }).exec();
  if (!existing) return null;
  if (user.role !== ROLES.SUPER_ADMIN) {
    assertDocumentBranchAccess(user, existing.branchId);
  }

  if (existing.status === "ACCEPTED" || existing.status === "REJECTED") {
    throw new Error("Cannot edit accepted or rejected quotations");
  }

  const patch: Record<string, unknown> = {};

  if (body.branchId !== undefined) {
    await assertBranchBelongsToTenant(tenantId, body.branchId);
    patch.branchId = body.branchId;
  }
  if (body.name !== undefined) patch.name = body.name;
  if (body.parentName !== undefined) patch.parentName = body.parentName;
  if (body.gender !== undefined) patch.gender = body.gender;
  if (body.age !== undefined) patch.age = body.age;
  if (body.phone !== undefined) patch.phone = body.phone;
  if (body.address !== undefined) patch.address = body.address;
  if (body.email !== undefined) {
    patch.email = body.email?.trim() || undefined;
  }
  if (body.discountPercent !== undefined) patch.discountPercent = body.discountPercent;
  if (body.websiteUrl !== undefined) {
    patch.websiteUrl = body.websiteUrl?.trim() || undefined;
  }
  if (body.youtubeUrl !== undefined) {
    patch.youtubeUrl = body.youtubeUrl?.trim() || undefined;
  }
  if (body.instagramUrl !== undefined) {
    patch.instagramUrl = body.instagramUrl?.trim() || undefined;
  }
  if (body.validUntil !== undefined) patch.validUntil = new Date(body.validUntil);
  if (body.preferredTimeSlot !== undefined) {
    patch.preferredTimeSlot = body.preferredTimeSlot;
  }
  if (body.quotationOverview !== undefined) {
    patch.quotationOverview = body.quotationOverview?.trim() || undefined;
  }
  if (body.notes !== undefined) patch.notes = body.notes?.trim() || undefined;
  if (body.status !== undefined) {
    if (body.status === "SENT") {
      throw new Error('Use "Generate PDF & send SMS" to mark as sent');
    }
    patch.status = body.status;
  }

  if (body.feeTemplateId !== undefined) {
    const fee = await loadFeeTemplateForTenant(tenantId, body.feeTemplateId);
    patch.feeTemplateId = body.feeTemplateId;
    patch.feeStructureTitle = fee.title;
    patch.feeStructureTotalAmount = fee.totalAmount;
    patch.feeStructureType = fee.feeType;
    patch.feeStructureIsInstallment = fee.isInstallment;
  }

  const tenantType = await getTenantType(tenantId);
  let unsetCourseId = false;
  if (tenantType === "SCHOOL") {
    if (body.class !== undefined || body.section !== undefined) {
      const cls = (body.class?.trim() || existing.schoolClass || "");
      const sec = (body.section?.trim() || existing.schoolSection || "");
      if (!cls || !(STUDENT_CLASSES as readonly string[]).includes(cls)) {
        throw new Error("Class is required and must be a valid option");
      }
      if (!sec || !(STUDENT_SECTIONS as readonly string[]).includes(sec)) {
        throw new Error("Section is required and must be a valid option");
      }
      patch.schoolClass = cls as StudentClass;
      patch.schoolSection = sec as StudentSection;
      patch.courseDisplayName = `${cls} — Sec. ${sec}`;
      unsetCourseId = true;
    }
  } else {
    const hasCourseId = Object.prototype.hasOwnProperty.call(
      body,
      "courseId",
    );
    const hasCustom = Object.prototype.hasOwnProperty.call(
      body,
      "courseCustomName",
    );
    if (hasCourseId || hasCustom) {
      const rawId = hasCourseId ? body.courseId : undefined;
      const rawName = hasCustom ? body.courseCustomName : undefined;
      const cid = typeof rawId === "string" ? rawId.trim() : "";
      const cname = typeof rawName === "string" ? rawName.trim() : "";
      if (cid) {
        const c = await Course.findOne({ _id: cid, tenantId }).exec();
        if (!c) throw new Error("Course not found");
        patch.courseId = cid;
        patch.courseDisplayName = c.name;
      } else if (cname) {
        patch.courseDisplayName = cname;
        unsetCourseId = true;
      }
    }
  }

  Object.assign(existing, patch);
  if (unsetCourseId) {
    existing.set("courseId", undefined);
  }
  await existing.save();
  return toPublic(existing, tenantId);
}

export async function listQuotations(
  tenantId: string,
  user: JwtPayload,
  scope: BranchScope,
  query: { status?: QuotationStatus; page: number; limit: number },
): Promise<{ data: QuotationPublic[]; total: number; page: number; limit: number; totalPages: number }> {
  const filter: Record<string, unknown> = { tenantId };
  if (query.status) {
    filter.status = query.status;
  }
  const merged = mergeBranchScopeOnQuery(filter, scope);
  const page = query.page;
  const limit = query.limit;
  const skip = (page - 1) * limit;

  const [total, docs] = await Promise.all([
    Quotation.countDocuments(merged).exec(),
    Quotation.find(merged)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec(),
  ]);

  const data = await Promise.all(docs.map((d) => toPublic(d, tenantId)));
  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

export async function getQuotationById(
  tenantId: string,
  id: string,
  user: JwtPayload,
): Promise<QuotationPublic | null> {
  if (!mongoose.isValidObjectId(id)) return null;
  const doc = await Quotation.findOne({ _id: id, tenantId }).exec();
  if (!doc) return null;
  if (user.role !== ROLES.SUPER_ADMIN) {
    assertDocumentBranchAccess(user, doc.branchId);
  }
  return toPublic(doc, tenantId);
}

export async function getQuotationDocForTenant(
  tenantId: string,
  id: string,
): Promise<IQuotation | null> {
  if (!mongoose.isValidObjectId(id)) return null;
  return Quotation.findOne({ _id: id, tenantId }).exec();
}

async function buildPdfForDoc(doc: IQuotation): Promise<Buffer> {
  const tenant = await Tenant.findById(doc.tenantId).exec();
  const orgName = tenant?.name ?? "Institute";
  const branch = await Branch.findOne({
    _id: doc.branchId,
    tenantId: doc.tenantId,
  }).exec();
  const branchName = branch?.name ?? "—";
  const orgAddress = branch?.address?.trim() || undefined;
  const { discountAmount, quotedTotal } = quotedTotals(
    doc.feeStructureTotalAmount,
    doc.discountPercent,
  );

  const base = env.publicAppUrl?.trim();
  let acceptAndPayUrl: string | undefined;
  let acceptAndPayExpired = false;
  if (base && doc.pdfAccessToken) {
    const expMs = doc.pdfAccessExpiresAt?.getTime();
    const stillValid = expMs == null || expMs > Date.now();
    if (stillValid) {
      acceptAndPayUrl = `${base}/public/quotations/${doc._id.toString()}/checkout?token=${encodeURIComponent(doc.pdfAccessToken)}`;
    } else {
      acceptAndPayExpired = true;
    }
  }

  const tenantType = await getTenantType(doc.tenantId);
  const hasSchoolPlacement = Boolean(
    doc.schoolClass?.trim() && doc.schoolSection?.trim(),
  );

  return buildQuotationPdfBuffer({
    orgName,
    orgAddress,
    orgLogoUrl: tenant?.logoUrl,
    quotationRef: doc.quotationRef,
    issuedAt: doc.pdfGeneratedAt ?? new Date(),
    validUntil: doc.validUntil,
    quotationOverview: doc.quotationOverview,
    courseDisplayName: doc.courseDisplayName,
    schoolClass: doc.schoolClass,
    schoolSection: doc.schoolSection,
    courseFeeBarTitle: hasSchoolPlacement ? "Class & fee" : "Course & fee",
    includeClassSectionNextPageHint:
      tenantType === "SCHOOL" && !hasSchoolPlacement,
    branchName,
    feeStructureTitle: doc.feeStructureTitle,
    feeType: doc.feeStructureType,
    feeBaseTotal: doc.feeStructureTotalAmount,
    isInstallment: doc.feeStructureIsInstallment,
    discountPercent: doc.discountPercent,
    discountAmount,
    quotedTotal,
    preferredTimeSlot: doc.preferredTimeSlot,
    websiteUrl: doc.websiteUrl,
    youtubeUrl: doc.youtubeUrl,
    instagramUrl: doc.instagramUrl,
    acceptAndPayUrl,
    acceptAndPayExpired,
    notes: doc.notes,
  });
}

export async function generatePdfBufferForQuotation(
  tenantId: string,
  id: string,
  user: JwtPayload,
): Promise<{ buffer: Buffer; filename: string } | null> {
  const doc = await Quotation.findOne({ _id: id, tenantId }).exec();
  if (!doc) return null;
  if (user.role !== ROLES.SUPER_ADMIN) {
    assertDocumentBranchAccess(user, doc.branchId);
  }
  await persistQuotationExpiredIfNeeded(doc);
  const buffer = await buildPdfForDoc(doc);
  const safe = doc.quotationRef.replace(/[^\w-]+/g, "_");
  return { buffer, filename: `Quotation-${safe}.pdf` };
}

/** `smsError` is set when the PDF was generated and stored but SMS delivery failed. */
export type QuotationSendSmsResult = QuotationPublic & { smsError?: string };

export async function generateStorePdfAndSendSms(
  tenantId: string,
  id: string,
  user: JwtPayload,
): Promise<QuotationSendSmsResult | null> {
  const doc = await Quotation.findOne({ _id: id, tenantId }).exec();
  if (!doc) return null;
  if (user.role !== ROLES.SUPER_ADMIN) {
    assertDocumentBranchAccess(user, doc.branchId);
  }
  if (doc.status === "ACCEPTED" || doc.status === "REJECTED") {
    throw new Error("Cannot send PDF for accepted or rejected quotations");
  }

  const sendStatus = await persistQuotationExpiredIfNeeded(doc);
  if (sendStatus === "EXPIRED") {
    throw new Error("Quotation has expired; update valid until or create a new one");
  }

  const base = env.publicAppUrl;
  if (!base?.trim()) {
    throw new Error(
      "PUBLIC_APP_URL is not configured on the server; cannot send SMS with PDF link",
    );
  }

  doc.pdfGeneratedAt = new Date();
  const token = crypto.randomBytes(24).toString("hex");
  const ttlDays = pdfTokenTtlDays();
  const pdfAccessExpiresAt = new Date();
  pdfAccessExpiresAt.setDate(pdfAccessExpiresAt.getDate() + ttlDays);
  doc.pdfAccessToken = token;
  doc.pdfAccessExpiresAt = pdfAccessExpiresAt;

  const buffer = await buildPdfForDoc(doc);
  await ensureQuotationPdfDir();
  const rel = relativePdfPath(tenantId, doc._id.toString());
  const abs = path.join(quotationPdfDir(), rel);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, buffer);

  const pdfUrl = `${base}/public/quotations/${doc._id.toString()}/pdf?token=${encodeURIComponent(token)}`;
  const checkoutUrl = `${base}/public/quotations/${doc._id.toString()}/checkout?token=${encodeURIComponent(token)}`;
  const tenant = await Tenant.findById(tenantId).exec();
  const org = tenant?.name ?? "Institute";
  const validShort = doc.validUntil.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const totals = quotedTotals(doc.feeStructureTotalAmount, doc.discountPercent);
  const msg = `${org}: Hello ${doc.name}, your quotation ${doc.quotationRef} is ready. Total after discount: Rs ${totals.quotedTotal.toLocaleString("en-IN")}. View PDF (expires in ${ttlDays}d): ${pdfUrl} Accept & pay: ${checkoutUrl} Valid until ${validShort}.`;

  const sms = await sendSms(doc.phone, msg);
  if (!sms.ok) {
    doc.pdfRelativePath = rel;
    await doc.save();
    logger.error(SCOPE, "quotation SMS failed; PDF kept for download", {
      tenantId,
      quotationId: doc._id.toString(),
      error: sms.error,
    });
    const pub = await toPublic(doc, tenantId);
    return { ...pub, smsError: sms.error ?? "SMS failed" };
  }

  doc.pdfRelativePath = rel;
  doc.status = "SENT";
  doc.smsSentAt = new Date();
  await doc.save();

  return toPublic(doc, tenantId);
}

export async function streamStoredPdfPublic(
  quotationId: string,
  token: string,
): Promise<{ buffer: Buffer; filename: string } | null> {
  if (!mongoose.isValidObjectId(quotationId) || !token?.trim()) {
    return null;
  }
  const doc = await Quotation.findById(quotationId).exec();
  if (
    !doc?.pdfAccessToken ||
    doc.pdfAccessToken !== token ||
    !doc.pdfAccessExpiresAt ||
    doc.pdfAccessExpiresAt.getTime() < Date.now()
  ) {
    return null;
  }
  if (!doc.pdfRelativePath) {
    return null;
  }
  const abs = path.join(quotationPdfDir(), doc.pdfRelativePath);
  try {
    const buffer = await fs.readFile(abs);
    doc.lastPdfAccessAt = new Date();
    void doc.save().catch(() => {});
    const safe = doc.quotationRef.replace(/[^\w-]+/g, "_");
    return { buffer, filename: `Quotation-${safe}.pdf` };
  } catch {
    return null;
  }
}

export async function streamStoredPdfAuthed(
  tenantId: string,
  id: string,
  user: JwtPayload,
): Promise<{ buffer: Buffer; filename: string } | null> {
  const doc = await Quotation.findOne({ _id: id, tenantId }).exec();
  if (!doc) return null;
  if (user.role !== ROLES.SUPER_ADMIN) {
    assertDocumentBranchAccess(user, doc.branchId);
  }
  if (!doc.pdfRelativePath) {
    return null;
  }
  const abs = path.join(quotationPdfDir(), doc.pdfRelativePath);
  try {
    const buffer = await fs.readFile(abs);
    const safe = doc.quotationRef.replace(/[^\w-]+/g, "_");
    return { buffer, filename: `Quotation-${safe}.pdf` };
  } catch {
    return null;
  }
}

export { resolveBranchScopeFromRequest };
