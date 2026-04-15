import crypto from "crypto";
import mongoose from "mongoose";
import { env } from "../../config/env";
import { logger } from "../../utils/logger";
import { Fee } from "../fee/fee.model";
import { Installment } from "../fee/installment.model";
import { Student } from "../student/student.model";
import { ReminderLog } from "./reminder-log.model";
import { ReminderToken } from "./reminder-token.model";
import { sendSms } from "./sms.service";
import { ROLES, type Role } from "../../types/roles";
import {
  DAY_MS,
  businessDayKey,
  startOfBusinessDay,
} from "../../config/timezone";

const SCOPE = "reminder.service";
const DAILY_PENALTY_GRACE_DAYS = 0;
const DAILY_PENALTY_CAP_RATIO = 0.25;

/**
 * Synthetic `ReminderToken.installmentId` / `ReminderLog.installmentId` for lump-sum fees
 * (unique per fee; not a Mongo ObjectId — pay flow resolves by fee installments count).
 */
function lumpReminderKey(feeId: string): string {
  return `lump:${feeId}`;
}

/** Increments access stats when a parent opens the pay link (idempotent per request). */
export async function recordPayLinkAccess(token: string): Promise<void> {
  const trimmed = token.trim();
  if (!trimmed) return;
  await ReminderToken.updateOne(
    { token: trimmed },
    { $inc: { accessCount: 1 }, $set: { lastAccessAt: new Date() } },
  ).exec();
}

const REMINDER_WINDOW_DAYS = 3;
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function endOfReminderWindowIst(now: Date): Date {
  const start = startOfBusinessDay(now);
  const end = new Date(start.getTime() + (REMINDER_WINDOW_DAYS + 1) * DAY_MS - 1);
  return end;
}

/**
 * Ensures a stable opaque pay token per reminder target (installment id or `lump:${feeId}`).
 */
async function upsertReminderToken(input: {
  installmentId: string;
  feeId: string;
  studentId: string;
  tenantId: string;
}): Promise<{ token: string }> {
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  const existing = await ReminderToken.findOne({
    installmentId: input.installmentId,
  }).exec();

  if (existing) {
    existing.expiresAt = expiresAt;
    existing.feeId = input.feeId;
    existing.studentId = input.studentId;
    existing.tenantId = input.tenantId;
    await existing.save();
    return { token: existing.token };
  }

  const token = crypto.randomBytes(24).toString("hex");
  await ReminderToken.create({
    token,
    installmentId: input.installmentId,
    feeId: input.feeId,
    studentId: input.studentId,
    tenantId: input.tenantId,
    expiresAt,
    accessCount: 0,
  });
  return { token };
}

function computeInstallmentReminderCollectRupees(
  fee: { totalAmount: number; paidAmount: number },
  inst: {
    amount: number;
    paidAmount: number;
    dueDate: Date;
    lateFee?: number;
    lateFeePaid?: number;
  },
  now: Date,
): {
  principalCollectRupees: number;
  penaltyCollectRupees: number;
  totalCollectRupees: number;
} {
  const principalPending = Math.max(0, inst.amount - inst.paidAmount);
  const feeRemaining = Math.max(0, fee.totalAmount - fee.paidAmount);
  const principalCollectRupees = Math.min(principalPending, feeRemaining);

  const todayStart = startOfBusinessDay(now);
  const dueStart = startOfBusinessDay(inst.dueDate);
  const rawDaysOverdue = Math.max(
    0,
    Math.floor((todayStart.getTime() - dueStart.getTime()) / DAY_MS),
  );
  const overdueDays = Math.max(0, rawDaysOverdue - DAILY_PENALTY_GRACE_DAYS);
  const dailyPenaltyRupees = Math.max(0, inst.lateFee ?? 0);
  const accruedPenaltyRupees = overdueDays * dailyPenaltyRupees;
  const penaltyCapRupees = Math.max(0, inst.amount * DAILY_PENALTY_CAP_RATIO);
  const cappedPenaltyRupees = Math.min(accruedPenaltyRupees, penaltyCapRupees);
  const penaltyPaidRupees = Math.max(0, inst.lateFeePaid ?? 0);
  const penaltyCollectRupees = Math.max(
    0,
    cappedPenaltyRupees - penaltyPaidRupees,
  );

  return {
    principalCollectRupees,
    penaltyCollectRupees,
    totalCollectRupees: principalCollectRupees + penaltyCollectRupees,
  };
}

export type ReminderRunSummary = {
  runId: string;
  scanned: number;
  smsSent: number;
  skippedPaid: number;
  skippedDedupe: number;
  skippedNoPhone: number;
  errors: number;
};

export type RunInstallmentRemindersOptions = {
  /** When set (e.g. staff-triggered), only installments under this tenant’s fees are processed. */
  tenantId?: string;
};

/**
 * Finds installments due on or before (today + 3 days) IST with a positive pending balance,
 * and lump-sum fees with `endDate` in that window and `pendingAmount` > 0.
 * Sends at most one SMS per installment per IST day, and one per lump-sum fee per day.
 *
 * Omit `tenantId` to process all tenants (daily cron / internal job). Pass `tenantId` for a single-school run.
 */
export async function runInstallmentReminders(
  options?: RunInstallmentRemindersOptions,
): Promise<ReminderRunSummary> {
  const runId = `run_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  const now = new Date();
  const reminderDay = businessDayKey(now);
  const dueBefore = endOfReminderWindowIst(now);

  const summary: ReminderRunSummary = {
    runId,
    scanned: 0,
    smsSent: 0,
    skippedPaid: 0,
    skippedDedupe: 0,
    skippedNoPhone: 0,
    errors: 0,
  };

  if (!env.publicAppUrl) {
    logger.warn(SCOPE, "PUBLIC_APP_URL is not set — skipping reminder run", { runId });
    return summary;
  }

  const baseQuery: Record<string, unknown> = {
    dueDate: { $lte: dueBefore },
  };

  if (options?.tenantId) {
    const feeDocs = await Fee.find({ tenantId: options.tenantId })
      .select("_id")
      .lean()
      .exec();
    const feeIds = feeDocs.map((f) => String(f._id));
    if (feeIds.length === 0) {
      logger.info(SCOPE, "reminder run: no fees for tenant", {
        runId,
        tenantId: options.tenantId,
      });
      return summary;
    }
    baseQuery.feeId = { $in: feeIds };
  }

  const candidates = await Installment.find(baseQuery)
    .sort({ dueDate: 1 })
    .lean()
    .exec();

  const lumpBaseQuery: Record<string, unknown> = {
    isInstallment: false,
    pendingAmount: { $gt: 0 },
    endDate: { $exists: true, $ne: null, $lte: dueBefore },
  };
  if (options?.tenantId) {
    lumpBaseQuery.tenantId = options.tenantId;
  }

  const lumpCandidates = await Fee.find(lumpBaseQuery)
    .sort({ endDate: 1 })
    .lean()
    .exec();

  summary.scanned = candidates.length + lumpCandidates.length;

  for (const inst of candidates) {
    try {
      if (!mongoose.isValidObjectId(inst.feeId)) {
        summary.errors += 1;
        continue;
      }

      const fee = await Fee.findById(inst.feeId).exec();
      if (!fee || !fee.isInstallment) {
        continue;
      }

      const instCount = await Installment.countDocuments({
        feeId: fee._id.toString(),
      }).exec();
      if (instCount === 0) {
        continue;
      }

      const feeRemaining = Math.max(0, fee.totalAmount - fee.paidAmount);
      if (feeRemaining <= 0) {
        summary.skippedPaid += 1;
        continue;
      }

      const { totalCollectRupees } = computeInstallmentReminderCollectRupees(
        fee,
        inst,
        now,
      );
      if (totalCollectRupees <= 0) {
        summary.skippedPaid += 1;
        continue;
      }

      const student = await Student.findOne({
        _id: fee.studentId,
        tenantId: fee.tenantId,
      }).exec();
      if (!student) {
        summary.errors += 1;
        continue;
      }

      const phone = student.parentPhoneNumber?.trim();
      if (!phone) {
        summary.skippedNoPhone += 1;
        continue;
      }

      const dedupe = await ReminderLog.findOne({
        installmentId: inst._id.toString(),
        reminderDay,
      }).exec();
      if (dedupe) {
        summary.skippedDedupe += 1;
        continue;
      }

      const { token } = await upsertReminderToken({
        installmentId: inst._id.toString(),
        feeId: fee._id.toString(),
        studentId: fee.studentId,
        tenantId: fee.tenantId,
      });

      const payUrl = `${env.publicAppUrl}/pay/${token}`;
      const dueStr = businessDayKey(new Date(inst.dueDate));
      const message = `Fee reminder: ${fee.title} for ${student.studentName}. Due ${dueStr}. Pending approx ₹${totalCollectRupees.toFixed(2)}. Pay: ${payUrl}`;

      const sms = await sendSms(phone, message);
      if (!sms.ok) {
        summary.errors += 1;
        logger.error(SCOPE, "SMS failed", {
          runId,
          installmentId: inst._id.toString(),
          error: sms.error,
        });
        continue;
      }

      try {
        await ReminderLog.create({
          runId,
          tenantId: fee.tenantId,
          installmentId: inst._id.toString(),
          feeId: fee._id.toString(),
          studentId: fee.studentId,
          token,
          reminderDay,
          phoneSuffix: phone.replace(/\D/g, "").slice(-4),
          sentAt: new Date(),
        });
      } catch (err) {
        if (isDuplicateKeyError(err)) {
          summary.skippedDedupe += 1;
          continue;
        }
        throw err;
      }

      summary.smsSent += 1;
      logger.info(SCOPE, "reminder SMS queued", {
        runId,
        installmentId: inst._id.toString(),
        tenantId: fee.tenantId,
        tokenSuffix: token.slice(-6),
      });
    } catch (err) {
      summary.errors += 1;
      logger.error(SCOPE, "reminder iteration error", {
        runId,
        installmentId: String(inst._id),
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  for (const feeDoc of lumpCandidates) {
    try {
      const pending = Math.max(0, feeDoc.pendingAmount ?? 0);
      if (pending <= 0) {
        summary.skippedPaid += 1;
        continue;
      }

      if (!feeDoc.endDate) {
        continue;
      }

      const instCount = await Installment.countDocuments({
        feeId: feeDoc._id.toString(),
      }).exec();
      if (instCount > 0) {
        continue;
      }

      const fee = await Fee.findById(feeDoc._id).exec();
      if (!fee || fee.isInstallment) {
        continue;
      }

      const feeRemaining = Math.max(0, fee.totalAmount - fee.paidAmount);
      if (feeRemaining <= 0) {
        summary.skippedPaid += 1;
        continue;
      }

      const collectRupees = Math.min(pending, feeRemaining);
      if (collectRupees <= 0) {
        summary.skippedPaid += 1;
        continue;
      }

      const student = await Student.findOne({
        _id: fee.studentId,
        tenantId: fee.tenantId,
      }).exec();
      if (!student) {
        summary.errors += 1;
        continue;
      }

      const phone = student.parentPhoneNumber?.trim();
      if (!phone) {
        summary.skippedNoPhone += 1;
        continue;
      }

      const lumpKey = lumpReminderKey(fee._id.toString());
      const dedupe = await ReminderLog.findOne({
        installmentId: lumpKey,
        reminderDay,
      }).exec();
      if (dedupe) {
        summary.skippedDedupe += 1;
        continue;
      }

      const { token } = await upsertReminderToken({
        installmentId: lumpKey,
        feeId: fee._id.toString(),
        studentId: fee.studentId,
        tenantId: fee.tenantId,
      });

      const payUrl = `${env.publicAppUrl}/pay/${token}`;
      const dueStr = businessDayKey(new Date(fee.endDate!));
      const message = `Fee reminder: ${fee.title} for ${student.studentName}. Due ${dueStr}. Pending approx ₹${collectRupees.toFixed(2)}. Pay: ${payUrl}`;

      const sms = await sendSms(phone, message);
      if (!sms.ok) {
        summary.errors += 1;
        logger.error(SCOPE, "SMS failed (lump-sum)", {
          runId,
          feeId: fee._id.toString(),
          error: sms.error,
        });
        continue;
      }

      try {
        await ReminderLog.create({
          runId,
          tenantId: fee.tenantId,
          installmentId: lumpKey,
          feeId: fee._id.toString(),
          studentId: fee.studentId,
          token,
          reminderDay,
          phoneSuffix: phone.replace(/\D/g, "").slice(-4),
          sentAt: new Date(),
        });
      } catch (err) {
        if (isDuplicateKeyError(err)) {
          summary.skippedDedupe += 1;
          continue;
        }
        throw err;
      }

      summary.smsSent += 1;
      logger.info(SCOPE, "reminder SMS queued (lump-sum)", {
        runId,
        feeId: fee._id.toString(),
        tenantId: fee.tenantId,
        tokenSuffix: token.slice(-6),
      });
    } catch (err) {
      summary.errors += 1;
      logger.error(SCOPE, "reminder iteration error (lump-sum)", {
        runId,
        feeId: String(feeDoc._id),
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  logger.info(SCOPE, "reminder run finished", summary);
  return summary;
}

export type SendInstallmentReminderResult =
  | { ok: true; message: string }
  | {
      ok: false;
      status: 400 | 404 | 409 | 503;
      message: string;
      code?: string;
    };

/**
 * Sends one installment reminder SMS (staff-triggered). Same dedupe as bulk run
 * (one SMS per installment per IST day). SUPER_ADMIN may target any tenant’s fee.
 */
export async function sendInstallmentReminderForTenant(
  ctx: { tenantId: string; role: Role },
  installmentId: string,
): Promise<SendInstallmentReminderResult> {
  const runId = `manual_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  const now = new Date();
  const reminderDay = businessDayKey(now);

  if (!env.publicAppUrl) {
    return {
      ok: false,
      status: 503,
      message: "PUBLIC_APP_URL is not set — cannot send pay link",
    };
  }

  if (!mongoose.isValidObjectId(installmentId)) {
    return { ok: false, status: 400, message: "Invalid installment id" };
  }

  const inst = await Installment.findById(installmentId).lean().exec();
  if (!inst) {
    return { ok: false, status: 404, message: "Installment not found" };
  }

  const fee = await Fee.findById(inst.feeId).exec();
  if (!fee) {
    return { ok: false, status: 404, message: "Installment not found" };
  }
  if (
    ctx.role !== ROLES.SUPER_ADMIN &&
    fee.tenantId !== ctx.tenantId
  ) {
    return { ok: false, status: 404, message: "Installment not found" };
  }
  if (!fee.isInstallment) {
    return {
      ok: false,
      status: 400,
      message: "Fee is not installment-based",
    };
  }

  const instCount = await Installment.countDocuments({
    feeId: fee._id.toString(),
  }).exec();
  if (instCount === 0) {
    return { ok: false, status: 400, message: "No installments on fee" };
  }

  const feeRemaining = Math.max(0, fee.totalAmount - fee.paidAmount);
  if (feeRemaining <= 0) {
    return { ok: false, status: 400, message: "Fee is fully paid" };
  }

  const { totalCollectRupees } = computeInstallmentReminderCollectRupees(
    fee,
    inst,
    now,
  );
  if (totalCollectRupees <= 0) {
    return { ok: false, status: 400, message: "Nothing to collect on this installment" };
  }

  const student = await Student.findOne({
    _id: fee.studentId,
    tenantId: fee.tenantId,
  }).exec();
  if (!student) {
    return { ok: false, status: 404, message: "Student not found" };
  }

  const phone = student.parentPhoneNumber?.trim();
  if (!phone) {
    return {
      ok: false,
      status: 400,
      message: "Parent phone number is missing",
      code: "NO_PHONE",
    };
  }

  const dedupe = await ReminderLog.findOne({
    installmentId: inst._id.toString(),
    reminderDay,
  }).exec();
  if (dedupe) {
    return {
      ok: false,
      status: 409,
      message: "A reminder was already sent for this installment today",
      code: "ALREADY_SENT_TODAY",
    };
  }

  const { token } = await upsertReminderToken({
    installmentId: inst._id.toString(),
    feeId: fee._id.toString(),
    studentId: fee.studentId,
    tenantId: fee.tenantId,
  });

  const payUrl = `${env.publicAppUrl}/pay/${token}`;
  const dueStr = businessDayKey(new Date(inst.dueDate));
  const message = `Fee reminder: ${fee.title} for ${student.studentName}. Due ${dueStr}. Pending approx ₹${totalCollectRupees.toFixed(2)}. Pay: ${payUrl}`;

  const sms = await sendSms(phone, message);
  if (!sms.ok) {
    logger.error(SCOPE, "manual reminder SMS failed", {
      runId,
      installmentId: inst._id.toString(),
      error: sms.error,
    });
    return {
      ok: false,
      status: 400,
      message: sms.error ?? "SMS failed",
      code: "SMS_FAILED",
    };
  }

  try {
    await ReminderLog.create({
      runId,
      tenantId: fee.tenantId,
      installmentId: inst._id.toString(),
      feeId: fee._id.toString(),
      studentId: fee.studentId,
      token,
      reminderDay,
      phoneSuffix: phone.replace(/\D/g, "").slice(-4),
      sentAt: new Date(),
    });
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      return {
        ok: false,
        status: 409,
        message: "A reminder was already sent for this installment today",
        code: "ALREADY_SENT_TODAY",
      };
    }
    throw err;
  }

  logger.info(SCOPE, "manual reminder SMS queued", {
    runId,
    installmentId: inst._id.toString(),
    tenantId: fee.tenantId,
  });

  return { ok: true, message: "Reminder SMS sent" };
}

/**
 * Sends one lump-sum (non-installment) fee reminder SMS. Dedupe key is per fee per IST day
 * (`lump:${feeId}` in ReminderLog). Same pay-link rules as bulk run.
 */
export async function sendFeeReminderForTenant(
  ctx: { tenantId: string; role: Role },
  feeId: string,
): Promise<SendInstallmentReminderResult> {
  const runId = `manual_fee_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  const now = new Date();
  const reminderDay = businessDayKey(now);

  if (!env.publicAppUrl) {
    return {
      ok: false,
      status: 503,
      message: "PUBLIC_APP_URL is not set — cannot send pay link",
    };
  }

  if (!mongoose.isValidObjectId(feeId)) {
    return { ok: false, status: 400, message: "Invalid fee id" };
  }

  const fee = await Fee.findById(feeId).exec();
  if (!fee) {
    return { ok: false, status: 404, message: "Fee not found" };
  }
  if (
    ctx.role !== ROLES.SUPER_ADMIN &&
    fee.tenantId !== ctx.tenantId
  ) {
    return { ok: false, status: 404, message: "Fee not found" };
  }
  if (fee.isInstallment) {
    return {
      ok: false,
      status: 400,
      message: "Fee is installment-based — use the installment reminder",
    };
  }

  const instCount = await Installment.countDocuments({
    feeId: fee._id.toString(),
  }).exec();
  if (instCount > 0) {
    return {
      ok: false,
      status: 400,
      message: "Fee has installment rows — use an installment reminder",
    };
  }

  const pending = Math.max(0, fee.pendingAmount ?? 0);
  if (pending <= 0) {
    return {
      ok: false,
      status: 400,
      message: "Fee has no pending balance",
    };
  }

  const feeRemaining = Math.max(0, fee.totalAmount - fee.paidAmount);
  if (feeRemaining <= 0) {
    return { ok: false, status: 400, message: "Fee is fully paid" };
  }

  const collectRupees = Math.min(pending, feeRemaining);
  if (collectRupees <= 0) {
    return {
      ok: false,
      status: 400,
      message: "Nothing to collect on this fee",
    };
  }

  const student = await Student.findOne({
    _id: fee.studentId,
    tenantId: fee.tenantId,
  }).exec();
  if (!student) {
    return { ok: false, status: 404, message: "Student not found" };
  }

  const phone = student.parentPhoneNumber?.trim();
  if (!phone) {
    return {
      ok: false,
      status: 400,
      message: "Parent phone number is missing",
      code: "NO_PHONE",
    };
  }

  const lumpKey = lumpReminderKey(fee._id.toString());
  const dedupe = await ReminderLog.findOne({
    installmentId: lumpKey,
    reminderDay,
  }).exec();
  if (dedupe) {
    return {
      ok: false,
      status: 409,
      message: "A reminder was already sent for this fee today",
      code: "ALREADY_SENT_TODAY",
    };
  }

  const { token } = await upsertReminderToken({
    installmentId: lumpKey,
    feeId: fee._id.toString(),
    studentId: fee.studentId,
    tenantId: fee.tenantId,
  });

  const payUrl = `${env.publicAppUrl}/pay/${token}`;
  const dueStr = fee.endDate
    ? businessDayKey(new Date(fee.endDate))
    : "—";
  const message = `Fee reminder: ${fee.title} for ${student.studentName}. Due ${dueStr}. Pending approx ₹${collectRupees.toFixed(2)}. Pay: ${payUrl}`;

  const sms = await sendSms(phone, message);
  if (!sms.ok) {
    logger.error(SCOPE, "manual reminder SMS failed (lump-sum)", {
      runId,
      feeId: fee._id.toString(),
      error: sms.error,
    });
    return {
      ok: false,
      status: 400,
      message: sms.error ?? "SMS failed",
      code: "SMS_FAILED",
    };
  }

  try {
    await ReminderLog.create({
      runId,
      tenantId: fee.tenantId,
      installmentId: lumpKey,
      feeId: fee._id.toString(),
      studentId: fee.studentId,
      token,
      reminderDay,
      phoneSuffix: phone.replace(/\D/g, "").slice(-4),
      sentAt: new Date(),
    });
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      return {
        ok: false,
        status: 409,
        message: "A reminder was already sent for this fee today",
        code: "ALREADY_SENT_TODAY",
      };
    }
    throw err;
  }

  logger.info(SCOPE, "manual reminder SMS queued (lump-sum)", {
    runId,
    feeId: fee._id.toString(),
    tenantId: fee.tenantId,
  });

  return { ok: true, message: "Reminder SMS sent" };
}

function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: number }).code === 11000
  );
}
