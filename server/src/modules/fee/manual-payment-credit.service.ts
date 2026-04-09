import type { ClientSession } from "mongoose";
import { ManualPaymentCredit } from "./manual-payment-credit.model";

function roundRupees(v: number): number {
  return Math.round(v * 100) / 100;
}

export interface RecordManualPaymentCreditInput {
  tenantId: string;
  feeId: string;
  studentId: string;
  installmentId?: string;
  /** Positive rupees credited toward paid balance. */
  amount: number;
  recordedAt?: Date;
  session?: ClientSession | null;
}

/**
 * Persists a manual credit line item. No-op if amount <= 0.
 * Not used for Razorpay `applyPaymentCredit` (those are summed via `Payment`).
 */
export async function recordManualPaymentCredit(
  input: RecordManualPaymentCreditInput,
): Promise<void> {
  if (input.amount <= 0) {
    return;
  }
  const doc = {
    tenantId: input.tenantId,
    feeId: input.feeId,
    studentId: input.studentId,
    installmentId: input.installmentId,
    amount: roundRupees(input.amount),
    recordedAt: input.recordedAt ?? new Date(),
  };
  if (input.session) {
    await ManualPaymentCredit.create([doc], { session: input.session });
  } else {
    await ManualPaymentCredit.create(doc);
  }
}

/** Rupees sum for manual credits in range (inclusive end unless endExclusive). */
export async function sumManualCreditsRupees(
  tenantId: string,
  from: Date,
  to: Date,
  endExclusive?: boolean,
): Promise<number> {
  const recordedAt = endExclusive
    ? { $gte: from, $lt: to }
    : { $gte: from, $lte: to };
  const [row] = await ManualPaymentCredit.aggregate<{ total: number }>([
    { $match: { tenantId, recordedAt } },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]).exec();
  return roundRupees(row?.total ?? 0);
}

export async function distinctStudentIdsWithManualCredits(
  tenantId: string,
  from: Date,
  to: Date,
): Promise<string[]> {
  return ManualPaymentCredit.distinct("studentId", {
    tenantId,
    recordedAt: { $gte: from, $lte: to },
  });
}
