import crypto from "crypto";
import PDFDocument from "pdfkit";
import mongoose from "mongoose";

type PdfDoc = InstanceType<typeof PDFDocument>;
import { Tenant } from "../auth/tenant.model";
import { Course } from "../course/course.model";
import { Fee } from "../fee/fee.model";
import { Installment } from "../fee/installment.model";
import { Payment } from "../payment/payment.model";
import { Student } from "../student/student.model";
import { logger } from "../../utils/logger";
import { IInvoice, Invoice } from "./invoice.model";

const SCOPE = "invoice.service";

function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: number }).code === 11000
  );
}

function generateInvoiceNumber(): string {
  const y = new Date().getFullYear();
  const rnd = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `INV-${y}-${rnd}`;
}

function paiseToRupees(paise: number): number {
  return Math.round(paise) / 100;
}

function formatMoney(paise: number, currency: string): string {
  const rupees = paiseToRupees(paise);
  // Use "Rs" — Helvetica in PDFKit does not render ₹ reliably (shows as a stray glyph).
  const sym = currency.toUpperCase() === "INR" ? "Rs " : `${currency} `;
  return `${sym}${rupees.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function normalizeDisplayValue(value: string | undefined): string | undefined {
  const v = value?.trim();
  if (!v) return undefined;
  const upper = v.toUpperCase();
  if (upper === "N/A" || upper === "NA" || v === "-") {
    return undefined;
  }
  return v;
}

const PDF_BORDER = "#cbd5e1";
/** Teal-600 — section title bars (replaces blue) */
const PDF_HEADER_BG = "#0d9488";
const PDF_ROW_A = "#f0fdfa";
const PDF_ROW_B = "#ffffff";
const PDF_LABEL = "#475569";
const PDF_VALUE = "#134e4a";
const PDF_META_BG = "#f0fdfa";
const PDF_TOTAL_BG = "#ccfbf1";
const PDF_TOTAL_BORDER = "#2dd4bf";
const PDF_TOTAL_TEXT = "#115e59";

function drawSectionBar(doc: PdfDoc, x: number, y: number, w: number, title: string): number {
  const h = 26;
  doc.rect(x, y, w, h).fill(PDF_HEADER_BG);
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(11);
  doc.text(title, x + 14, y + 8, { width: w - 28 });
  doc.fillColor("#000000");
  return y + h;
}

function drawMetaTable(
  doc: PdfDoc,
  x: number,
  y: number,
  w: number,
  invoiceNo: string,
  dateStr: string,
): number {
  const h = 44;
  doc.rect(x, y, w, h).fill(PDF_META_BG);
  doc.strokeColor(PDF_BORDER).lineWidth(0.75);
  doc.rect(x, y, w, h).stroke();
  doc.moveTo(x + w / 2, y).lineTo(x + w / 2, y + h).stroke();
  doc.fillColor(PDF_LABEL).font("Helvetica-Bold").fontSize(9);
  doc.text("Invoice number", x + 14, y + 8, { width: w / 2 - 20 });
  doc.text("Date & time", x + w / 2 + 14, y + 8, { width: w / 2 - 20 });
  doc.fillColor(PDF_VALUE).font("Helvetica").fontSize(10);
  doc.text(invoiceNo, x + 14, y + 22, { width: w / 2 - 20 });
  doc.text(dateStr, x + w / 2 + 14, y + 22, { width: w / 2 - 20 });
  return y + h;
}

function drawKeyValueTable(
  doc: PdfDoc,
  x: number,
  y: number,
  w: number,
  rows: { label: string; value: string }[],
): number {
  const labelColW = 132;
  const padH = 10;
  const padV = 6;
  const minRowH = 22;
  const valueW = w - labelColW - 20;

  doc.font("Helvetica").fontSize(9);
  const heights = rows.map((row) => {
    doc.font("Helvetica-Bold");
    const hL = doc.heightOfString(row.label, { width: labelColW - 8 });
    doc.font("Helvetica");
    const hV = doc.heightOfString(row.value, { width: valueW });
    return Math.max(minRowH, hL + padV * 2, hV + padV * 2);
  });
  const totalH = heights.reduce((sum, h) => sum + h, 0);

  let rowTop = y;
  rows.forEach((row, i) => {
    const rh = heights[i];
    const bg = i % 2 === 0 ? PDF_ROW_A : PDF_ROW_B;
    doc.rect(x, rowTop, w, rh).fill(bg);
    rowTop += rh;
  });

  doc.strokeColor(PDF_BORDER).lineWidth(0.75);
  doc.moveTo(x, y).lineTo(x + w, y).stroke();
  doc.moveTo(x, y + totalH).lineTo(x + w, y + totalH).stroke();
  doc.moveTo(x, y).lineTo(x, y + totalH).stroke();
  doc.moveTo(x + w, y).lineTo(x + w, y + totalH).stroke();
  doc.moveTo(x + labelColW, y).lineTo(x + labelColW, y + totalH).stroke();

  rowTop = y;
  rows.forEach((row, i) => {
    const rh = heights[i];
    if (i > 0) {
      doc.moveTo(x, rowTop).lineTo(x + w, rowTop).stroke();
    }
    doc.fillColor(PDF_LABEL).font("Helvetica-Bold").fontSize(9);
    doc.text(row.label, x + padH, rowTop + padV, { width: labelColW - 8 });
    doc.fillColor(PDF_VALUE).font("Helvetica").fontSize(9);
    doc.text(row.value, x + labelColW + padH, rowTop + padV, { width: valueW });
    rowTop += rh;
  });

  return y + totalH;
}

function drawTotalBar(doc: PdfDoc, x: number, y: number, w: number, amountLine: string): number {
  const h = 46;
  doc.rect(x, y, w, h).fill(PDF_TOTAL_BG);
  doc.strokeColor(PDF_TOTAL_BORDER).lineWidth(0.75);
  doc.rect(x, y, w, h).stroke();
  doc.fillColor(PDF_TOTAL_TEXT).font("Helvetica-Bold").fontSize(11);
  doc.text("Amount paid", x + 16, y + 10);
  doc.fontSize(18).text(amountLine, x + 16, y + 10, {
    width: w - 32,
    align: "right",
  });
  doc.fillColor("#000000");
  return y + h;
}

export type InvoicePublicDto = {
  invoiceNumber: string;
  paymentId: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  razorpayPaymentId?: string;
  issuedAt: string;
  schoolName: string;
  studentName: string;
  studentClass: string;
  studentSection: string;
  studentCourse?: string;
  admissionId?: string;
  scholarId?: string;
  parentName?: string;
  parentPhone?: string;
  feeTitle: string;
  feeType?: string;
  installmentLabel?: string;
};

function toDto(doc: IInvoice): InvoicePublicDto {
  return {
    invoiceNumber: doc.invoiceNumber,
    paymentId: doc.paymentId,
    amount: doc.amount,
    currency: doc.currency,
    paymentMethod: doc.paymentMethod,
    razorpayPaymentId: doc.razorpayPaymentId,
    issuedAt: doc.issuedAt.toISOString(),
    schoolName: doc.schoolName,
    studentName: doc.studentName,
    studentClass: doc.studentClass,
    studentSection: doc.studentSection,
    studentCourse: doc.studentCourse,
    admissionId: doc.admissionId,
    scholarId: doc.scholarId,
    parentName: doc.parentName,
    parentPhone: doc.parentPhone,
    feeTitle: doc.feeTitle,
    feeType: doc.feeType,
    installmentLabel: doc.installmentLabel,
  };
}

export async function getInvoiceDtoByPaymentId(
  paymentId: string,
): Promise<InvoicePublicDto | null> {
  if (!mongoose.isValidObjectId(paymentId)) {
    return null;
  }
  const payment = await Payment.findById(paymentId).exec();
  if (!payment || payment.status !== "SUCCESS") {
    return null;
  }
  const inv = await Invoice.findOne({ paymentId }).exec();
  if (!inv) {
    return null;
  }
  const dto = toDto(inv);
  if (normalizeDisplayValue(dto.studentCourse)) {
    return dto;
  }

  const tenant = await Tenant.findById(inv.tenantId).select("tenantType").lean().exec();
  if (tenant?.tenantType !== "ACADEMY") {
    return dto;
  }

  const student = await Student.findOne({
    _id: inv.studentId,
    tenantId: inv.tenantId,
  })
    .select("courseId")
    .lean()
    .exec();
  const courseId = student?.courseId?.trim();
  if (!courseId || !mongoose.isValidObjectId(courseId)) {
    return dto;
  }

  const course = await Course.findOne({
    _id: courseId,
    tenantId: inv.tenantId,
  })
    .select("name")
    .lean()
    .exec();
  const courseName = normalizeDisplayValue(course?.name);
  if (!courseName) {
    return dto;
  }

  return { ...dto, studentCourse: courseName };
}

export async function getInvoicePdfBufferByPaymentId(
  paymentId: string,
): Promise<{ filename: string; buffer: Buffer } | null> {
  const dto = await getInvoiceDtoByPaymentId(paymentId);
  if (!dto) {
    return null;
  }
  const buffer = await buildInvoicePdf(dto);
  const safe = dto.invoiceNumber.replace(/[^\w-]+/g, "_");
  return { filename: `${safe}.pdf`, buffer };
}

function buildInvoicePdf(dto: InvoicePublicDto): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => {
      chunks.push(c);
    });
    doc.on("end", () => {
      resolve(Buffer.concat(chunks));
    });
    doc.on("error", reject);

    const margin = 50;
    const pageW = doc.page.width;
    const tableW = pageW - margin * 2;
    let y = margin;

    const dateStr = new Date(dto.issuedAt).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });

    doc.fillColor(PDF_VALUE).font("Helvetica-Bold").fontSize(22);
    doc.text(dto.schoolName, margin, y, { align: "center", width: tableW });
    y = doc.y + 6;
    doc.font("Helvetica").fontSize(10).fillColor("#0f766e");
    doc.text("Tax invoice / Payment receipt", margin, y, {
      align: "center",
      width: tableW,
    });
    y = doc.y + 20;
    doc.fillColor("#000000");

    y = drawMetaTable(doc, margin, y, tableW, dto.invoiceNumber, dateStr);
    y += 14;

    y = drawSectionBar(doc, margin, y, tableW, "Student details");
    const studentRows: { label: string; value: string }[] = [
      { label: "Student name", value: dto.studentName },
    ];
    const courseName = normalizeDisplayValue(dto.studentCourse);
    const className = normalizeDisplayValue(dto.studentClass);
    const sectionName = normalizeDisplayValue(dto.studentSection);
    if (courseName) {
      studentRows.push({ label: "Course", value: courseName });
    } else if (className && sectionName) {
      studentRows.push({
        label: "Class & section",
        value: `${className} · Section ${sectionName}`,
      });
    } else if (className) {
      studentRows.push({ label: "Class", value: className });
    } else if (sectionName) {
      studentRows.push({ label: "Section", value: sectionName });
    }
    if (dto.admissionId) {
      studentRows.push({ label: "Admission ID", value: dto.admissionId });
    }
    if (dto.scholarId) {
      studentRows.push({ label: "Scholar ID", value: dto.scholarId });
    }
    if (dto.parentName) {
      studentRows.push({ label: "Parent / guardian", value: dto.parentName });
    }
    if (dto.parentPhone) {
      studentRows.push({ label: "Phone", value: dto.parentPhone });
    }
    y = drawKeyValueTable(doc, margin, y, tableW, studentRows);
    y += 14;

    y = drawSectionBar(doc, margin, y, tableW, "Payment details");
    const payRows: { label: string; value: string }[] = [
      { label: "Fee / charge", value: dto.feeTitle },
    ];
    if (dto.feeType) {
      payRows.push({ label: "Category", value: dto.feeType });
    }
    if (dto.installmentLabel) {
      payRows.push({ label: "Installment", value: dto.installmentLabel });
    }
    payRows.push({ label: "Payment method", value: dto.paymentMethod });
    if (dto.razorpayPaymentId) {
      payRows.push({
        label: "Transaction reference",
        value: dto.razorpayPaymentId,
      });
    }
    y = drawKeyValueTable(doc, margin, y, tableW, payRows);
    y += 18;

    y = drawTotalBar(
      doc,
      margin,
      y,
      tableW,
      formatMoney(dto.amount, dto.currency),
    );

    doc.fontSize(8).fillColor("#64748b");
    doc.text(
      "This is a computer-generated document and does not require a signature.",
      margin,
      doc.page.height - 72,
      { align: "center", width: tableW },
    );

    doc.end();
  });
}

async function buildInstallmentLabel(
  feeId: string,
  installmentId: string,
): Promise<string | undefined> {
  const inst = await Installment.findOne({
    _id: installmentId,
    feeId,
  }).exec();
  if (!inst) return undefined;
  const list = await Installment.find({ feeId })
    .sort({ dueDate: 1 })
    .select("_id")
    .exec();
  const idx = list.findIndex((x) => x._id.toString() === installmentId);
  const n = idx >= 0 ? idx + 1 : 1;
  const due = inst.dueDate.toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  return `Installment ${n} (due ${due})`;
}

/**
 * Creates an invoice for a successful payment if one does not exist (idempotent).
 * Call only after the payment transaction has committed.
 */
export async function ensureInvoiceForPayment(input: {
  paymentId: string;
  appliedPaise: number;
  creditedRupees: number;
  razorpayPaymentId: string;
}): Promise<void> {
  const { paymentId, appliedPaise, creditedRupees, razorpayPaymentId } = input;

  if (!mongoose.isValidObjectId(paymentId)) {
    return;
  }

  const existing = await Invoice.findOne({ paymentId }).exec();
  if (existing) {
    return;
  }

  const payment = await Payment.findById(paymentId).exec();
  if (!payment || payment.status !== "SUCCESS") {
    logger.warn(SCOPE, "skip invoice: payment missing or not SUCCESS", {
      paymentId,
    });
    return;
  }

  const [tenant, student, fee] = await Promise.all([
    Tenant.findById(payment.tenantId).exec(),
    Student.findOne({
      _id: payment.studentId,
      tenantId: payment.tenantId,
    }).exec(),
    Fee.findOne({ _id: payment.feeId, tenantId: payment.tenantId }).exec(),
  ]);

  if (!student || !fee) {
    logger.error(SCOPE, "invoice: student or fee missing", { paymentId });
    return;
  }

  const schoolName = tenant?.name ?? "School";

  let installmentLabel: string | undefined;
  if (payment.installmentId) {
    installmentLabel = await buildInstallmentLabel(
      fee._id.toString(),
      payment.installmentId,
    );
  }

  const issuedAt = new Date();
  const paymentMethod = "Razorpay (online)";
  const invoiceStudentClass = student.class?.trim() || "N/A";
  const invoiceStudentSection = student.section?.trim() || "N/A";
  let invoiceStudentCourse: string | undefined;
  if (
    tenant?.tenantType === "ACADEMY" &&
    student.courseId &&
    mongoose.isValidObjectId(student.courseId)
  ) {
    const course = await Course.findOne({
      _id: student.courseId,
      tenantId: payment.tenantId,
    })
      .select("name")
      .lean()
      .exec();
    invoiceStudentCourse = normalizeDisplayValue(course?.name);
  }

  const payload = {
    invoiceNumber: generateInvoiceNumber(),
    paymentId,
    tenantId: payment.tenantId,
    studentId: payment.studentId,
    feeId: payment.feeId,
    ...(payment.installmentId ? { installmentId: payment.installmentId } : {}),
    amount: appliedPaise,
    currency: payment.currency,
    paymentMethod,
    razorpayPaymentId: razorpayPaymentId,
    issuedAt,
    schoolName,
    studentName: student.studentName,
    studentClass: invoiceStudentClass,
    studentSection: invoiceStudentSection,
    ...(invoiceStudentCourse ? { studentCourse: invoiceStudentCourse } : {}),
    ...(student.admissionId ? { admissionId: student.admissionId } : {}),
    ...(student.scholarId ? { scholarId: student.scholarId } : {}),
    parentName: student.parentName,
    parentPhone: student.parentPhoneNumber,
    feeTitle: fee.title,
    feeType: fee.feeType,
    ...(installmentLabel ? { installmentLabel } : {}),
  };

  try {
    await Invoice.create(payload);
    logger.info(SCOPE, "invoice created", {
      paymentId,
      invoiceNumber: payload.invoiceNumber,
      creditedRupees,
    });
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      logger.info(SCOPE, "invoice already exists (idempotent)", { paymentId });
      return;
    }
    logger.error(SCOPE, "invoice create failed", {
      paymentId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
