import mongoose, { ClientSession, FilterQuery } from "mongoose";
import { Student } from "../student/student.model";
import type { StudentClass } from "../student/student.model";
import { FeeTemplate, IFeeTemplate } from "../fee-template/fee-template.model";
import { Fee, FeeStatus, FeeType, IFee } from "./fee.model";
import { FeeIdempotency } from "./fee-idempotency.model";
import { hashFeeCreatePayload } from "./fee-idempotency.util";
import type {
  CreateFeeCustomInput,
  CreateFeeFromTemplateInput,
  CreateFeeInput,
  FeeTemplateCreateOverrides,
  FeeTemplateMergedSnapshot,
} from "./fee.types";
import { IInstallment, Installment } from "./installment.model";
import { recordManualPaymentCredit } from "./manual-payment-credit.service";
import { logger } from "../../utils/logger";
import {
  BUSINESS_UTC_OFFSET,
  DAY_MS,
  parseBusinessYmdToDate,
  startOfBusinessDay,
} from "../../config/timezone";

export type { CreateFeeInput } from "./fee.types";

const FEE_IDEMPOTENCY_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export class IdempotencyConflictError extends Error {
  readonly code = "IDEMPOTENCY_CONFLICT" as const;
  constructor() {
    super("Idempotency key was reused with a different request body");
    this.name = "IdempotencyConflictError";
  }
}

function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: number }).code === 11000
  );
}

function startOfTodayIst(): Date {
  return startOfBusinessDay(new Date());
}

function startOfIstDay(date: Date): Date {
  return startOfBusinessDay(date);
}

export interface UpdateFeeInput {
  title?: string;
  description?: string;
  feeType?: FeeType;
  category?: string;
  metadata?: Record<string, unknown>;
  totalAmount?: number;
  /** Only allowed when the fee is not installment-backed (no installments). */
  paidAmount?: number;
  startDate?: Date;
  endDate?: Date;
  tags?: string[];
}

export interface ListFeesParams {
  page: number;
  limit: number;
  studentId?: string;
  status?: FeeStatus;
  feeType?: FeeType;
}

export interface ListOverdueFeesParams {
  page: number;
  limit: number;
  feeType?: FeeType;
  class?: StudentClass;
  /** Academy tenants: filter by student course catalog id. */
  courseId?: string;
  search?: string;
}

/**
 * One overdue row for recovery (GET /fees/overdue).
 * Installment plans: `installmentId` is set. Lump-sum fees: `installmentId` is empty (due = fee `endDate`).
 */
export interface OverdueFeeInstallmentRow {
  studentId: string;
  studentName: string;
  parentPhoneNumber: string;
  feeTitle: string;
  installmentAmount: number;
  paidAmount: number;
  pendingAmount: number;
  dueDate: string;
  daysOverdue: number;
  /** Empty when the overdue line is a non-installment (lump-sum) fee. */
  installmentId: string;
  feeId: string;
}

export interface PaginatedOverdueFees {
  data: OverdueFeeInstallmentRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  summary: {
    totalOverdueAmount: number;
    totalStudents: number;
  };
}

export interface PaginatedFees {
  data: ReturnType<typeof serializeFee>[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AddInstallmentRow {
  amount: number;
  dueDate: Date;
  paidAmount?: number;
  lateFee?: number;
  discount?: number;
  metadata?: Record<string, unknown>;
}

export interface UpdateInstallmentInput {
  amount?: number;
  paidAmount?: number;
  dueDate?: Date;
  lateFee?: number;
  discount?: number;
  metadata?: Record<string, unknown>;
}

export interface CustomAssignmentInstallmentRow {
  amount: number;
  dueDate: Date;
}

function serializeInstallment(doc: IInstallment) {
  const status = deriveInstallmentStatus(
    doc.amount,
    doc.paidAmount,
    doc.dueDate,
  );
  return {
    id: doc._id.toString(),
    feeId: doc.feeId,
    amount: doc.amount,
    paidAmount: doc.paidAmount,
    dueDate: doc.dueDate,
    status,
    lateFee: doc.lateFee,
    lateFeePaid: doc.lateFeePaid ?? 0,
    discount: doc.discount,
    metadata: doc.metadata,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export function serializeFee(doc: IFee) {
  const source =
    doc.source ??
    (doc.templateId != null && String(doc.templateId).trim() !== ""
      ? "TEMPLATE"
      : "CUSTOM");
  return {
    id: doc._id.toString(),
    tenantId: doc.tenantId,
    studentId: doc.studentId,
    source,
    templateId: source === "TEMPLATE" ? doc.templateId : undefined,
    title: doc.title,
    description: doc.description,
    feeType: doc.feeType,
    category: doc.category,
    metadata: doc.metadata,
    totalAmount: doc.totalAmount,
    paidAmount: doc.paidAmount,
    pendingAmount: doc.pendingAmount,
    isInstallment: doc.isInstallment,
    status: doc.status,
    startDate: doc.startDate,
    endDate: doc.endDate,
    tags: doc.tags,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

/** Same rules as GET /fees/:id — status from installment due dates, not stale DB. */
export function deriveFeeStatusFromInstallmentRows(
  fee: IFee,
  insts: IInstallment[],
): FeeStatus {
  if (insts.length === 0) return fee.status;
  const sumPaid = insts.reduce((s, i) => s + i.paidAmount, 0);
  const pendingAmount = clampNonNegative(fee.totalAmount - sumPaid);
  return deriveFeeStatus(fee.totalAmount, sumPaid, pendingAmount, {
    isInstallment: true,
    endDate: fee.endDate,
    installments: insts.map((i) => ({
      dueDate: i.dueDate,
      amount: i.amount,
      paidAmount: i.paidAmount,
    })),
  });
}

function clampNonNegative(n: number): number {
  return n < 0 ? 0 : n;
}

/**
 * Derives installment status from amounts and due date (no payment gateway).
 */
export function deriveInstallmentStatus(
  amount: number,
  paidAmount: number,
  dueDate: Date,
): FeeStatus {
  if (paidAmount >= amount) return "PAID";
  if (paidAmount > 0) {
    const today = startOfTodayIst();
    if (dueDate < today) return "OVERDUE";
    return "PARTIAL";
  }
  const today = startOfTodayIst();
  if (dueDate < today) return "OVERDUE";
  return "PENDING";
}

/**
 * Fee-level status from totals and schedule context.
 */
export function deriveFeeStatus(
  totalAmount: number,
  paidAmount: number,
  pendingAmount: number,
  opts: {
    isInstallment: boolean;
    endDate?: Date | null;
    installments?: { dueDate: Date; amount: number; paidAmount: number }[];
  },
): FeeStatus {
  if (pendingAmount <= 0 || paidAmount >= totalAmount) {
    return "PAID";
  }
  if (paidAmount > 0) {
    return "PARTIAL";
  }

  const today = startOfTodayIst();
  if (opts.isInstallment && opts.installments?.length) {
    const anyOverdue = opts.installments.some(
      (i) => i.dueDate < today && i.paidAmount < i.amount,
    );
    if (anyOverdue) return "OVERDUE";
    return "PENDING";
  }

  if (opts.endDate && opts.endDate < today && pendingAmount > 0) {
    return "OVERDUE";
  }
  return "PENDING";
}

async function assertStudentInTenant(
  tenantId: string,
  studentId: string,
): Promise<void> {
  if (!mongoose.isValidObjectId(studentId)) {
    throw new Error("Invalid student id");
  }
  const exists = await Student.findOne({ _id: studentId, tenantId }).exec();
  if (!exists) {
    throw new Error("Student not found for this tenant");
  }
}

async function loadFeeOrThrow(
  tenantId: string,
  feeId: string,
  session?: ClientSession | null,
): Promise<IFee> {
  if (!mongoose.isValidObjectId(feeId)) {
    throw new Error("Invalid fee id");
  }
  let q = Fee.findOne({ _id: feeId, tenantId });
  if (session) q = q.session(session);
  const fee = await q.exec();
  if (!fee) {
    throw new Error("Fee not found");
  }
  return fee;
}

/**
 * Recomputes fee paid/pending/status from installment rows (no DB read).
 */
export function applyFeeAggregatesFromInstallmentRows(
  fee: IFee,
  insts: Array<{ dueDate: Date; amount: number; paidAmount: number }>,
): void {
  const sumPaid = insts.reduce((s, i) => s + i.paidAmount, 0);
  if (sumPaid > fee.totalAmount) {
    throw new Error("Total paid across installments exceeds fee totalAmount");
  }

  const pendingAmount = clampNonNegative(fee.totalAmount - sumPaid);
  const status = deriveFeeStatus(fee.totalAmount, sumPaid, pendingAmount, {
    isInstallment: true,
    endDate: fee.endDate,
    installments: insts.map((i) => ({
      dueDate: i.dueDate,
      amount: i.amount,
      paidAmount: i.paidAmount,
    })),
  });

  fee.paidAmount = sumPaid;
  fee.pendingAmount = pendingAmount;
  fee.status = status;
  fee.isInstallment = insts.length > 0;
}

/**
 * Recomputes fee paid/pending/status from installments when installments exist.
 */
export async function syncFeeFromInstallments(
  fee: IFee,
  session?: ClientSession | null,
): Promise<IFee> {
  const q = Installment.find({ feeId: fee._id.toString() }).sort({
    dueDate: 1,
  });
  if (session) q.session(session);
  const insts = await q.exec();

  applyFeeAggregatesFromInstallmentRows(
    fee,
    insts.map((i) => ({
      dueDate: i.dueDate,
      amount: i.amount,
      paidAmount: i.paidAmount,
    })),
  );

  await fee.save({ session: session ?? undefined });
  return fee;
}

/**
 * Recomputes non-installment fee from fee.paidAmount and totalAmount.
 */
function applyNonInstallmentAggregates(fee: IFee): void {
  if (fee.paidAmount > fee.totalAmount) {
    throw new Error("paidAmount cannot exceed totalAmount");
  }
  fee.pendingAmount = clampNonNegative(fee.totalAmount - fee.paidAmount);
  fee.status = deriveFeeStatus(
    fee.totalAmount,
    fee.paidAmount,
    fee.pendingAmount,
    {
      isInstallment: false,
      endDate: fee.endDate,
    },
  );
}

/** IST calendar add for template-based installment due dates. */
function addDaysIst(anchor: Date, days: number): Date {
  const d = new Date(anchor.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

/**
 * Installment fees use `anchor + dueInDays` (IST calendar).
 * Prefer an explicit assignment date; otherwise the template's saved earliest due date
 * from the builder; otherwise "now" (legacy templates without anchor).
 */
export function resolveInstallmentAssignmentAnchor(
  explicit: Date | undefined,
  template: IFeeTemplate,
): Date {
  if (explicit) return explicit;
  const s = template.installmentAnchorDate?.trim();
  if (template.isInstallment && s && /^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return parseBusinessYmdToDate(s);
  }
  return new Date();
}

/** Template-stored YYYY-MM-DD → IST midnight Date for fee `endDate` / `startDate` merge. */
export function parseTemplateYmdIst(
  s: string | undefined | null,
): Date | undefined {
  const t = s?.trim();
  if (!t || !/^\d{4}-\d{2}-\d{2}$/.test(t)) return undefined;
  return parseBusinessYmdToDate(t);
}

function mergeFeeTemplateOverrides(
  template: IFeeTemplate,
  overrides?: FeeTemplateCreateOverrides,
): {
  title: string;
  description?: string;
  category?: string;
  metadata?: Record<string, unknown>;
  startDate?: Date;
  endDate?: Date;
  tags?: string[];
} {
  return {
    title: overrides?.title ?? template.title,
    description: overrides?.description ?? template.description,
    category: overrides?.category ?? template.category,
    metadata: overrides?.metadata ?? template.metadata,
    startDate: overrides?.startDate,
    endDate: overrides?.endDate ?? parseTemplateYmdIst(template.defaultEndDate),
    tags: overrides?.tags ?? template.tags,
  };
}

function validateTemplateForFeeCreation(template: IFeeTemplate): void {
  if (template.isInstallment) {
    if (!template.defaultInstallments?.length) {
      throw new Error(
        "isInstallment templates require at least one default installment",
      );
    }
    const sum = template.defaultInstallments.reduce((s, r) => s + r.amount, 0);
    if (Math.abs(sum - template.totalAmount) > 1e-9) {
      throw new Error(
        `Sum of default installment amounts (${sum}) must equal totalAmount (${template.totalAmount})`,
      );
    }
    for (const r of template.defaultInstallments) {
      if (r.amount <= 0) {
        throw new Error("Each default installment amount must be positive");
      }
    }
  } else if (template.defaultInstallments?.length) {
    throw new Error(
      "Non-installment templates must not include defaultInstallments",
    );
  }
}

function validateCustomAssignmentInstallments(
  rows: CustomAssignmentInstallmentRow[],
  totalAmount: number,
): void {
  if (rows.length === 0) {
    throw new Error("At least one custom installment is required");
  }

  const sum = rows.reduce((acc, row) => acc + row.amount, 0);
  if (Math.abs(sum - totalAmount) > 1e-9) {
    throw new Error(
      `Sum of custom installment amounts (${sum}) must equal totalAmount (${totalAmount})`,
    );
  }

  for (const row of rows) {
    if (row.amount <= 0) {
      throw new Error("Each custom installment amount must be positive");
    }
    if (Number.isNaN(row.dueDate.getTime())) {
      throw new Error("Each custom installment dueDate must be valid");
    }
  }
}

type TemplateAssignmentInstallmentSnapshotRow = {
  amount: number;
  dueDate: Date;
  lateFee: number;
  discount: number;
  metadata?: Record<string, unknown>;
};

function toPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

function fromPaise(paise: number): number {
  return paise / 100;
}

/**
 * Keeps due dates/metadata unchanged and apportions principal by weight so rows sum exactly.
 */
function scaleInstallmentRowsForTargetTotal(
  baseRows: TemplateAssignmentInstallmentSnapshotRow[],
  baseTotalAmount: number,
  targetTotalAmount: number,
): TemplateAssignmentInstallmentSnapshotRow[] {
  if (baseRows.length === 0) {
    return [];
  }
  if (Math.abs(targetTotalAmount - baseTotalAmount) <= 1e-9) {
    return baseRows;
  }

  const targetTotalPaise = toPaise(targetTotalAmount);
  const baseTotalPaise = toPaise(baseTotalAmount);
  if (baseTotalPaise <= 0) {
    throw new Error("Installment base totalAmount must be positive");
  }

  const basePaiseRows = baseRows.map((row) => ({
    ...row,
    amountPaise: toPaise(row.amount),
  }));

  const alloc = basePaiseRows.map((row, idx) => {
    const raw = (row.amountPaise * targetTotalPaise) / baseTotalPaise;
    const floor = Math.floor(raw);
    return { idx, floor, frac: raw - floor };
  });

  let assigned = alloc.reduce((s, a) => s + a.floor, 0);
  let remaining = targetTotalPaise - assigned;
  alloc.sort((a, b) => b.frac - a.frac);
  for (let i = 0; i < alloc.length && remaining > 0; i++) {
    alloc[i]!.floor += 1;
    remaining -= 1;
    assigned += 1;
  }
  if (remaining !== 0 || assigned !== targetTotalPaise) {
    throw new Error("Failed to apportion discounted installment amounts");
  }

  alloc.sort((a, b) => a.idx - b.idx);
  return alloc.map((a) => {
    const row = baseRows[a.idx]!;
    return {
      ...row,
      amount: fromPaise(a.floor),
    };
  });
}

/**
 * Persists a fee (+ installments when applicable) from a template snapshot.
 * No runtime dependency on the template after this returns; fee is a full copy.
 */
export async function createFeeFromTemplateSnapshot(
  tenantId: string,
  template: IFeeTemplate,
  studentId: string,
  anchor: Date,
  merged: ReturnType<typeof mergeFeeTemplateOverrides>,
  session: ClientSession | null,
  customInstallments?: CustomAssignmentInstallmentRow[],
  principalDiscountPercent?: number,
): Promise<ReturnType<typeof serializeFee>> {
  const opts = session ? { session } : {};
  const discountPercent = principalDiscountPercent ?? 0;
  if (!Number.isFinite(discountPercent)) {
    throw new Error("principalDiscountPercent must be a finite number");
  }
  if (discountPercent < 0) {
    throw new Error("principalDiscountPercent cannot be negative");
  }
  if (discountPercent > 100) {
    throw new Error("principalDiscountPercent cannot exceed 100");
  }

  const templateTotalPaise = toPaise(template.totalAmount);
  const discountPaise = Math.round((templateTotalPaise * discountPercent) / 100);
  const discountedTotal = fromPaise(
    clampNonNegative(templateTotalPaise - discountPaise),
  );

  const [fee] = (await Fee.create(
    [
      {
        tenantId,
        studentId,
        source: "TEMPLATE",
        templateId: template._id.toString(),
        title: merged.title,
        description: merged.description,
        feeType: template.feeType,
        category: merged.category,
        metadata: merged.metadata,
        totalAmount: discountedTotal,
        paidAmount: 0,
        pendingAmount: discountedTotal,
        isInstallment: false,
        status: deriveFeeStatus(discountedTotal, 0, discountedTotal, {
          isInstallment: false,
          endDate: merged.endDate,
        }),
        startDate: merged.startDate,
        endDate: merged.endDate,
        tags: merged.tags,
      },
    ],
    opts,
  )) as IFee[];

  if (!template.isInstallment) {
    if (customInstallments?.length) {
      throw new Error(
        "customInstallments can only be used with installment templates",
      );
    }
    return serializeFee(fee);
  }

  if (customInstallments?.length) {
    validateCustomAssignmentInstallments(customInstallments, template.totalAmount);
  }

  const baseInstallmentRows: TemplateAssignmentInstallmentSnapshotRow[] =
    customInstallments?.length
    ? customInstallments.map((row) => ({
        amount: row.amount,
        dueDate: row.dueDate,
        lateFee: 0,
        discount: 0,
        metadata: undefined as Record<string, unknown> | undefined,
      }))
    : template.defaultInstallments.map((row) => ({
        amount: row.amount,
        dueDate: addDaysIst(anchor, row.dueInDays),
        lateFee: row.lateFee ?? 0,
        discount: row.discount ?? 0,
        metadata: row.metadata,
      }));
  const installmentRows = scaleInstallmentRowsForTargetTotal(
    baseInstallmentRows,
    template.totalAmount,
    discountedTotal,
  );

  for (const row of installmentRows) {
    const paid = 0;
    const st = deriveInstallmentStatus(row.amount, paid, row.dueDate);
    await Installment.create(
      [
        {
          feeId: fee._id.toString(),
          amount: row.amount,
          paidAmount: paid,
          dueDate: row.dueDate,
          status: st,
          lateFee: row.lateFee,
          discount: row.discount,
          metadata: row.metadata,
        },
      ],
      opts,
    );
  }

  fee.isInstallment = true;
  await fee.save(opts);
  await syncFeeFromInstallments(fee, session);

  const refreshed = session
    ? await Fee.findById(fee._id).session(session).exec()
    : await Fee.findById(fee._id).exec();
  if (!refreshed) {
    throw new Error("Fee not found after assignment");
  }
  return serializeFee(refreshed);
}

/**
 * Bulk snapshot from template: insertMany fees + installments, then sync fee aggregates.
 * Call inside a transaction session.
 */
export async function bulkCreateFeesFromTemplateSnapshot(
  tenantId: string,
  template: IFeeTemplate,
  rows: Array<{
    studentId: string;
    merged: FeeTemplateMergedSnapshot;
    principalDiscountPercent?: number;
  }>,
  anchor: Date,
  session: ClientSession,
  customInstallments?: CustomAssignmentInstallmentRow[],
): Promise<IFee[]> {
  if (rows.length === 0) {
    return [];
  }
  validateTemplateForFeeCreation(template);

  const templateIdStr = template._id.toString();

  const feePayloads = rows.map(
    ({ studentId, merged, principalDiscountPercent }) => {
      const discountPercent = principalDiscountPercent ?? 0;
      if (!Number.isFinite(discountPercent)) {
        throw new Error("principalDiscountPercent must be a finite number");
      }
      if (discountPercent < 0) {
        throw new Error("principalDiscountPercent cannot be negative");
      }
      if (discountPercent > 100) {
        throw new Error("principalDiscountPercent cannot exceed 100");
      }

      const templateTotalPaise = toPaise(template.totalAmount);
      const discountPaise = Math.round(
        (templateTotalPaise * discountPercent) / 100,
      );
      const discountedTotal = fromPaise(
        clampNonNegative(templateTotalPaise - discountPaise),
      );

      return {
        tenantId,
        studentId,
        source: "TEMPLATE" as const,
        templateId: templateIdStr,
        title: merged.title,
        description: merged.description,
        feeType: template.feeType,
        category: merged.category,
        metadata: merged.metadata,
        totalAmount: discountedTotal,
        paidAmount: 0,
        pendingAmount: discountedTotal,
        isInstallment: false,
        status: deriveFeeStatus(discountedTotal, 0, discountedTotal, {
          isInstallment: false,
          endDate: merged.endDate,
        }),
        startDate: merged.startDate,
        endDate: merged.endDate,
        tags: merged.tags,
      };
    },
  );

  const inserted = (await Fee.insertMany(feePayloads, { session })) as IFee[];

  if (!template.isInstallment) {
    if (customInstallments?.length) {
      throw new Error(
        "customInstallments can only be used with installment templates",
      );
    }
    return inserted;
  }

  if (customInstallments?.length) {
    validateCustomAssignmentInstallments(customInstallments, template.totalAmount);
  }

  const baseInstallmentRows: TemplateAssignmentInstallmentSnapshotRow[] =
    customInstallments?.length
    ? customInstallments.map((row) => ({
        amount: row.amount,
        dueDate: row.dueDate,
        lateFee: 0,
        discount: 0,
        metadata: undefined as Record<string, unknown> | undefined,
      }))
    : template.defaultInstallments.map((row) => ({
        amount: row.amount,
        dueDate: addDaysIst(anchor, row.dueInDays),
        lateFee: row.lateFee ?? 0,
        discount: row.discount ?? 0,
        metadata: row.metadata,
      }));

  const instRows: Array<{
    feeId: string;
    amount: number;
    paidAmount: number;
    dueDate: Date;
    status: FeeStatus;
    lateFee: number;
    discount: number;
    metadata?: Record<string, unknown>;
  }> = [];

  for (let i = 0; i < inserted.length; i++) {
    const fee = inserted[i]!;
    const fid = fee._id.toString();
    const perFeeRows = scaleInstallmentRowsForTargetTotal(
      baseInstallmentRows,
      template.totalAmount,
      fee.totalAmount,
    );
    for (const row of perFeeRows) {
      const paid = 0;
      const st = deriveInstallmentStatus(row.amount, paid, row.dueDate);
      instRows.push({
        feeId: fid,
        amount: row.amount,
        paidAmount: paid,
        dueDate: row.dueDate,
        status: st,
        lateFee: row.lateFee,
        discount: row.discount,
        metadata: row.metadata,
      });
    }
  }

  await Installment.insertMany(instRows, { session });

  const nPerFee = baseInstallmentRows.length;
  const bulkOps: Parameters<typeof Fee.bulkWrite>[0] = [];
  for (let i = 0; i < inserted.length; i++) {
    const fee = inserted[i];
    const slice = instRows.slice(i * nPerFee, (i + 1) * nPerFee);
    applyFeeAggregatesFromInstallmentRows(fee, slice);
    bulkOps.push({
      updateOne: {
        filter: { _id: fee._id, tenantId },
        update: {
          $set: {
            paidAmount: fee.paidAmount,
            pendingAmount: fee.pendingAmount,
            status: fee.status,
            isInstallment: fee.isInstallment,
          },
        },
      },
    });
  }

  if (bulkOps.length > 0) {
    await Fee.bulkWrite(bulkOps, { session });
  }

  return inserted;
}

async function loadFeeTemplateOrThrow(
  tenantId: string,
  templateId: string,
): Promise<IFeeTemplate> {
  if (!mongoose.isValidObjectId(templateId)) {
    throw new Error("Invalid template id");
  }
  const t = await FeeTemplate.findOne({ _id: templateId, tenantId }).exec();
  if (!t) {
    throw new Error("Fee template not found");
  }
  return t;
}

async function createFeeCustomRequest(
  tenantId: string,
  input: CreateFeeCustomInput,
  options?: { idempotencyKey?: string },
): Promise<{
  fee: ReturnType<typeof serializeFee>;
  replay: boolean;
}> {
  await assertStudentInTenant(tenantId, input.studentId);

  const paidAmount = input.paidAmount ?? 0;
  if (paidAmount < 0) throw new Error("paidAmount cannot be negative");
  if (paidAmount > input.totalAmount) {
    throw new Error("paidAmount cannot exceed totalAmount");
  }
  const pendingAmount = clampNonNegative(input.totalAmount - paidAmount);
  const status = deriveFeeStatus(input.totalAmount, paidAmount, pendingAmount, {
    isInstallment: false,
    endDate: input.endDate,
  });

  const requestHash = hashFeeCreatePayload(input);

  const feePayload = {
    tenantId,
    studentId: input.studentId,
    source: "CUSTOM" as const,
    title: input.title,
    description: input.description,
    feeType: input.feeType,
    category: input.category,
    metadata: input.metadata,
    totalAmount: input.totalAmount,
    paidAmount,
    pendingAmount,
    isInstallment: false,
    status,
    startDate: input.startDate,
    endDate: input.endDate,
    tags: input.tags,
  };

  if (!options?.idempotencyKey) {
    const created = await Fee.create(feePayload);
    if (paidAmount > 0) {
      await recordManualPaymentCredit({
        tenantId,
        feeId: created._id.toString(),
        studentId: input.studentId,
        amount: paidAmount,
        recordedAt: created.createdAt,
      });
    }
    return { fee: serializeFee(created), replay: false };
  }

  const key = options.idempotencyKey;

  const existing = await FeeIdempotency.findOne({ tenantId, key }).exec();
  if (existing) {
    if (existing.requestHash !== requestHash) {
      throw new IdempotencyConflictError();
    }
    const feeDoc = await Fee.findOne({
      _id: existing.feeId,
      tenantId,
    }).exec();
    if (!feeDoc) {
      throw new Error("Idempotency record refers to missing fee");
    }
    return { fee: serializeFee(feeDoc), replay: true };
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const createdArr = await Fee.create([feePayload], { session });
    const created = createdArr[0] as IFee;

    await FeeIdempotency.create(
      [
        {
          tenantId,
          key,
          requestHash,
          feeId: created._id.toString(),
          expiresAt: new Date(Date.now() + FEE_IDEMPOTENCY_TTL_MS),
        },
      ],
      { session },
    );

    await session.commitTransaction();
    if (paidAmount > 0) {
      await recordManualPaymentCredit({
        tenantId,
        feeId: created._id.toString(),
        studentId: input.studentId,
        amount: paidAmount,
        recordedAt: created.createdAt,
      });
    }
    return { fee: serializeFee(created), replay: false };
  } catch (err) {
    await session.abortTransaction();
    if (isDuplicateKeyError(err)) {
      const row = await FeeIdempotency.findOne({ tenantId, key }).exec();
      if (row) {
        if (row.requestHash !== requestHash) {
          throw new IdempotencyConflictError();
        }
        const feeDoc = await Fee.findOne({
          _id: row.feeId,
          tenantId,
        }).exec();
        if (feeDoc) {
          return { fee: serializeFee(feeDoc), replay: true };
        }
      }
    }
    throw err;
  } finally {
    session.endSession();
  }
}

async function createFeeFromTemplateRequest(
  tenantId: string,
  input: CreateFeeFromTemplateInput,
  options?: { idempotencyKey?: string },
): Promise<{
  fee: ReturnType<typeof serializeFee>;
  replay: boolean;
}> {
  await assertStudentInTenant(tenantId, input.studentId);

  const template = await loadFeeTemplateOrThrow(tenantId, input.templateId);
  validateTemplateForFeeCreation(template);

  const merged = mergeFeeTemplateOverrides(template, input.feeOverrides);
  const anchor = resolveInstallmentAssignmentAnchor(
    input.assignmentAnchorDate,
    template,
  );
  const requestHash = hashFeeCreatePayload(input);

  if (!options?.idempotencyKey) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const fee = await createFeeFromTemplateSnapshot(
        tenantId,
        template,
        input.studentId,
        anchor,
        merged,
        session,
      );
      await session.commitTransaction();
      return { fee, replay: false };
    } catch (e) {
      await session.abortTransaction();
      throw e;
    } finally {
      session.endSession();
    }
  }

  const key = options.idempotencyKey;

  const existing = await FeeIdempotency.findOne({ tenantId, key }).exec();
  if (existing) {
    if (existing.requestHash !== requestHash) {
      throw new IdempotencyConflictError();
    }
    const feeDoc = await Fee.findOne({
      _id: existing.feeId,
      tenantId,
    }).exec();
    if (!feeDoc) {
      throw new Error("Idempotency record refers to missing fee");
    }
    return { fee: serializeFee(feeDoc), replay: true };
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const createdSerialized = await createFeeFromTemplateSnapshot(
      tenantId,
      template,
      input.studentId,
      anchor,
      merged,
      session,
    );

    await FeeIdempotency.create(
      [
        {
          tenantId,
          key,
          requestHash,
          feeId: createdSerialized.id,
          expiresAt: new Date(Date.now() + FEE_IDEMPOTENCY_TTL_MS),
        },
      ],
      { session },
    );

    await session.commitTransaction();
    return { fee: createdSerialized, replay: false };
  } catch (err) {
    await session.abortTransaction();
    if (isDuplicateKeyError(err)) {
      const row = await FeeIdempotency.findOne({ tenantId, key }).exec();
      if (row) {
        if (row.requestHash !== requestHash) {
          throw new IdempotencyConflictError();
        }
        const feeDoc = await Fee.findOne({
          _id: row.feeId,
          tenantId,
        }).exec();
        if (feeDoc) {
          return { fee: serializeFee(feeDoc), replay: true };
        }
      }
    }
    throw err;
  } finally {
    session.endSession();
  }
}

export async function createFee(
  tenantId: string,
  input: CreateFeeInput,
  options?: { idempotencyKey?: string },
): Promise<{
  fee: ReturnType<typeof serializeFee>;
  replay: boolean;
}> {
  if (input.source === "TEMPLATE") {
    return createFeeFromTemplateRequest(tenantId, input, options);
  }
  return createFeeCustomRequest(tenantId, input, options);
}

export async function listFees(
  tenantId: string,
  params: ListFeesParams,
): Promise<PaginatedFees> {
  const filter: FilterQuery<IFee> = { tenantId };

  if (params.studentId !== undefined && params.studentId !== "") {
    if (!mongoose.isValidObjectId(params.studentId)) {
      return {
        data: [],
        total: 0,
        page: params.page,
        limit: params.limit,
        totalPages: 0,
      };
    }
    filter.studentId = params.studentId;
  }
  if (params.status !== undefined) {
    filter.status = params.status;
  }
  if (params.feeType !== undefined) {
    filter.feeType = params.feeType;
  }

  const skip = (params.page - 1) * params.limit;

  const [docs, total] = await Promise.all([
    Fee.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(params.limit)
      .exec(),
    Fee.countDocuments(filter).exec(),
  ]);

  const totalPages = total === 0 ? 0 : Math.ceil(total / params.limit);

  const installmentFeeIds = docs
    .filter((d) => d.isInstallment)
    .map((d) => d._id.toString());

  const instByFeeId = new Map<string, IInstallment[]>();
  if (installmentFeeIds.length > 0) {
    const allInsts = await Installment.find({
      feeId: { $in: installmentFeeIds },
    })
      .sort({ dueDate: 1 })
      .exec();
    for (const inst of allInsts) {
      const fid = inst.feeId;
      const arr = instByFeeId.get(fid) ?? [];
      arr.push(inst);
      instByFeeId.set(fid, arr);
    }
  }

  const data = docs.map((doc) => {
    const base = serializeFee(doc);
    if (!doc.isInstallment) return base;
    const insts = instByFeeId.get(doc._id.toString()) ?? [];
    if (insts.length === 0) return base;
    return {
      ...base,
      status: deriveFeeStatusFromInstallmentRows(doc, insts),
    };
  });

  return {
    data,
    total,
    page: params.page,
    limit: params.limit,
    totalPages,
  };
}

function daysOverdueBetween(dueDate: Date, todayStart: Date): number {
  const dueStart = startOfIstDay(dueDate);
  const ms = todayStart.getTime() - dueStart.getTime();
  return Math.max(0, Math.floor(ms / DAY_MS));
}

/**
 * Overdue list: (1) installment lines past due IST calendar day with balance;
 * (2) lump-sum fees with `endDate` before today IST, fully unpaid (`paidAmount === 0`), `pendingAmount > 0`
 * (same rule as `deriveFeeStatus` for non-installment OVERDUE).
 */
export async function listOverdueFees(
  tenantId: string,
  params: ListOverdueFeesParams,
): Promise<PaginatedOverdueFees> {
  const todayStart = startOfTodayIst();
  logger.info("fee.listOverdueFees", "todayStartIst", { todayStart });

  const tenantFees = await Fee.find({ tenantId }).select("_id").lean().exec();
  const tenantFeeIds = tenantFees.map((f) => String(f._id));
  if (tenantFeeIds.length === 0) {
    return {
      data: [],
      total: 0,
      page: params.page,
      limit: params.limit,
      totalPages: 0,
      summary: { totalOverdueAmount: 0, totalStudents: 0 },
    };
  }

  const [installments, lumpFees] = await Promise.all([
    tenantFeeIds.length > 0
      ? Installment.find({
          feeId: { $in: tenantFeeIds },
          dueDate: { $lt: todayStart },
          status: { $ne: "PAID" },
          $expr: { $lt: ["$paidAmount", "$amount"] },
        })
          .sort({ dueDate: 1 })
          .lean()
          .exec()
      : Promise.resolve([]),
    Fee.find({
      tenantId,
      isInstallment: false,
      pendingAmount: { $gt: 0 },
      paidAmount: 0,
      endDate: { $exists: true, $ne: null, $lt: todayStart },
    })
      .sort({ endDate: 1 })
      .lean()
      .exec(),
  ]);

  const feeIdSet = new Set(installments.map((i) => String(i.feeId)));
  const fees = await Fee.find({
    _id: { $in: [...feeIdSet] },
    tenantId,
  })
    .lean()
    .exec();
  const feeById = new Map(fees.map((f) => [String(f._id), f]));

  const studentIdSet = new Set<string>();
  for (const f of fees) studentIdSet.add(String(f.studentId));
  for (const f of lumpFees) studentIdSet.add(String(f.studentId));

  const students = await Student.find({
    _id: { $in: [...studentIdSet] },
    tenantId,
  })
    .lean()
    .exec();
  const studentById = new Map(students.map((s) => [String(s._id), s]));

  const rows: OverdueFeeInstallmentRow[] = [];

  for (const inst of installments) {
    const fee = feeById.get(String(inst.feeId));
    if (!fee || !fee.isInstallment) continue;

    const student = studentById.get(String(fee.studentId));
    if (!student) continue;

    if (params.feeType !== undefined && params.feeType !== fee.feeType) {
      continue;
    }
    if (params.class !== undefined) {
      if (student.class !== params.class) continue;
    }
    if (params.courseId !== undefined) {
      if (String(student.courseId ?? "") !== params.courseId) continue;
    }
    if (params.search !== undefined && params.search.trim() !== "") {
      const q = params.search.trim().toLowerCase();
      if (!student.studentName.toLowerCase().includes(q)) continue;
    }

    const pendingAmount = clampNonNegative(inst.amount - inst.paidAmount);
    if (pendingAmount <= 0) continue;

    rows.push({
      studentId: String(student._id),
      studentName: student.studentName,
      parentPhoneNumber: student.parentPhoneNumber,
      feeTitle: fee.title,
      installmentAmount: inst.amount,
      paidAmount: inst.paidAmount,
      pendingAmount,
      dueDate: new Date(inst.dueDate).toISOString(),
      daysOverdue: daysOverdueBetween(inst.dueDate, todayStart),
      installmentId: String(inst._id),
      feeId: String(fee._id),
    });
  }

  for (const fee of lumpFees) {
    const student = studentById.get(String(fee.studentId));
    if (!student) continue;

    if (params.feeType !== undefined && params.feeType !== fee.feeType) {
      continue;
    }
    if (params.class !== undefined) {
      if (student.class !== params.class) continue;
    }
    if (params.courseId !== undefined) {
      if (String(student.courseId ?? "") !== params.courseId) continue;
    }
    if (params.search !== undefined && params.search.trim() !== "") {
      const q = params.search.trim().toLowerCase();
      if (!student.studentName.toLowerCase().includes(q)) continue;
    }

    const end = fee.endDate;
    if (!end) continue;

    rows.push({
      studentId: String(student._id),
      studentName: student.studentName,
      parentPhoneNumber: student.parentPhoneNumber,
      feeTitle: fee.title,
      installmentAmount: fee.totalAmount,
      paidAmount: fee.paidAmount,
      pendingAmount: clampNonNegative(fee.pendingAmount),
      dueDate: new Date(end).toISOString(),
      daysOverdue: daysOverdueBetween(end, todayStart),
      installmentId: "",
      feeId: String(fee._id),
    });
  }

  rows.sort(
    (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
  );

  const totalOverdueAmount = rows.reduce((s, r) => s + r.pendingAmount, 0);
  const summary = {
    totalOverdueAmount,
    totalStudents: new Set(rows.map((r) => r.studentId)).size,
  };

  const total = rows.length;
  const totalPages = total === 0 ? 0 : Math.ceil(total / params.limit);
  const skip = (params.page - 1) * params.limit;
  const pageRows = rows.slice(skip, skip + params.limit);

  return {
    data: pageRows,
    total,
    page: params.page,
    limit: params.limit,
    totalPages,
    summary,
  };
}

export async function getFeeById(
  tenantId: string,
  feeId: string,
): Promise<{
  fee: ReturnType<typeof serializeFee>;
  installments: ReturnType<typeof serializeInstallment>[];
} | null> {
  if (!mongoose.isValidObjectId(feeId)) {
    return null;
  }
  const fee = await Fee.findOne({ _id: feeId, tenantId }).exec();
  if (!fee) return null;

  const insts = await Installment.find({ feeId: fee._id.toString() })
    .sort({ dueDate: 1 })
    .exec();

  const baseFee = serializeFee(fee);
  if (insts.length > 0) {
    const status = deriveFeeStatusFromInstallmentRows(fee, insts);
    return {
      fee: { ...baseFee, status },
      installments: insts.map(serializeInstallment),
    };
  }

  return {
    fee: baseFee,
    installments: insts.map(serializeInstallment),
  };
}

/**
 * Adds installments; sets isInstallment true. Sum of installment amounts must equal fee.totalAmount.
 */
export async function addInstallmentsToFee(
  tenantId: string,
  feeId: string,
  rows: AddInstallmentRow[],
): Promise<{
  fee: ReturnType<typeof serializeFee>;
  installments: ReturnType<typeof serializeInstallment>[];
}> {
  if (!rows.length) {
    throw new Error("At least one installment is required");
  }

  const fee = await loadFeeOrThrow(tenantId, feeId);

  const existing = await Installment.countDocuments({
    feeId: fee._id.toString(),
  }).exec();
  if (existing > 0) {
    throw new Error(
      "Installments already exist for this fee; use update installment instead",
    );
  }

  const sumAmount = rows.reduce((s, r) => s + r.amount, 0);
  if (Math.abs(sumAmount - fee.totalAmount) > 1e-9) {
    throw new Error(
      `Sum of installment amounts (${sumAmount}) must equal fee totalAmount (${fee.totalAmount})`,
    );
  }

  for (const r of rows) {
    if (r.amount <= 0)
      throw new Error("Each installment amount must be positive");
    const paid = r.paidAmount ?? 0;
    if (paid < 0) throw new Error("Installment paidAmount cannot be negative");
    if (paid > r.amount) {
      throw new Error(
        "Installment paidAmount cannot exceed installment amount",
      );
    }
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const createdDocs: IInstallment[] = [];
    for (const r of rows) {
      const paid = r.paidAmount ?? 0;
      const st = deriveInstallmentStatus(r.amount, paid, r.dueDate);
      const doc = await Installment.create(
        [
          {
            feeId: fee._id.toString(),
            amount: r.amount,
            paidAmount: paid,
            dueDate: r.dueDate,
            status: st,
            lateFee: r.lateFee ?? 0,
            discount: r.discount ?? 0,
            metadata: r.metadata,
          },
        ],
        { session },
      );
      createdDocs.push(doc[0] as IInstallment);
    }

    fee.isInstallment = true;
    await fee.save({ session });

    await syncFeeFromInstallments(fee, session);

    await session.commitTransaction();

    const refreshed = await Fee.findById(fee._id).exec();
    if (!refreshed) throw new Error("Fee not found after commit");

    const insts = await Installment.find({ feeId: fee._id.toString() })
      .sort({ dueDate: 1 })
      .exec();

    for (const doc of createdDocs) {
      if (doc.paidAmount > 0) {
        await recordManualPaymentCredit({
          tenantId,
          feeId: fee._id.toString(),
          studentId: fee.studentId,
          installmentId: doc._id.toString(),
          amount: doc.paidAmount,
          recordedAt: doc.createdAt,
        });
      }
    }

    return {
      fee: serializeFee(refreshed),
      installments: insts.map(serializeInstallment),
    };
  } catch (e) {
    await session.abortTransaction();
    throw e;
  } finally {
    session.endSession();
  }
}

/**
 * Recalculates fee aggregates from installments (or non-installment paidAmount) and persists.
 */
export async function recalculateFeeStatus(
  tenantId: string,
  feeId: string,
): Promise<ReturnType<typeof serializeFee>> {
  const fee = await loadFeeOrThrow(tenantId, feeId);

  const count = await Installment.countDocuments({
    feeId: fee._id.toString(),
  }).exec();

  if (count > 0) {
    await syncFeeFromInstallments(fee, null);
  } else {
    applyNonInstallmentAggregates(fee);
    await fee.save();
  }

  const refreshed = await Fee.findById(fee._id).exec();
  if (!refreshed) throw new Error("Fee not found");
  return serializeFee(refreshed);
}

export async function updateFee(
  tenantId: string,
  feeId: string,
  input: UpdateFeeInput,
): Promise<ReturnType<typeof serializeFee>> {
  const fee = await loadFeeOrThrow(tenantId, feeId);
  const previousPaid = fee.paidAmount;

  const instCount = await Installment.countDocuments({
    feeId: fee._id.toString(),
  }).exec();

  if (input.totalAmount !== undefined && instCount > 0) {
    throw new Error("Cannot change totalAmount when installments exist");
  }

  if (input.paidAmount !== undefined) {
    if (instCount > 0) {
      throw new Error(
        "Cannot set paidAmount directly when installment plan exists; update installments instead",
      );
    }
    if (input.paidAmount < 0) throw new Error("paidAmount cannot be negative");
    fee.paidAmount = input.paidAmount;
  }

  if (input.title !== undefined) fee.title = input.title;
  if (input.description !== undefined) fee.description = input.description;
  if (input.feeType !== undefined) fee.feeType = input.feeType;
  if (input.category !== undefined) fee.category = input.category;
  if (input.metadata !== undefined) fee.metadata = input.metadata;
  if (input.totalAmount !== undefined) fee.totalAmount = input.totalAmount;
  if (input.startDate !== undefined) fee.startDate = input.startDate;
  if (input.endDate !== undefined) fee.endDate = input.endDate;
  if (input.tags !== undefined) fee.tags = input.tags;

  if (instCount === 0) {
    applyNonInstallmentAggregates(fee);
    await fee.save();
    if (input.paidAmount !== undefined) {
      const delta = fee.paidAmount - previousPaid;
      if (delta > 0) {
        await recordManualPaymentCredit({
          tenantId,
          feeId: fee._id.toString(),
          studentId: fee.studentId,
          amount: delta,
        });
      }
    }
  } else {
    await syncFeeFromInstallments(fee, null);
  }

  const refreshed = await Fee.findById(fee._id).exec();
  if (!refreshed) throw new Error("Fee not found");
  return serializeFee(refreshed);
}

/**
 * Updates a single installment; syncs fee aggregates and installment status.
 */
export async function updateInstallment(
  tenantId: string,
  feeId: string,
  installmentId: string,
  input: UpdateInstallmentInput,
): Promise<{
  fee: ReturnType<typeof serializeFee>;
  installment: ReturnType<typeof serializeInstallment>;
}> {
  if (!mongoose.isValidObjectId(installmentId)) {
    throw new Error("Invalid installment id");
  }

  const fee = await loadFeeOrThrow(tenantId, feeId);

  const inst = await Installment.findOne({
    _id: installmentId,
    feeId: fee._id.toString(),
  }).exec();
  if (!inst) {
    throw new Error("Installment not found");
  }

  const previousPaid = inst.paidAmount;

  if (input.amount !== undefined) {
    if (input.amount <= 0) throw new Error("amount must be positive");
    inst.amount = input.amount;
  }
  if (input.paidAmount !== undefined) {
    if (input.paidAmount < 0) throw new Error("paidAmount cannot be negative");
    inst.paidAmount = input.paidAmount;
  }
  if (input.dueDate !== undefined) inst.dueDate = input.dueDate;
  if (input.lateFee !== undefined) inst.lateFee = input.lateFee;
  if (input.discount !== undefined) inst.discount = input.discount;
  if (input.metadata !== undefined) inst.metadata = input.metadata;

  if (inst.paidAmount > inst.amount) {
    throw new Error("Installment paidAmount cannot exceed installment amount");
  }

  const allForSum = await Installment.find({
    feeId: fee._id.toString(),
  }).exec();
  const sumAmt = allForSum.reduce((s, d) => {
    if (d._id.equals(inst._id)) return s + inst.amount;
    return s + d.amount;
  }, 0);
  if (Math.abs(sumAmt - fee.totalAmount) > 1e-9) {
    throw new Error(
      `Sum of installment amounts (${sumAmt}) must equal fee totalAmount (${fee.totalAmount})`,
    );
  }

  inst.status = deriveInstallmentStatus(
    inst.amount,
    inst.paidAmount,
    inst.dueDate,
  );
  await inst.save();

  await syncFeeFromInstallments(fee, null);
  const refreshedFee = await Fee.findById(fee._id).exec();
  if (!refreshedFee) throw new Error("Fee not found");

  const refreshedInst = await Installment.findById(inst._id).exec();
  if (!refreshedInst) throw new Error("Installment not found");

  const deltaPaid = refreshedInst.paidAmount - previousPaid;
  if (deltaPaid > 0) {
    await recordManualPaymentCredit({
      tenantId,
      feeId: fee._id.toString(),
      studentId: fee.studentId,
      installmentId: refreshedInst._id.toString(),
      amount: deltaPaid,
    });
  }

  return {
    fee: serializeFee(refreshedFee),
    installment: serializeInstallment(refreshedInst),
  };
}

/**
 * Applies a successful gateway credit in main currency units (same as Fee.totalAmount / installment.amount).
 * Caps to remaining balances; syncs installment row + fee aggregates. Use inside a transaction when needed.
 */
export async function applyPaymentCredit(
  tenantId: string,
  feeId: string,
  installmentId: string | undefined,
  creditMainCurrency: number,
  session?: ClientSession | null,
): Promise<{ credited: number; fee: IFee }> {
  if (creditMainCurrency <= 0) {
    throw new Error("Credit amount must be positive");
  }

  const fee = await loadFeeOrThrow(tenantId, feeId, session);
  const instCount = await Installment.countDocuments({
    feeId: fee._id.toString(),
  })
    .session(session ?? null)
    .exec();

  if (instCount > 0) {
    if (!installmentId || !mongoose.isValidObjectId(installmentId)) {
      throw new Error("installmentId is required when fee has installments");
    }
    let q = Installment.findOne({
      _id: installmentId,
      feeId: fee._id.toString(),
    });
    if (session) q = q.session(session);
    const inst = await q.exec();
    if (!inst) {
      throw new Error("Installment not found");
    }

    const instRoom = Math.max(0, inst.amount - inst.paidAmount);
    const feeRoom = Math.max(0, fee.totalAmount - fee.paidAmount);
    const delta = Math.min(creditMainCurrency, instRoom, feeRoom);
    if (delta <= 0) {
      throw new Error("No remaining balance to apply payment to");
    }

    inst.paidAmount += delta;
    inst.status = deriveInstallmentStatus(
      inst.amount,
      inst.paidAmount,
      inst.dueDate,
    );
    await inst.save({ session: session ?? undefined });

    await syncFeeFromInstallments(fee, session);

    let fq = Fee.findById(fee._id);
    if (session) fq = fq.session(session);
    const refreshed = await fq.exec();
    if (!refreshed) throw new Error("Fee not found after payment");
    return { credited: delta, fee: refreshed };
  }

  if (installmentId) {
    throw new Error("installmentId must not be set for non-installment fees");
  }

  const room = Math.max(0, fee.totalAmount - fee.paidAmount);
  const delta = Math.min(creditMainCurrency, room);
  if (delta <= 0) {
    throw new Error("No remaining balance to apply payment to");
  }

  fee.paidAmount += delta;
  applyNonInstallmentAggregates(fee);
  await fee.save({ session: session ?? undefined });

  let fq = Fee.findById(fee._id);
  if (session) fq = fq.session(session);
  const refreshed = await fq.exec();
  if (!refreshed) throw new Error("Fee not found after payment");
  return { credited: delta, fee: refreshed };
}
