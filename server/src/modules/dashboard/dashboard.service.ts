import { Payment } from "../payment/payment.model";
import { Fee } from "../fee/fee.model";
import { Student } from "../student/student.model";
import { Installment } from "../fee/installment.model";
import { ManualPaymentCredit } from "../fee/manual-payment-credit.model";
import {
  distinctStudentIdsWithManualCredits,
  sumManualCreditsRupees,
} from "../fee/manual-payment-credit.service";
import { Course } from "../course/course.model";
import { getTenantType } from "../student/student.service";
import { STUDENT_CLASSES } from "../student/student.model";

function paiseSumToRupees(paiseSum: number): number {
  return Math.round(paiseSum) / 100;
}

function roundRupees(v: number): number {
  return Math.round(v * 100) / 100;
}

function percentChange(current: number, previous: number): number | null {
  if (previous === 0) {
    return current === 0 ? 0 : null;
  }
  return roundRupees(((current - previous) / previous) * 100);
}

export interface DashboardOverviewParams {
  tenantId: string;
  from: Date;
  to: Date;
  compare: boolean;
}

export interface DashboardOverviewResult {
  period: { from: string; to: string };
  comparePeriod?: { from: string; to: string };
  collected: {
    /** Online (Razorpay) + manual staff-recorded credits in range. */
    amount: number;
    onlineAmount: number;
    manualAmount: number;
    previousAmount?: number;
    changePercent?: number | null;
  };
  /** Sum of fee.pendingAmount across all fees (point-in-time outstanding). */
  pending: {
    amount: number;
  };
  students: {
    total: number;
    active: number;
    /** Distinct students with ≥1 successful payment or manual credit in the selected period. */
    paidInPeriod: number;
  };
}

async function sumSuccessfulPaymentsPaise(
  tenantId: string,
  from: Date,
  to: Date,
  endExclusive?: boolean,
): Promise<number> {
  const updatedAt = endExclusive
    ? { $gte: from, $lt: to }
    : { $gte: from, $lte: to };
  const [row] = await Payment.aggregate<{ totalPaise: number }>([
    {
      $match: {
        tenantId,
        status: "SUCCESS",
        updatedAt,
      },
    },
    { $group: { _id: null, totalPaise: { $sum: "$amount" } } },
  ]).exec();
  return row?.totalPaise ?? 0;
}

async function sumCollectedInRange(
  tenantId: string,
  from: Date,
  to: Date,
  endExclusive?: boolean,
): Promise<{
  onlineAmount: number;
  manualAmount: number;
  amount: number;
}> {
  const [collectedPaise, manualAmount] = await Promise.all([
    sumSuccessfulPaymentsPaise(tenantId, from, to, endExclusive),
    sumManualCreditsRupees(tenantId, from, to, endExclusive),
  ]);
  const onlineAmount = roundRupees(paiseSumToRupees(collectedPaise));
  const amount = roundRupees(onlineAmount + manualAmount);
  return { onlineAmount, manualAmount, amount };
}

async function countDistinctPaidStudents(
  tenantId: string,
  from: Date,
  to: Date,
): Promise<number> {
  const [fromPayments, fromManual] = await Promise.all([
    Payment.distinct("studentId", {
      tenantId,
      status: "SUCCESS",
      updatedAt: { $gte: from, $lte: to },
    }),
    distinctStudentIdsWithManualCredits(tenantId, from, to),
  ]);
  return new Set([...fromPayments, ...fromManual]).size;
}

async function sumPendingFees(tenantId: string): Promise<number> {
  const [row] = await Fee.aggregate<{ total: number }>([
    { $match: { tenantId } },
    { $group: { _id: null, total: { $sum: "$pendingAmount" } } },
  ]).exec();
  return row?.total ?? 0;
}

export async function getDashboardOverview(
  params: DashboardOverviewParams,
): Promise<DashboardOverviewResult> {
  const { tenantId, from, to, compare } = params;

  const collected = await sumCollectedInRange(tenantId, from, to);

  const [paidInPeriod, pendingSum, totalStudents, activeStudents] =
    await Promise.all([
      countDistinctPaidStudents(tenantId, from, to),
      sumPendingFees(tenantId),
      Student.countDocuments({ tenantId }).exec(),
      Student.countDocuments({ tenantId, status: "ACTIVE" }).exec(),
    ]);

  const result: DashboardOverviewResult = {
    period: { from: from.toISOString(), to: to.toISOString() },
    collected: {
      amount: collected.amount,
      onlineAmount: collected.onlineAmount,
      manualAmount: collected.manualAmount,
    },
    pending: { amount: roundRupees(pendingSum) },
    students: {
      total: totalStudents,
      active: activeStudents,
      paidInPeriod,
    },
  };

  if (!compare) {
    return result;
  }

  const durationMs = to.getTime() - from.getTime();
  const prevFrom = new Date(from.getTime() - durationMs);

  const previousCollected = await sumCollectedInRange(
    tenantId,
    prevFrom,
    from,
    true,
  );

  result.comparePeriod = {
    from: prevFrom.toISOString(),
    /** Exclusive end — same instant as current period `from`. */
    to: from.toISOString(),
  };
  result.collected.previousAmount = previousCollected.amount;
  result.collected.changePercent = percentChange(
    collected.amount,
    previousCollected.amount,
  );

  return result;
}

export type TrendGranularity = "daily" | "weekly" | "monthly";

export interface RevenueTrendParams {
  tenantId: string;
  from: Date;
  to: Date;
  granularity: TrendGranularity;
}

export interface RevenueTrendPoint {
  /** UTC bucket start (matches MongoDB $dateTrunc). */
  periodStart: string;
  /** Short label for chart axis (en-IN). */
  label: string;
  /** Online + manual credits in bucket (INR). */
  collected: number;
  /** Sum of installment amounts with dueDate in bucket (scheduled dues, INR). */
  due: number;
}

export interface RevenueTrendResult {
  granularity: TrendGranularity;
  period: { from: string; to: string };
  points: RevenueTrendPoint[];
}

function mongoTruncUnit(
  g: TrendGranularity,
): "day" | "week" | "month" {
  if (g === "daily") return "day";
  if (g === "weekly") return "week";
  return "month";
}

function startOfUtcDay(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}

/** Matches MongoDB $dateTrunc(..., unit: "week", timezone: "UTC") — week starts Sunday. */
function startOfUtcWeekSunday(d: Date): Date {
  const day = startOfUtcDay(d);
  const dow = day.getUTCDay();
  day.setUTCDate(day.getUTCDate() - dow);
  return day;
}

function startOfUtcMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function truncateUtc(d: Date, g: TrendGranularity): Date {
  if (g === "daily") return startOfUtcDay(d);
  if (g === "weekly") return startOfUtcWeekSunday(d);
  return startOfUtcMonth(d);
}

function addBucket(d: Date, g: TrendGranularity): Date {
  const x = new Date(d);
  if (g === "daily") {
    x.setUTCDate(x.getUTCDate() + 1);
    return x;
  }
  if (g === "weekly") {
    x.setUTCDate(x.getUTCDate() + 7);
    return x;
  }
  x.setUTCMonth(x.getUTCMonth() + 1);
  return x;
}

function formatTrendLabel(periodStart: Date, g: TrendGranularity): string {
  if (g === "monthly") {
    return new Intl.DateTimeFormat("en-IN", {
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(periodStart);
  }
  if (g === "weekly") {
    const end = new Date(periodStart);
    end.setUTCDate(end.getUTCDate() + 6);
    const fmt = new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    });
    return `${fmt.format(periodStart)} – ${fmt.format(end)}`;
  }
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(periodStart);
}

function iterBucketStarts(
  from: Date,
  to: Date,
  g: TrendGranularity,
): Date[] {
  const out: Date[] = [];
  let cur = truncateUtc(from, g);
  const end = truncateUtc(to, g);
  let guard = 0;
  /** Up to ~2 years of daily buckets + margin. */
  const max = 800;
  while (cur <= end && guard++ < max) {
    out.push(new Date(cur));
    cur = addBucket(cur, g);
  }
  return out;
}

export async function getRevenueTrend(
  params: RevenueTrendParams,
): Promise<RevenueTrendResult> {
  const { tenantId, from, to, granularity } = params;
  const unit = mongoTruncUnit(granularity);
  const feeColl = Fee.collection.name;

  const [paymentRows, manualRows, dueRows] = await Promise.all([
    Payment.aggregate<{
      _id: Date;
      paise: number;
    }>([
      {
        $match: {
          tenantId,
          status: "SUCCESS",
          updatedAt: { $gte: from, $lte: to },
        },
      },
      {
        $group: {
          _id: {
            $dateTrunc: {
              date: "$updatedAt",
              unit,
              timezone: "UTC",
            },
          },
          paise: { $sum: "$amount" },
        },
      },
    ]).exec(),
    ManualPaymentCredit.aggregate<{
      _id: Date;
      manual: number;
    }>([
      {
        $match: {
          tenantId,
          recordedAt: { $gte: from, $lte: to },
        },
      },
      {
        $group: {
          _id: {
            $dateTrunc: {
              date: "$recordedAt",
              unit,
              timezone: "UTC",
            },
          },
          manual: { $sum: "$amount" },
        },
      },
    ]).exec(),
    Installment.aggregate<{
      _id: Date;
      due: number;
    }>([
      {
        $match: {
          dueDate: { $gte: from, $lte: to },
        },
      },
      {
        $lookup: {
          from: feeColl,
          let: { fid: "$feeId" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: [{ $toString: "$_id" }, "$$fid"] },
              },
            },
            { $match: { tenantId } },
            { $limit: 1 },
          ],
          as: "fee",
        },
      },
      { $match: { "fee.0": { $exists: true } } },
      {
        $group: {
          _id: {
            $dateTrunc: {
              date: "$dueDate",
              unit,
              timezone: "UTC",
            },
          },
          due: { $sum: "$amount" },
        },
      },
    ]).exec(),
  ]);

  const collectedPaise = new Map<string, number>();
  for (const r of paymentRows) {
    if (!r._id) continue;
    const k = new Date(r._id).toISOString();
    collectedPaise.set(k, (collectedPaise.get(k) ?? 0) + r.paise);
  }
  const collectedManual = new Map<string, number>();
  for (const r of manualRows) {
    if (!r._id) continue;
    const k = new Date(r._id).toISOString();
    collectedManual.set(k, (collectedManual.get(k) ?? 0) + r.manual);
  }
  const dueMap = new Map<string, number>();
  for (const r of dueRows) {
    if (!r._id) continue;
    const k = new Date(r._id).toISOString();
    dueMap.set(k, (dueMap.get(k) ?? 0) + r.due);
  }

  const bucketStarts = iterBucketStarts(from, to, granularity);
  const points: RevenueTrendPoint[] = bucketStarts.map((periodStart) => {
    const key = periodStart.toISOString();
    const online = roundRupees(paiseSumToRupees(collectedPaise.get(key) ?? 0));
    const manual = roundRupees(collectedManual.get(key) ?? 0);
    const collected = roundRupees(online + manual);
    const due = roundRupees(dueMap.get(key) ?? 0);
    return {
      periodStart: key,
      label: formatTrendLabel(periodStart, granularity),
      collected,
      due,
    };
  });

  return {
    granularity,
    period: { from: from.toISOString(), to: to.toISOString() },
    points,
  };
}

export interface ClassPerformanceRow {
  className: string;
  /** Set for ACADEMY tenants when grouping by catalog course. */
  courseId?: string;
  totalAmount: number;
  paidAmount: number;
  /** 0–100 */
  percentCollected: number;
}

export interface ClassPerformanceResult {
  rows: ClassPerformanceRow[];
}

/**
 * ACADEMY: aggregate fee totals by student course (catalog), ordered like course list.
 */
async function getCoursePerformanceForAcademy(
  tenantId: string,
): Promise<ClassPerformanceResult> {
  const agg = await Fee.aggregate<{
    _id: string;
    totalAmount: number;
    paidAmount: number;
  }>([
    { $match: { tenantId } },
    {
      $lookup: {
        from: Student.collection.name,
        let: { sid: "$studentId" },
        pipeline: [
          {
            $match: {
              $expr: { $eq: [{ $toString: "$_id" }, "$$sid"] },
            },
          },
        ],
        as: "stu",
      },
    },
    { $unwind: "$stu" },
    {
      $group: {
        _id: { $ifNull: ["$stu.courseId", ""] },
        totalAmount: { $sum: "$totalAmount" },
        paidAmount: { $sum: "$paidAmount" },
      },
    },
  ]).exec();

  const courses = await Course.find({ tenantId }).lean().exec();
  const courseById = new Map(courses.map((c) => [String(c._id), c]));

  type RowSort = ClassPerformanceRow & {
    sortOrder: number;
    sortName: string;
  };

  const withSort: RowSort[] = agg.map((r) => {
    const id = String(r._id);
    const totalAmount = roundRupees(r.totalAmount);
    const paidAmount = roundRupees(r.paidAmount);
    const percentCollected =
      totalAmount > 0
        ? roundRupees((paidAmount / totalAmount) * 100)
        : 0;

    if (id === "") {
      return {
        className: "Unassigned",
        totalAmount,
        paidAmount,
        percentCollected,
        sortOrder: 1_000_000,
        sortName: "Unassigned",
      };
    }

    const c = courseById.get(id);
    const className = c?.name ?? `Course ${id}`;
    return {
      className,
      courseId: id,
      totalAmount,
      paidAmount,
      percentCollected,
      sortOrder: c?.sortOrder ?? 0,
      sortName: className,
    };
  });

  withSort.sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.sortName.localeCompare(b.sortName, undefined, {
      sensitivity: "base",
    });
  });

  const rows: ClassPerformanceRow[] = withSort
    .filter((r) => r.totalAmount > 0)
    .map(({ sortOrder: _so, sortName: _sn, ...row }) => row);

  return { rows };
}

export async function getClassPerformance(
  tenantId: string,
): Promise<ClassPerformanceResult> {
  const tenantType = await getTenantType(tenantId);
  if (tenantType === "ACADEMY") {
    return getCoursePerformanceForAcademy(tenantId);
  }

  const agg = await Fee.aggregate<{
    _id: string;
    totalAmount: number;
    paidAmount: number;
  }>([
    { $match: { tenantId } },
    {
      $lookup: {
        from: Student.collection.name,
        let: { sid: "$studentId" },
        pipeline: [
          {
            $match: {
              $expr: { $eq: [{ $toString: "$_id" }, "$$sid"] },
            },
          },
        ],
        as: "stu",
      },
    },
    { $unwind: "$stu" },
    {
      $group: {
        _id: "$stu.class",
        totalAmount: { $sum: "$totalAmount" },
        paidAmount: { $sum: "$paidAmount" },
      },
    },
  ]).exec();

  const byClass = new Map(
    agg.map((r) => [
      r._id,
      {
        totalAmount: roundRupees(r.totalAmount),
        paidAmount: roundRupees(r.paidAmount),
      },
    ]),
  );

  const rows: ClassPerformanceRow[] = STUDENT_CLASSES.map((className) => {
    const v = byClass.get(className);
    const totalAmount = v?.totalAmount ?? 0;
    const paidAmount = v?.paidAmount ?? 0;
    const percentCollected =
      totalAmount > 0
        ? roundRupees((paidAmount / totalAmount) * 100)
        : 0;
    return {
      className,
      totalAmount,
      paidAmount,
      percentCollected,
    };
  }).filter((r) => r.totalAmount > 0);

  return { rows };
}
