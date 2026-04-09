import Razorpay from "razorpay";
import { env } from "../../config/env";
import { logger } from "../../utils/logger";
import { Payment } from "../payment/payment.model";
import { Settlement } from "./settlement.model";

const SCOPE = "settlement.service";

function roundRupees(v: number): number {
  return Math.round(v * 100) / 100;
}

function paiseToRupees(paise: number): number {
  return roundRupees(Math.round(paise) / 100);
}

function getRazorpay(): Razorpay {
  if (!env.razorpayKeyId || !env.razorpayKeySecret) {
    throw new Error("Razorpay API keys are not configured");
  }
  return new Razorpay({
    key_id: env.razorpayKeyId,
    key_secret: env.razorpayKeySecret,
  });
}

function unixSec(d: Date): number {
  return Math.floor(d.getTime() / 1000);
}

/** Normalize Razorpay GET /settlements item (shape varies by product). */
function mapRazorpaySettlementItem(raw: Record<string, unknown>): {
  settlementId: string;
  amount: number;
  fees: number;
  tax: number;
  settledAt: Date | null;
  status: string;
} | null {
  const id = raw.id;
  if (typeof id !== "string" || id.length === 0) {
    return null;
  }
  const feesPaise = Number(raw.fees ?? 0);
  const taxPaise = Number(raw.tax ?? 0);
  const amountSettledPaise = Number(
    raw.amount_settled ?? raw.amount ?? raw.total_amount ?? 0,
  );
  const amount = paiseToRupees(amountSettledPaise);
  const fees = paiseToRupees(Number.isFinite(feesPaise) ? feesPaise : 0);
  const tax = paiseToRupees(Number.isFinite(taxPaise) ? taxPaise : 0);
  const status = typeof raw.status === "string" ? raw.status : "unknown";
  const processedAt =
    typeof raw.processed_at === "number" ? raw.processed_at : null;
  const initiatedAt =
    typeof raw.initiated_at === "number" ? raw.initiated_at : null;
  const createdAt =
    typeof raw.created_at === "number" ? raw.created_at : null;
  const ts = processedAt ?? initiatedAt ?? createdAt;
  const settledAt =
    ts != null && ts > 0 ? new Date(ts * 1000) : null;
  return { settlementId: id, amount, fees, tax, settledAt, status };
}

/**
 * Pull settlement batches from Razorpay and upsert into DB.
 */
export async function syncSettlementsFromRazorpay(): Promise<number> {
  const rz = getRazorpay();
  const now = new Date();
  const from = new Date(now.getTime() - 120 * 24 * 60 * 60 * 1000);
  let skip = 0;
  const count = 100;
  let upserted = 0;
  const syncedAt = new Date();

  const upsertPage = async (
    query: Record<string, string | number>,
  ): Promise<{ items: unknown[]; done: boolean }> => {
    const res = (await rz.settlements.all(
      query as Parameters<typeof rz.settlements.all>[0],
    )) as { items?: unknown[] };
    const items = Array.isArray(res.items) ? res.items : [];
    for (const item of items) {
      const raw =
        typeof item === "object" && item !== null
          ? (item as Record<string, unknown>)
          : {};
      const mapped = mapRazorpaySettlementItem(raw);
      if (!mapped) continue;

      await Settlement.findOneAndUpdate(
        { settlementId: mapped.settlementId },
        {
          $set: {
            settlementId: mapped.settlementId,
            amount: mapped.amount,
            fees: mapped.fees,
            tax: mapped.tax,
            settledAt: mapped.settledAt,
            status: mapped.status,
            currency: "INR",
            syncedAt,
          },
        },
        { upsert: true },
      ).exec();
      upserted += 1;
    }
    return { items, done: items.length < count };
  };

  try {
    for (;;) {
      const { items, done } = await upsertPage({
        from: unixSec(from),
        to: unixSec(now),
        count,
        skip,
      });
      if (items.length === 0) break;
      if (done) break;
      skip += count;
      if (skip > 5000) break;
    }
  } catch (err: unknown) {
    logger.warn(SCOPE, "settlements.all with date range failed, retrying", {
      message: err instanceof Error ? err.message : String(err),
    });
    try {
      skip = 0;
      for (;;) {
        const { items, done } = await upsertPage({ count, skip });
        if (items.length === 0) break;
        if (done) break;
        skip += count;
        if (skip > 5000) break;
      }
    } catch (err2: unknown) {
      logger.error(SCOPE, "settlements sync failed", {
        message: err2 instanceof Error ? err2.message : String(err2),
      });
      return upserted;
    }
  }

  return upserted;
}

function isLinkableRazorpayPaymentId(
  id: string | undefined,
): id is string {
  if (!id || typeof id !== "string") return false;
  return id.startsWith("pay_");
}

/**
 * For successful payments, fetch Razorpay payment and attach `settlement_id` when present.
 */
export async function linkPaymentsToSettlements(
  maxPayments = 50,
): Promise<number> {
  const rz = getRazorpay();
  const candidates = await Payment.find({
    status: "SUCCESS",
    razorpayPaymentId: { $exists: true, $ne: null },
    $or: [
      { razorpaySettlementId: { $exists: false } },
      { razorpaySettlementId: null },
      { razorpaySettlementId: "" },
    ],
  })
    .limit(maxPayments)
    .lean()
    .exec();

  let linked = 0;
  for (const row of candidates) {
    const pid = row.razorpayPaymentId;
    if (!isLinkableRazorpayPaymentId(pid)) continue;
    const payId = pid;
    try {
      const ent = (await rz.payments.fetch(
        payId,
      )) as unknown as Record<string, unknown>;
      const sid = ent.settlement_id;
      if (typeof sid !== "string" || sid.length === 0) continue;
      await Payment.updateOne(
        { _id: row._id },
        { $set: { razorpaySettlementId: sid } },
      ).exec();
      linked += 1;
    } catch (e: unknown) {
      logger.warn(SCOPE, "payment fetch for settlement link failed", {
        paymentId: payId,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }
  return linked;
}

export async function runSettlementSyncJob(): Promise<{
  settlementsUpserted: number;
  paymentsLinked: number;
}> {
  if (!env.razorpayKeyId || !env.razorpayKeySecret) {
    logger.info(SCOPE, "skipping settlement sync — Razorpay keys not set");
    return { settlementsUpserted: 0, paymentsLinked: 0 };
  }
  const settlementsUpserted = await syncSettlementsFromRazorpay();
  const paymentsLinked = await linkPaymentsToSettlements(60);
  logger.info(SCOPE, "settlement sync completed", {
    settlementsUpserted,
    paymentsLinked,
  });
  return { settlementsUpserted, paymentsLinked };
}

export interface TenantSettlementDashboardResult {
  summary: {
    totalCollectedInr: number;
    totalSettledInr: number;
    inTransitInr: number;
  };
  items: Array<{
    settlementId: string;
    amount: number;
    fees: number;
    tax: number;
    settledAt: string | null;
    status: string;
  }>;
  total: number;
  page: number;
  limit: number;
}

async function sumGatewayCollectedPaise(tenantId: string): Promise<number> {
  const [row] = await Payment.aggregate<{ t: number }>([
    { $match: { tenantId, status: "SUCCESS" } },
    { $group: { _id: null, t: { $sum: "$amount" } } },
  ]).exec();
  return row?.t ?? 0;
}

async function sumSettledPaise(tenantId: string): Promise<number> {
  const [row] = await Payment.aggregate<{ t: number }>([
    {
      $match: {
        tenantId,
        status: "SUCCESS",
        razorpaySettlementId: { $exists: true, $nin: [null, ""] },
      },
    },
    { $group: { _id: null, t: { $sum: "$amount" } } },
  ]).exec();
  return row?.t ?? 0;
}

async function sumInTransitPaise(tenantId: string): Promise<number> {
  const [row] = await Payment.aggregate<{ t: number }>([
    {
      $match: {
        tenantId,
        status: "SUCCESS",
        $or: [
          { razorpaySettlementId: { $exists: false } },
          { razorpaySettlementId: null },
          { razorpaySettlementId: "" },
        ],
      },
    },
    { $group: { _id: null, t: { $sum: "$amount" } } },
  ]).exec();
  return row?.t ?? 0;
}

/**
 * Reconciliation for a tenant: gateway totals vs payments linked to a settlement.
 * Settlement rows are those referenced by tenant payments.
 */
export async function getTenantSettlementDashboard(params: {
  tenantId: string;
  page: number;
  limit: number;
}): Promise<TenantSettlementDashboardResult> {
  const { tenantId, page, limit } = params;
  const safeLimit = Math.min(Math.max(limit, 1), 100);
  const skip = Math.max(page - 1, 0) * safeLimit;

  const [totalCollectedPaise, settledPaise, inTransitPaise] =
    await Promise.all([
      sumGatewayCollectedPaise(tenantId),
      sumSettledPaise(tenantId),
      sumInTransitPaise(tenantId),
    ]);

  const rawIds = await Payment.distinct("razorpaySettlementId", {
    tenantId,
    razorpaySettlementId: { $exists: true, $nin: [null, ""] },
  });

  const uniqueIds = [
    ...new Set(
      rawIds.filter(
        (id): id is string => typeof id === "string" && id.length > 0,
      ),
    ),
  ];

  const total = uniqueIds.length;

  const docs =
    uniqueIds.length > 0
      ? await Settlement.find({ settlementId: { $in: uniqueIds } })
          .lean()
          .exec()
      : [];

  const byId = new Map(docs.map((d) => [d.settlementId, d]));

  const sortedIds = [...uniqueIds].sort((a, b) => {
    const ta =
      byId.get(a)?.settledAt != null
        ? new Date(byId.get(a)!.settledAt as Date).getTime()
        : 0;
    const tb =
      byId.get(b)?.settledAt != null
        ? new Date(byId.get(b)!.settledAt as Date).getTime()
        : 0;
    if (tb !== ta) return tb - ta;
    return b.localeCompare(a);
  });

  const pageIds = sortedIds.slice(skip, skip + safeLimit);

  const items = pageIds.map((settlementId) => {
    const d = byId.get(settlementId);
    return {
      settlementId,
      amount: d?.amount ?? 0,
      fees: d?.fees ?? 0,
      tax: d?.tax ?? 0,
      settledAt: d?.settledAt
        ? new Date(d.settledAt).toISOString()
        : null,
      status: d?.status ?? "pending_sync",
    };
  });

  return {
    summary: {
      totalCollectedInr: paiseToRupees(totalCollectedPaise),
      totalSettledInr: paiseToRupees(settledPaise),
      inTransitInr: paiseToRupees(inTransitPaise),
    },
    items,
    total,
    page: Math.max(page, 1),
    limit: safeLimit,
  };
}
