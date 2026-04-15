import crypto from "crypto";
import mongoose, { ClientSession } from "mongoose";
import Razorpay from "razorpay";
import { env } from "../../config/env";
import { logger } from "../../utils/logger";
import { Fee, IFee } from "../fee/fee.model";
import { Installment } from "../fee/installment.model";
import { applyPaymentCredit } from "../fee/fee.service";
import { Student } from "../student/student.model";
import { IPayment, Payment, PaymentStatus } from "./payment.model";
import type { CreateOrderBody } from "./payment.validation";
import { ReminderToken } from "../reminder/reminder-token.model";
import { ensureInvoiceForPayment } from "../invoice/invoice.service";
import { DAY_MS, startOfBusinessDay } from "../../config/timezone";

const SCOPE = "payment.service";
const DAILY_PENALTY_GRACE_DAYS = 0;
const DAILY_PENALTY_CAP_RATIO = 0.25;

/** Passed from HTTP handler so service logs can be correlated with `payment.webhook` lines. */
export type WebhookRequestContext = {
  requestId: string;
};

function webhookMeta(
  ctx: WebhookRequestContext | undefined,
  extra?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  const out: Record<string, unknown> = {
    ...(ctx?.requestId ? { requestId: ctx.requestId } : {}),
    ...(extra ?? {}),
  };
  return Object.keys(out).length ? out : undefined;
}

export class PaymentIdempotencyConflictError extends Error {
  readonly code = "PAYMENT_IDEMPOTENCY_CONFLICT" as const;
  constructor() {
    super("Idempotency key was reused with a different request body");
    this.name = "PaymentIdempotencyConflictError";
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

function assertRazorpayConfigured(): void {
  if (!env.razorpayKeyId || !env.razorpayKeySecret) {
    throw new Error("Razorpay API keys are not configured");
  }
}

function getRazorpayClient(): Razorpay {
  assertRazorpayConfigured();
  return new Razorpay({
    key_id: env.razorpayKeyId,
    key_secret: env.razorpayKeySecret,
  });
}

function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

function paiseToRupees(paise: number): number {
  return Math.round(paise) / 100;
}

function hashCreateOrderPayload(input: {
  feeId: string;
  installmentId?: string;
  amountPaise: number;
  currency: string;
}): string {
  const normalized = {
    feeId: input.feeId,
    installmentId: input.installmentId ?? null,
    amountPaise: input.amountPaise,
    currency: input.currency.toUpperCase(),
  };
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(normalized))
    .digest("hex");
}

async function loadFeeForTenant(
  tenantId: string,
  feeId: string,
): Promise<IFee> {
  if (!mongoose.isValidObjectId(feeId)) {
    throw new Error("Invalid fee id");
  }
  const fee = await Fee.findOne({ _id: feeId, tenantId }).exec();
  if (!fee) {
    throw new Error("Fee not found");
  }
  return fee;
}

/**
 * Computes max payable in paise for this fee (and installment when applicable).
 */
async function computeRemainingPaise(
  fee: IFee,
  installmentId: string | undefined,
): Promise<{
  remainingPaise: number;
  principalRemainingPaise: number;
  penaltyRemainingPaise: number;
  overdueDays: number;
  installmentId?: string;
}> {
  const now = new Date();
  const instCount = await Installment.countDocuments({
    feeId: fee._id.toString(),
  }).exec();

  if (instCount > 0) {
    if (!installmentId || !mongoose.isValidObjectId(installmentId)) {
      throw new Error("installmentId is required for installment-based fees");
    }
    const inst = await Installment.findOne({
      _id: installmentId,
      feeId: fee._id.toString(),
    }).exec();
    if (!inst) {
      throw new Error("Installment not found for this fee");
    }

    const todayStart = startOfBusinessDay(now);
    const dueStart = startOfBusinessDay(inst.dueDate);
    const rawDaysOverdue = Math.max(
      0,
      Math.floor((todayStart.getTime() - dueStart.getTime()) / DAY_MS),
    );
    const overdueDays = Math.max(
      0,
      rawDaysOverdue - DAILY_PENALTY_GRACE_DAYS,
    );

    const dailyPenaltyRupees = Math.max(0, inst.lateFee ?? 0);
    const accruedPenaltyRupees = overdueDays * dailyPenaltyRupees;
    const penaltyCapRupees = Math.max(0, inst.amount * DAILY_PENALTY_CAP_RATIO);
    const cappedPenaltyRupees = Math.min(accruedPenaltyRupees, penaltyCapRupees);
    const penaltyPaidRupees = Math.max(0, inst.lateFeePaid ?? 0);
    const penaltyRemainingRupees = Math.max(
      0,
      cappedPenaltyRupees - penaltyPaidRupees,
    );

    const instRemaining = Math.max(0, inst.amount - inst.paidAmount);
    const feeRemaining = Math.max(0, fee.totalAmount - fee.paidAmount);
    const principalRemainingRupees = Math.min(instRemaining, feeRemaining);
    const principalRemainingPaise = rupeesToPaise(principalRemainingRupees);
    const penaltyRemainingPaise = rupeesToPaise(penaltyRemainingRupees);
    return {
      remainingPaise: principalRemainingPaise + penaltyRemainingPaise,
      principalRemainingPaise,
      penaltyRemainingPaise,
      overdueDays,
      installmentId: inst._id.toString(),
    };
  }

  if (installmentId) {
    throw new Error("installmentId must not be set for non-installment fees");
  }

  const remainingRupees = Math.max(0, fee.totalAmount - fee.paidAmount);
  const principalRemainingPaise = rupeesToPaise(remainingRupees);
  return {
    remainingPaise: principalRemainingPaise,
    principalRemainingPaise,
    penaltyRemainingPaise: 0,
    overdueDays: 0,
  };
}

function splitPaymentAmountPaise(
  amountPaise: number,
  principalRemainingPaise: number,
  penaltyRemainingPaise: number,
): { principalAmountPaise: number; penaltyAmountPaise: number } {
  const penaltyAmountPaise = Math.min(amountPaise, penaltyRemainingPaise);
  const principalAmountPaise = Math.min(
    amountPaise - penaltyAmountPaise,
    principalRemainingPaise,
  );
  return { principalAmountPaise, penaltyAmountPaise };
}

export interface CreateOrderResult {
  key: string;
  order: {
    id: string;
    amount: number;
    currency: string;
    receipt: string;
    status: string;
  };
  payment: {
    id: string;
    status: PaymentStatus;
    amount: number;
    currency: string;
    idempotencyKey: string;
  };
  replay: boolean;
}

export async function createOrder(
  tenantId: string,
  body: CreateOrderBody,
  idempotencyKey: string,
  options?: { payToken?: string },
): Promise<CreateOrderResult> {
  assertRazorpayConfigured();

  const fee = await loadFeeForTenant(tenantId, body.feeId);

  if (fee.studentId !== body.studentId) {
    throw new Error("Fee does not belong to the given student");
  }

  const student = await Student.findOne({
    _id: body.studentId,
    tenantId,
  }).exec();
  if (!student) {
    throw new Error("Student not found for this tenant");
  }

  const {
    remainingPaise,
    principalRemainingPaise,
    penaltyRemainingPaise,
    overdueDays,
    installmentId,
  } = await computeRemainingPaise(fee, body.installmentId);

  if (remainingPaise <= 0) {
    throw new Error("Nothing left to pay for this fee or installment");
  }

  let amountPaise = body.amount ?? remainingPaise;
  if (amountPaise <= 0 || !Number.isInteger(amountPaise)) {
    throw new Error("amount must be a positive integer (paise)");
  }
  if (amountPaise > remainingPaise) {
    throw new Error(
      "amount exceeds remaining balance (overpayment not allowed)",
    );
  }

  const currency = body.currency.toUpperCase();
  const { principalAmountPaise, penaltyAmountPaise } = splitPaymentAmountPaise(
    amountPaise,
    principalRemainingPaise,
    penaltyRemainingPaise,
  );
  const payloadHash = hashCreateOrderPayload({
    feeId: body.feeId,
    installmentId,
    amountPaise,
    currency,
  });

  const existing = await Payment.findOne({ tenantId, idempotencyKey }).exec();
  if (existing) {
    if (existing.idempotencyPayloadHash !== payloadHash) {
      throw new PaymentIdempotencyConflictError();
    }
    logger.info(SCOPE, "create-order idempotent replay", {
      paymentId: existing._id.toString(),
      orderId: existing.razorpayOrderId,
    });
    return {
      key: env.razorpayKeyId,
      order: {
        id: existing.razorpayOrderId,
        amount: existing.amount,
        currency: existing.currency,
        receipt: "",
        status: "replay",
      },
      payment: {
        id: existing._id.toString(),
        status: existing.status,
        amount: existing.amount,
        currency: existing.currency,
        idempotencyKey: existing.idempotencyKey,
      },
      replay: true,
    };
  }

  const receipt = `pay_${crypto.randomBytes(8).toString("hex")}`.slice(0, 40);
  const razorpay = getRazorpayClient();

  let order: {
    id: string;
    amount: number;
    currency: string;
    receipt?: string;
    status?: string;
  };
  try {
    order = (await razorpay.orders.create({
      amount: amountPaise,
      currency,
      receipt,
      notes: {
        tenantId,
        studentId: body.studentId,
        feeId: body.feeId,
        installmentId: installmentId ?? "",
      },
    })) as typeof order;
  } catch (err) {
    logger.error(SCOPE, "Razorpay order creation failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    throw new Error("Failed to create payment order with Razorpay");
  }

  try {
    const doc = await Payment.create({
      tenantId,
      studentId: body.studentId,
      feeId: body.feeId,
      ...(installmentId ? { installmentId } : {}),
      amount: amountPaise,
      principalAmount: principalAmountPaise,
      penaltyAmount: penaltyAmountPaise,
      ...(installmentId ? { overdueDaysAtCreation: overdueDays } : {}),
      currency,
      status: "INITIATED",
      razorpayOrderId: order.id,
      idempotencyKey,
      idempotencyPayloadHash: payloadHash,
      ...(options?.payToken ? { payToken: options.payToken } : {}),
    });

    logger.info(SCOPE, "payment order created", {
      paymentId: doc._id.toString(),
      orderId: order.id,
      amountPaise,
      tenantId,
    });

    return {
      key: env.razorpayKeyId,
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
        receipt: order.receipt ?? receipt,
        status: order.status ?? "created",
      },
      payment: {
        id: doc._id.toString(),
        status: doc.status,
        amount: doc.amount,
        currency: doc.currency,
        idempotencyKey: doc.idempotencyKey,
      },
      replay: false,
    };
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      const row = await Payment.findOne({ tenantId, idempotencyKey }).exec();
      if (row) {
        if (row.idempotencyPayloadHash !== payloadHash) {
          throw new PaymentIdempotencyConflictError();
        }
        return {
          key: env.razorpayKeyId,
          order: {
            id: row.razorpayOrderId,
            amount: row.amount,
            currency: row.currency,
            receipt: "",
            status: "replay",
          },
          payment: {
            id: row._id.toString(),
            status: row.status,
            amount: row.amount,
            currency: row.currency,
            idempotencyKey: row.idempotencyKey,
          },
          replay: true,
        };
      }
    }
    logger.error(SCOPE, "failed to persist payment after Razorpay order", {
      orderId: order.id,
      error: err instanceof Error ? err.message : String(err),
    });
    throw new Error("Failed to save payment record");
  }
}

const PAY_TOKEN_STALE_MS = 30 * 60 * 1000;

export type PayCheckoutResult =
  | {
      ok: true;
      key: string;
      orderId: string;
      amountPaise: number;
      currency: string;
      paymentId: string;
      studentName: string;
      feeTitle: string;
    }
  | {
      ok: false;
      code:
        | "invalid"
        | "expired"
        | "already_paid"
        | "nothing_to_pay"
        | "server_error";
      message: string;
    };

function mapPaymentToPayCheckout(
  p: IPayment,
  studentName: string,
  feeTitle: string,
): Extract<PayCheckoutResult, { ok: true }> {
  return {
    ok: true,
    key: env.razorpayKeyId,
    orderId: p.razorpayOrderId,
    amountPaise: p.amount,
    currency: p.currency,
    paymentId: p._id.toString(),
    studentName,
    feeTitle,
  };
}

async function refreshStaleInitiatedPaymentForPayToken(
  paymentDoc: IPayment,
  fee: IFee,
  body: CreateOrderBody,
  installmentId: string | undefined,
): Promise<Extract<PayCheckoutResult, { ok: true }>> {
  const {
    remainingPaise,
    principalRemainingPaise,
    penaltyRemainingPaise,
    overdueDays,
    installmentId: resolvedInst,
  } = await computeRemainingPaise(fee, installmentId);
  if (remainingPaise <= 0) {
    paymentDoc.status = "FAILED";
    paymentDoc.failureReason = "nothing_to_pay_on_refresh";
    await paymentDoc.save();
    throw new Error("nothing_to_pay");
  }

  let amountPaise = body.amount ?? remainingPaise;
  if (amountPaise <= 0 || !Number.isInteger(amountPaise)) {
    throw new Error("invalid amount");
  }
  if (amountPaise > remainingPaise) {
    throw new Error("overpayment");
  }

  const currency = body.currency.toUpperCase();
  const { principalAmountPaise, penaltyAmountPaise } = splitPaymentAmountPaise(
    amountPaise,
    principalRemainingPaise,
    penaltyRemainingPaise,
  );
  const payloadHash = hashCreateOrderPayload({
    feeId: body.feeId,
    installmentId: resolvedInst,
    amountPaise,
    currency,
  });

  const receipt = `pay_${crypto.randomBytes(8).toString("hex")}`.slice(0, 40);
  const razorpay = getRazorpayClient();

  let order: { id: string; amount: number; currency: string };
  try {
    order = (await razorpay.orders.create({
      amount: amountPaise,
      currency,
      receipt,
      notes: {
        tenantId: paymentDoc.tenantId,
        studentId: body.studentId,
        feeId: body.feeId,
        installmentId: resolvedInst ?? "",
      },
    })) as typeof order;
  } catch (err) {
    logger.error(SCOPE, "Razorpay order refresh failed (pay token)", {
      error: err instanceof Error ? err.message : String(err),
    });
    throw new Error("Failed to create payment order with Razorpay");
  }

  paymentDoc.razorpayOrderId = order.id;
  paymentDoc.amount = amountPaise;
  paymentDoc.principalAmount = principalAmountPaise;
  paymentDoc.penaltyAmount = penaltyAmountPaise;
  paymentDoc.overdueDaysAtCreation = resolvedInst ? overdueDays : 0;
  paymentDoc.currency = currency;
  paymentDoc.idempotencyPayloadHash = payloadHash;
  await paymentDoc.save();

  logger.info(SCOPE, "pay token order refreshed after stale INITIATED", {
    paymentId: paymentDoc._id.toString(),
    orderId: order.id,
  });

  const student = await Student.findOne({
    _id: body.studentId,
    tenantId: paymentDoc.tenantId,
  }).exec();
  return mapPaymentToPayCheckout(
    paymentDoc,
    student?.studentName ?? "Student",
    fee.title,
  );
}

/**
 * Creates or reuses a Razorpay order for a reminder SMS pay link (`payToken`).
 * Replays recent INITIATED orders; refreshes stale INITIATED in place; never allows overpayment.
 */
export async function createOrderForPayToken(
  token: string,
): Promise<PayCheckoutResult> {
  try {
    assertRazorpayConfigured();
  } catch {
    return {
      ok: false,
      code: "server_error",
      message: "Payment gateway is not configured",
    };
  }

  const trimmed = token.trim();
  if (!trimmed) {
    return { ok: false, code: "invalid", message: "Invalid payment link" };
  }

  const tokenDoc = await ReminderToken.findOne({ token: trimmed }).exec();
  if (!tokenDoc) {
    return { ok: false, code: "invalid", message: "Invalid payment link" };
  }
  if (tokenDoc.expiresAt.getTime() < Date.now()) {
    return {
      ok: false,
      code: "expired",
      message:
        "This payment link has expired. Request a new reminder from the school.",
    };
  }

  const fee = await Fee.findOne({
    _id: tokenDoc.feeId,
    tenantId: tokenDoc.tenantId,
  }).exec();
  if (!fee) {
    return { ok: false, code: "invalid", message: "Fee not found" };
  }

  const student = await Student.findOne({
    _id: tokenDoc.studentId,
    tenantId: tokenDoc.tenantId,
  }).exec();
  if (!student) {
    return { ok: false, code: "invalid", message: "Student not found" };
  }

  const instCount = await Installment.countDocuments({
    feeId: fee._id.toString(),
  }).exec();

  const rawTokenInst = tokenDoc.installmentId?.trim() ?? "";
  let installmentIdForOrder: string | undefined;

  if (instCount > 0) {
    if (!mongoose.isValidObjectId(rawTokenInst)) {
      return { ok: false, code: "invalid", message: "Invalid payment link" };
    }
    installmentIdForOrder = rawTokenInst;
  } else {
    installmentIdForOrder = undefined;
  }

  let remainingPaise: number;
  try {
    const r = await computeRemainingPaise(fee, installmentIdForOrder);
    remainingPaise = r.remainingPaise;
  } catch {
    return {
      ok: false,
      code: "invalid",
      message: "Unable to load payment for this fee",
    };
  }

  if (remainingPaise <= 0) {
    return {
      ok: false,
      code: "already_paid",
      message: "This fee is already paid. Thank you.",
    };
  }

  const body: CreateOrderBody = {
    studentId: student._id.toString(),
    feeId: fee._id.toString(),
    amount: remainingPaise,
    currency: "INR",
    ...(installmentIdForOrder ? { installmentId: installmentIdForOrder } : {}),
  };

  const activeInit = await Payment.findOne({
    tenantId: tokenDoc.tenantId,
    payToken: trimmed,
    status: "INITIATED",
  }).exec();

  if (activeInit) {
    const age = Date.now() - activeInit.updatedAt.getTime();
    if (age < PAY_TOKEN_STALE_MS) {
      logger.info(SCOPE, "pay token INITIATED replay", {
        paymentId: activeInit._id.toString(),
        payTokenSuffix: trimmed.slice(-8),
      });
      return mapPaymentToPayCheckout(
        activeInit,
        student.studentName,
        fee.title,
      );
    }
    try {
      return await refreshStaleInitiatedPaymentForPayToken(
        activeInit,
        fee,
        body,
        installmentIdForOrder,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === "nothing_to_pay") {
        return {
          ok: false,
          code: "already_paid",
          message: "This installment is already paid. Thank you.",
        };
      }
      logger.error(SCOPE, "pay token stale refresh failed", {
        error: msg,
        paymentId: activeInit._id.toString(),
      });
      return {
        ok: false,
        code: "server_error",
        message: "Could not start payment. Please try again.",
      };
    }
  }

  const priorCount = await Payment.countDocuments({
    tenantId: tokenDoc.tenantId,
    payToken: trimmed,
  }).exec();
  const idempotencyKey =
    priorCount === 0 ? `pay-${trimmed}` : `pay-${trimmed}-r${priorCount}`;

  try {
    const result = await createOrder(tokenDoc.tenantId, body, idempotencyKey, {
      payToken: trimmed,
    });
    logger.info(SCOPE, "pay token order created", {
      paymentId: result.payment.id,
      replay: result.replay,
      payTokenSuffix: trimmed.slice(-8),
    });
    const payDoc = await Payment.findById(result.payment.id).exec();
    if (!payDoc) {
      return {
        ok: false,
        code: "server_error",
        message: "Payment record missing after order creation",
      };
    }
    return mapPaymentToPayCheckout(payDoc, student.studentName, fee.title);
  } catch (err) {
    if (err instanceof PaymentIdempotencyConflictError) {
      return {
        ok: false,
        code: "server_error",
        message: "Payment session conflict. Open the link again.",
      };
    }
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("Nothing left to pay") || msg.includes("already paid")) {
      return {
        ok: false,
        code: "already_paid",
        message: "This installment is already paid. Thank you.",
      };
    }
    logger.error(SCOPE, "createOrderForPayToken failed", { error: msg });
    return {
      ok: false,
      code: "server_error",
      message: "Could not start payment. Please try again later.",
    };
  }
}

function verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
  if (!env.razorpayWebhookSecret) {
    logger.error(SCOPE, "RAZORPAY_WEBHOOK_SECRET is not set");
    return false;
  }
  const expected = crypto
    .createHmac("sha256", env.razorpayWebhookSecret)
    .update(rawBody)
    .digest("hex");

  if (expected.length !== signature.length) {
    return false;
  }
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, "utf8"),
      Buffer.from(signature, "utf8"),
    );
  } catch {
    return false;
  }
}

interface RazorpayPaymentEntity {
  id: string;
  amount: number;
  currency: string;
  order_id?: string;
  status?: string;
  notes?: Record<string, unknown>;
}

function extractPaymentEntity(payload: unknown): RazorpayPaymentEntity | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as {
    payment?: { entity?: RazorpayPaymentEntity };
  };
  const ent = p.payment?.entity;
  if (!ent?.id) return null;
  return ent;
}

async function findPaymentForWebhook(
  ent: RazorpayPaymentEntity,
): Promise<IPayment | null> {
  if (ent.order_id) {
    const byOrder = await Payment.findOne({
      razorpayOrderId: ent.order_id,
    }).exec();
    if (byOrder) {
      return byOrder;
    }
  }
  const raw = ent.notes?.paymentRecordId;
  const prId = typeof raw === "string" ? raw : raw != null ? String(raw) : "";
  if (prId && mongoose.isValidObjectId(prId)) {
    return Payment.findById(prId).exec();
  }
  return null;
}

/** Razorpay sends `payment_link.paid` when a Payment Link is fully paid (often instead of only `payment.captured`). */
function extractPaymentLinkPaidPayload(payload: unknown): {
  plinkId: string;
  amountPaise: number;
  currency: string;
  razorpayPaymentId?: string;
} | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as {
    payment_link?: { entity?: Record<string, unknown> };
  };
  const ent = p.payment_link?.entity;
  if (!ent || typeof ent !== "object") return null;
  const id = ent.id;
  if (typeof id !== "string" || !id.startsWith("plink_")) return null;

  const amountPaid = ent.amount_paid;
  const amount = ent.amount;
  const toPaise = (v: unknown): number => {
    if (typeof v === "number" && !Number.isNaN(v)) return Math.round(v);
    if (typeof v === "string" && v.trim() !== "") {
      const n = Number(v);
      return Number.isNaN(n) ? 0 : Math.round(n);
    }
    return 0;
  };
  const amountPaise = toPaise(amountPaid) || toPaise(amount);
  if (amountPaise <= 0) return null;

  const currency = typeof ent.currency === "string" ? ent.currency : "INR";

  let razorpayPaymentId: string | undefined;
  const payments = ent.payments;
  if (payments && typeof payments === "object" && !Array.isArray(payments)) {
    const pid = (payments as { payment_id?: string }).payment_id;
    if (typeof pid === "string") razorpayPaymentId = pid;
  }
  if (Array.isArray(payments) && payments.length > 0) {
    const pid = (payments[0] as { payment_id?: string })?.payment_id;
    if (typeof pid === "string") razorpayPaymentId = pid;
  }

  return { plinkId: id, amountPaise, currency, razorpayPaymentId };
}

async function applyCapturedPayment(
  paymentDoc: IPayment,
  capturedPaise: number,
  razorpayPaymentId: string,
  session: ClientSession,
): Promise<{ creditedRupees: number; appliedPaise: number }> {
  const cap = Math.min(Math.round(capturedPaise), paymentDoc.amount);
  if (cap <= 0) {
    throw new Error("Captured amount is zero");
  }

  const requestedPenaltyPaise = Math.min(
    cap,
    Math.max(0, paymentDoc.penaltyAmount ?? 0),
  );
  let appliedPenaltyPaise = 0;

  if (requestedPenaltyPaise > 0) {
    if (!paymentDoc.installmentId || !mongoose.isValidObjectId(paymentDoc.installmentId)) {
      logger.warn(
        SCOPE,
        "payment has penalty component without valid installment; falling back to principal",
        { paymentId: paymentDoc._id.toString() },
      );
    } else {
      let iq = Installment.findOne({
        _id: paymentDoc.installmentId,
        feeId: paymentDoc.feeId,
      });
      iq = iq.session(session);
      const inst = await iq.exec();
      if (!inst) {
        throw new Error("Installment not found while applying penalty");
      }

      const todayStart = startOfBusinessDay(new Date());
      const dueStart = startOfBusinessDay(inst.dueDate);
      const rawDaysOverdue = Math.max(
        0,
        Math.floor((todayStart.getTime() - dueStart.getTime()) / DAY_MS),
      );
      const overdueDays = Math.max(
        0,
        rawDaysOverdue - DAILY_PENALTY_GRACE_DAYS,
      );
      const dailyPenaltyRupees = Math.max(0, inst.lateFee ?? 0);
      const accruedPenaltyRupees = overdueDays * dailyPenaltyRupees;
      const penaltyCapRupees = Math.max(
        0,
        inst.amount * DAILY_PENALTY_CAP_RATIO,
      );
      const cappedPenaltyRupees = Math.min(
        accruedPenaltyRupees,
        penaltyCapRupees,
      );
      const penaltyRoomRupees = Math.max(
        0,
        cappedPenaltyRupees - Math.max(0, inst.lateFeePaid ?? 0),
      );
      const penaltyRoomPaise = rupeesToPaise(penaltyRoomRupees);

      appliedPenaltyPaise = Math.min(requestedPenaltyPaise, penaltyRoomPaise);
      if (appliedPenaltyPaise > 0) {
        inst.lateFeePaid =
          Math.max(0, inst.lateFeePaid ?? 0) + paiseToRupees(appliedPenaltyPaise);
        await inst.save({ session });
      }
    }
  }

  const principalPaiseToApply = cap - appliedPenaltyPaise;
  let principalCreditedRupees = 0;
  if (principalPaiseToApply > 0) {
    const { credited } = await applyPaymentCredit(
      paymentDoc.tenantId,
      paymentDoc.feeId,
      paymentDoc.installmentId,
      paiseToRupees(principalPaiseToApply),
      session,
    );
    principalCreditedRupees = credited;
  }

  if (appliedPenaltyPaise <= 0 && principalCreditedRupees <= 0) {
    throw new Error("No credit applied");
  }

  paymentDoc.status = "SUCCESS";
  paymentDoc.razorpayPaymentId = razorpayPaymentId;
  await paymentDoc.save({ session });

  logger.info(SCOPE, "payment captured and applied", {
    paymentRecordId: paymentDoc._id.toString(),
    orderId: paymentDoc.razorpayOrderId,
    razorpayPaymentId,
    creditedRupees: paiseToRupees(cap),
    principalCreditedRupees,
    penaltyAppliedPaise: appliedPenaltyPaise,
    paiseRequested: cap,
  });

  return { creditedRupees: paiseToRupees(cap), appliedPaise: cap };
}

export async function processWebhook(
  rawBody: Buffer | undefined,
  signatureHeader: string | undefined,
  context?: WebhookRequestContext,
): Promise<{ ok: boolean; ignored?: boolean; message?: string }> {
  const m = (extra?: Record<string, unknown>) => webhookMeta(context, extra);

  if (!rawBody || rawBody.length === 0) {
    logger.warn(SCOPE, "webhook missing raw body", m());
    return { ok: false, message: "missing body" };
  }

  if (!signatureHeader) {
    logger.warn(SCOPE, "webhook missing signature header", m());
    return { ok: false, message: "missing signature" };
  }

  if (!verifyWebhookSignature(rawBody, signatureHeader)) {
    logger.warn(SCOPE, "webhook signature verification failed", m());
    return { ok: false, message: "invalid signature" };
  }

  let parsed: { event?: string; payload?: unknown };
  try {
    parsed = JSON.parse(rawBody.toString("utf8")) as {
      event?: string;
      payload?: unknown;
    };
  } catch {
    logger.warn(SCOPE, "webhook JSON parse failed", m());
    return { ok: false, message: "invalid json" };
  }

  const event = parsed.event;

  logger.info(
    SCOPE,
    "webhook signature verified",
    m({
      event: event ?? "(none)",
      bodyBytes: rawBody.length,
    }),
  );

  if (event === "payment_link.paid") {
    const plinkData = extractPaymentLinkPaidPayload(parsed.payload);
    if (!plinkData) {
      logger.warn(
        SCOPE,
        "payment_link.paid payload missing or invalid entity",
        m(),
      );
      return { ok: true, ignored: true, message: "no payment_link entity" };
    }

    const paymentDoc = await Payment.findOne({
      razorpayPaymentLinkId: plinkData.plinkId,
    }).exec();

    if (!paymentDoc) {
      logger.warn(
        SCOPE,
        "payment_link.paid for unknown payment link id",
        m({ plinkId: plinkData.plinkId }),
      );
      return { ok: true, ignored: true, message: "unknown payment link" };
    }

    if (paymentDoc.status === "SUCCESS") {
      logger.info(
        SCOPE,
        "payment_link.paid duplicate ignored",
        m({
          plinkId: plinkData.plinkId,
          paymentRecordId: paymentDoc._id.toString(),
        }),
      );
      return { ok: true, ignored: true, message: "already success" };
    }

    if (paymentDoc.status === "FAILED") {
      logger.warn(
        SCOPE,
        "payment_link.paid after FAILED — manual review",
        m({
          plinkId: plinkData.plinkId,
          paymentRecordId: paymentDoc._id.toString(),
        }),
      );
      return { ok: true, ignored: true, message: "payment already failed" };
    }

    const currency = plinkData.currency.toUpperCase();
    if (currency !== paymentDoc.currency.toUpperCase()) {
      logger.error(
        SCOPE,
        "currency mismatch on payment_link.paid",
        m({
          plinkId: plinkData.plinkId,
          expected: paymentDoc.currency,
          got: currency,
        }),
      );
      return { ok: false, message: "currency mismatch" };
    }

    const razorpayPaymentIdForDb =
      plinkData.razorpayPaymentId ?? `plink:${plinkData.plinkId}`;

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const fresh = await Payment.findOne({ _id: paymentDoc._id })
        .session(session)
        .exec();
      if (!fresh) {
        throw new Error("Payment record missing in transaction");
      }
      if (fresh.status === "SUCCESS") {
        await session.abortTransaction();
        return { ok: true, ignored: true, message: "already success" };
      }

      const capture = await applyCapturedPayment(
        fresh,
        plinkData.amountPaise,
        razorpayPaymentIdForDb,
        session,
      );

      await session.commitTransaction();

      void ensureInvoiceForPayment({
        paymentId: fresh._id.toString(),
        appliedPaise: capture.appliedPaise,
        creditedRupees: capture.creditedRupees,
        razorpayPaymentId: razorpayPaymentIdForDb,
      }).catch((invErr) =>
        logger.error(SCOPE, "invoice after payment_link.paid failed", {
          paymentId: fresh._id.toString(),
          error: invErr instanceof Error ? invErr.message : String(invErr),
        }),
      );

      return { ok: true };
    } catch (err) {
      await session.abortTransaction();
      logger.error(
        SCOPE,
        "payment_link.paid processing failed",
        m({
          plinkId: plinkData.plinkId,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
      throw err;
    } finally {
      session.endSession();
    }
  }

  if (event === "payment.captured") {
    const paymentEntity = extractPaymentEntity(parsed.payload);
    if (!paymentEntity) {
      logger.warn(
        SCOPE,
        "payment.captured payload missing payment entity",
        m(),
      );
      return { ok: true, ignored: true, message: "no payment entity" };
    }

    const paymentDoc = await findPaymentForWebhook(paymentEntity);

    if (!paymentDoc) {
      logger.warn(
        SCOPE,
        "payment.captured for unknown payment/order",
        m({
          orderId: paymentEntity.order_id,
          razorpayPaymentId: paymentEntity.id,
        }),
      );
      return { ok: true, ignored: true, message: "unknown payment" };
    }

    if (paymentDoc.status === "SUCCESS") {
      logger.info(
        SCOPE,
        "payment.captured duplicate webhook ignored",
        m({
          orderId: paymentEntity.order_id,
          paymentRecordId: paymentDoc._id.toString(),
        }),
      );
      return { ok: true, ignored: true, message: "already success" };
    }

    if (paymentDoc.status === "FAILED") {
      logger.warn(
        SCOPE,
        "payment.captured after FAILED — manual review",
        m({
          orderId: paymentEntity.order_id,
          paymentRecordId: paymentDoc._id.toString(),
        }),
      );
      return { ok: true, ignored: true, message: "payment already failed" };
    }

    const capturedPaise = paymentEntity.amount;
    const currency = (paymentEntity.currency ?? "INR").toUpperCase();
    if (currency !== paymentDoc.currency.toUpperCase()) {
      logger.error(
        SCOPE,
        "currency mismatch on captured payment",
        m({
          orderId: paymentEntity.order_id,
          expected: paymentDoc.currency,
          got: currency,
        }),
      );
      return { ok: false, message: "currency mismatch" };
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const fresh = await Payment.findOne({ _id: paymentDoc._id })
        .session(session)
        .exec();
      if (!fresh) {
        throw new Error("Payment record missing in transaction");
      }
      if (fresh.status === "SUCCESS") {
        await session.abortTransaction();
        return { ok: true, ignored: true, message: "already success" };
      }

      const capture = await applyCapturedPayment(
        fresh,
        capturedPaise,
        paymentEntity.id,
        session,
      );

      await session.commitTransaction();

      void ensureInvoiceForPayment({
        paymentId: fresh._id.toString(),
        appliedPaise: capture.appliedPaise,
        creditedRupees: capture.creditedRupees,
        razorpayPaymentId: paymentEntity.id,
      }).catch((invErr) =>
        logger.error(SCOPE, "invoice after payment.captured failed", {
          paymentId: fresh._id.toString(),
          error: invErr instanceof Error ? invErr.message : String(invErr),
        }),
      );

      return { ok: true };
    } catch (err) {
      await session.abortTransaction();
      logger.error(
        SCOPE,
        "payment.captured processing failed",
        m({
          orderId: paymentEntity.order_id,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
      throw err;
    } finally {
      session.endSession();
    }
  }

  if (event === "payment.failed") {
    const paymentEntity = extractPaymentEntity(parsed.payload);
    if (!paymentEntity) {
      logger.warn(SCOPE, "payment.failed payload missing payment entity", m());
      return { ok: true, ignored: true, message: "no payment entity" };
    }

    const paymentDoc = await findPaymentForWebhook(paymentEntity);

    if (!paymentDoc) {
      logger.warn(
        SCOPE,
        "payment.failed for unknown payment/order",
        m({
          orderId: paymentEntity.order_id,
          razorpayPaymentId: paymentEntity.id,
        }),
      );
      return { ok: true, ignored: true, message: "unknown payment" };
    }

    if (paymentDoc.status === "SUCCESS") {
      logger.warn(
        SCOPE,
        "payment.failed received but local payment SUCCESS",
        m({ orderId: paymentEntity.order_id }),
      );
      return { ok: true, ignored: true, message: "already success" };
    }

    if (paymentDoc.status === "FAILED") {
      return { ok: true, ignored: true, message: "already failed" };
    }

    paymentDoc.status = "FAILED";
    paymentDoc.razorpayPaymentId = paymentEntity.id;
    paymentDoc.failureReason =
      (paymentEntity as { error_description?: string }).error_description ??
      "payment.failed";
    await paymentDoc.save();

    logger.info(
      SCOPE,
      "payment marked FAILED from webhook",
      m({
        paymentRecordId: paymentDoc._id.toString(),
        orderId: paymentEntity.order_id,
        razorpayPaymentId: paymentEntity.id,
      }),
    );
    return { ok: true };
  }

  logger.info(
    SCOPE,
    "webhook event not handled by processor (no-op)",
    m({ event: event ?? "(none)" }),
  );
  return { ok: true, ignored: true, message: "event not handled" };
}
