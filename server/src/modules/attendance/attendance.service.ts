import mongoose from "mongoose";
import {
  Attendance,
  IAttendance,
  ATTENDANCE_STATUSES,
  type AttendanceRecord,
} from "./attendance.model";
import { AttendanceAbsenceNotification } from "./attendance-absence-notification.model";
import {
  enqueueAttendanceSmsJobs,
  type AttendanceSmsJob,
} from "./attendance-notification-queue";
import {
  Student,
  type StudentClass,
  type StudentSection,
} from "../student/student.model";

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: number }).code === 11000
  );
}

function serializeAttendance(doc: IAttendance) {
  return {
    id: doc._id.toString(),
    tenantId: doc.tenantId,
    dateKey: doc.dateKey,
    class: doc.class,
    section: doc.section,
    records: doc.records,
    markedBy: doc.markedBy,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

function percentage(part: number, total: number): number {
  if (total <= 0) return 0;
  return round2((part / total) * 100);
}

function toUtcDate(dateKey: string): Date {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function toDateKeyUTC(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function startOfUtcWeekSunday(d: Date): Date {
  const day = startOfUtcDay(d);
  const dow = day.getUTCDay();
  day.setUTCDate(day.getUTCDate() - dow);
  return day;
}

function startOfUtcMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function truncateBucketDate(
  d: Date,
  granularity: AttendanceDashboardTrendResult["granularity"],
): Date {
  if (granularity === "daily") return startOfUtcDay(d);
  if (granularity === "weekly") return startOfUtcWeekSunday(d);
  return startOfUtcMonth(d);
}

function addBucket(
  d: Date,
  granularity: AttendanceDashboardTrendResult["granularity"],
): Date {
  const x = new Date(d);
  if (granularity === "daily") {
    x.setUTCDate(x.getUTCDate() + 1);
    return x;
  }
  if (granularity === "weekly") {
    x.setUTCDate(x.getUTCDate() + 7);
    return x;
  }
  x.setUTCMonth(x.getUTCMonth() + 1);
  return x;
}

function formatTrendLabel(
  periodStart: Date,
  granularity: AttendanceDashboardTrendResult["granularity"],
): string {
  if (granularity === "monthly") {
    return new Intl.DateTimeFormat("en-IN", {
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(periodStart);
  }
  if (granularity === "weekly") {
    const end = new Date(periodStart);
    end.setUTCDate(end.getUTCDate() + 6);
    const fmt = new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    });
    return `${fmt.format(periodStart)} - ${fmt.format(end)}`;
  }
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(periodStart);
}

function attendanceMatchFilter(input: {
  tenantId: string;
  from?: string;
  to?: string;
  class?: StudentClass;
  section?: StudentSection;
}): {
  tenantId: string;
  dateKey?: { $gte: string; $lte: string };
  class?: StudentClass;
  section?: StudentSection;
} {
  const filter: {
    tenantId: string;
    dateKey?: { $gte: string; $lte: string };
    class?: StudentClass;
    section?: StudentSection;
  } = {
    tenantId: input.tenantId,
  };
  if (input.from && input.to) {
    filter.dateKey = { $gte: input.from, $lte: input.to };
  }
  if (input.class) {
    filter.class = input.class;
  }
  if (input.section) {
    filter.section = input.section;
  }
  return filter;
}

export interface AttendanceDashboardSummaryResult {
  filters: {
    from: string;
    to: string;
    class?: StudentClass;
    section?: StudentSection;
  };
  totals: {
    sessions: number;
    studentsMarked: number;
    presentCount: number;
    absentCount: number;
    attendancePercent: number;
  };
  meta: {
    lastMarkedAt?: string;
    lastMarkedBy?: string;
  };
}

export async function getAttendanceDashboardSummary(input: {
  tenantId: string;
  from: string;
  to: string;
  class?: StudentClass;
  section?: StudentSection;
}): Promise<AttendanceDashboardSummaryResult> {
  assertValidDateKey(input.from);
  assertValidDateKey(input.to);
  if (input.from > input.to) {
    throw new Error("from must be on or before to");
  }

  const match = attendanceMatchFilter(input);
  const [rows, latest] = await Promise.all([
    Attendance.aggregate<{
      sessions: number;
      studentsMarked: number;
      presentCount: number;
      absentCount: number;
    }>([
      { $match: match },
      {
        $project: {
          records: 1,
          sessionCount: { $literal: 1 },
        },
      },
      {
        $addFields: {
          studentsMarked: { $size: "$records" },
          presentCount: {
            $size: {
              $filter: {
                input: "$records",
                as: "r",
                cond: { $eq: ["$$r.status", "PRESENT"] },
              },
            },
          },
          absentCount: {
            $size: {
              $filter: {
                input: "$records",
                as: "r",
                cond: { $eq: ["$$r.status", "ABSENT"] },
              },
            },
          },
        },
      },
      {
        $group: {
          _id: null,
          sessions: { $sum: "$sessionCount" },
          studentsMarked: { $sum: "$studentsMarked" },
          presentCount: { $sum: "$presentCount" },
          absentCount: { $sum: "$absentCount" },
        },
      },
    ]).exec(),
    Attendance.findOne(match)
      .sort({ updatedAt: -1 })
      .select({ updatedAt: 1, markedBy: 1 })
      .lean()
      .exec(),
  ]);

  const summary = rows[0] ?? {
    sessions: 0,
    studentsMarked: 0,
    presentCount: 0,
    absentCount: 0,
  };

  return {
    filters: {
      from: input.from,
      to: input.to,
      class: input.class,
      section: input.section,
    },
    totals: {
      sessions: summary.sessions,
      studentsMarked: summary.studentsMarked,
      presentCount: summary.presentCount,
      absentCount: summary.absentCount,
      attendancePercent: percentage(summary.presentCount, summary.studentsMarked),
    },
    meta: {
      lastMarkedAt: latest?.updatedAt?.toISOString(),
      lastMarkedBy: latest?.markedBy,
    },
  };
}

export interface AttendanceDashboardTrendPoint {
  dateKey: string;
  label: string;
  presentCount: number;
  absentCount: number;
  studentsMarked: number;
  attendancePercent: number;
}

export interface AttendanceDashboardTrendResult {
  granularity: "daily" | "weekly" | "monthly";
  filters: {
    from: string;
    to: string;
    class?: StudentClass;
    section?: StudentSection;
  };
  points: AttendanceDashboardTrendPoint[];
}

export async function getAttendanceDashboardTrend(input: {
  tenantId: string;
  from: string;
  to: string;
  class?: StudentClass;
  section?: StudentSection;
  granularity: "daily" | "weekly" | "monthly";
}): Promise<AttendanceDashboardTrendResult> {
  assertValidDateKey(input.from);
  assertValidDateKey(input.to);
  if (input.from > input.to) {
    throw new Error("from must be on or before to");
  }

  const rows = await Attendance.aggregate<{
    _id: string;
    presentCount: number;
    absentCount: number;
    studentsMarked: number;
  }>([
    { $match: attendanceMatchFilter(input) },
    {
      $project: {
        dateKey: 1,
        studentsMarked: { $size: "$records" },
        presentCount: {
          $size: {
            $filter: {
              input: "$records",
              as: "r",
              cond: { $eq: ["$$r.status", "PRESENT"] },
            },
          },
        },
        absentCount: {
          $size: {
            $filter: {
              input: "$records",
              as: "r",
              cond: { $eq: ["$$r.status", "ABSENT"] },
            },
          },
        },
      },
    },
    {
      $group: {
        _id: "$dateKey",
        presentCount: { $sum: "$presentCount" },
        absentCount: { $sum: "$absentCount" },
        studentsMarked: { $sum: "$studentsMarked" },
      },
    },
  ]).exec();

  const bucketAggregate = new Map<
    string,
    { presentCount: number; absentCount: number; studentsMarked: number }
  >();

  for (const row of rows) {
    const rowDate = toUtcDate(row._id);
    const bucketDate = truncateBucketDate(rowDate, input.granularity);
    const bucketKey = toDateKeyUTC(bucketDate);
    const prev = bucketAggregate.get(bucketKey) ?? {
      presentCount: 0,
      absentCount: 0,
      studentsMarked: 0,
    };
    prev.presentCount += row.presentCount;
    prev.absentCount += row.absentCount;
    prev.studentsMarked += row.studentsMarked;
    bucketAggregate.set(bucketKey, prev);
  }

  const points: AttendanceDashboardTrendPoint[] = [];
  let cursor = truncateBucketDate(toUtcDate(input.from), input.granularity);
  const end = truncateBucketDate(toUtcDate(input.to), input.granularity);
  let guard = 0;
  while (cursor <= end && guard < 1000) {
    const key = toDateKeyUTC(cursor);
    const agg = bucketAggregate.get(key) ?? {
      presentCount: 0,
      absentCount: 0,
      studentsMarked: 0,
    };
    points.push({
      dateKey: key,
      label: formatTrendLabel(cursor, input.granularity),
      presentCount: agg.presentCount,
      absentCount: agg.absentCount,
      studentsMarked: agg.studentsMarked,
      attendancePercent: percentage(agg.presentCount, agg.studentsMarked),
    });
    cursor = addBucket(cursor, input.granularity);
    guard += 1;
  }

  return {
    granularity: input.granularity,
    filters: {
      from: input.from,
      to: input.to,
      class: input.class,
      section: input.section,
    },
    points,
  };
}

export interface AttendanceDashboardRecordRow {
  studentId: string;
  studentName: string;
  scholarId?: string;
  status: (typeof ATTENDANCE_STATUSES)[number];
  remark?: string;
}

export interface AttendanceDashboardRecordsResult {
  attendance: {
    id: string;
    dateKey: string;
    class: StudentClass;
    section: StudentSection;
    markedBy: string;
    updatedAt: Date;
  } | null;
  items: AttendanceDashboardRecordRow[];
  total: number;
  page: number;
  limit: number;
}

export async function getAttendanceDashboardRecords(input: {
  tenantId: string;
  dateKey: string;
  class: StudentClass;
  section: StudentSection;
  status?: (typeof ATTENDANCE_STATUSES)[number];
  page: number;
  limit: number;
}): Promise<AttendanceDashboardRecordsResult> {
  assertValidDateKey(input.dateKey);

  const attendance = await Attendance.findOne({
    tenantId: input.tenantId,
    dateKey: input.dateKey,
    class: input.class,
    section: input.section,
  })
    .select({
      dateKey: 1,
      class: 1,
      section: 1,
      records: 1,
      markedBy: 1,
      updatedAt: 1,
    })
    .lean()
    .exec();

  if (!attendance) {
    return {
      attendance: null,
      items: [],
      total: 0,
      page: input.page,
      limit: input.limit,
    };
  }

  const records = input.status
    ? attendance.records.filter((r) => r.status === input.status)
    : attendance.records;

  const ids = records.map((r) => new mongoose.Types.ObjectId(r.studentId));
  const students = await Student.find({
    tenantId: input.tenantId,
    _id: { $in: ids },
  })
    .select({ studentName: 1, scholarId: 1 })
    .lean()
    .exec();

  const studentsById = new Map(
    students.map((s) => [
      s._id.toString(),
      { studentName: s.studentName, scholarId: s.scholarId ?? undefined },
    ]),
  );

  const joined = records
    .map((r) => {
      const st = studentsById.get(r.studentId);
      return {
        studentId: r.studentId,
        studentName: st?.studentName ?? "Unknown student",
        scholarId: st?.scholarId,
        status: r.status,
        remark: r.remark,
      };
    })
    .sort((a, b) =>
      a.studentName.localeCompare(b.studentName, undefined, {
        sensitivity: "base",
      }),
    );

  const total = joined.length;
  const start = (input.page - 1) * input.limit;
  const items = joined.slice(start, start + input.limit);

  return {
    attendance: {
      id: attendance._id.toString(),
      dateKey: attendance.dateKey,
      class: attendance.class,
      section: attendance.section,
      markedBy: attendance.markedBy,
      updatedAt: attendance.updatedAt,
    },
    items,
    total,
    page: input.page,
    limit: input.limit,
  };
}

export type MarkAttendanceInput = {
  dateKey: string;
  class: StudentClass;
  section: StudentSection;
  records: AttendanceRecord[];
  markedByUserId: string;
};

export function assertValidDateKey(dateKey: string): void {
  if (!DATE_KEY_RE.test(dateKey)) {
    throw new Error("date must be YYYY-MM-DD");
  }
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== m - 1 ||
    dt.getUTCDate() !== d
  ) {
    throw new Error("Invalid date");
  }
}

export async function markAttendance(
  tenantId: string,
  input: MarkAttendanceInput,
): Promise<ReturnType<typeof serializeAttendance>> {
  assertValidDateKey(input.dateKey);

  if (!input.records.length) {
    throw new Error("records must include at least one student");
  }

  const studentIds = [...new Set(input.records.map((r) => r.studentId))];
  if (studentIds.length !== input.records.length) {
    throw new Error("Duplicate studentId in records");
  }

  for (const r of input.records) {
    if (!mongoose.isValidObjectId(r.studentId)) {
      throw new Error(`Invalid student id: ${r.studentId}`);
    }
  }

  const students = await Student.find({
    tenantId,
    _id: { $in: studentIds.map((id) => new mongoose.Types.ObjectId(id)) },
  }).exec();

  if (students.length !== studentIds.length) {
    throw new Error("One or more students not found for this school");
  }

  for (const s of students) {
    if (s.class !== input.class || s.section !== input.section) {
      throw new Error(
        `Student ${s.studentName} does not belong to ${input.class} section ${input.section}`,
      );
    }
    if (s.status !== "ACTIVE") {
      throw new Error(
        `Student ${s.studentName} is not ACTIVE — remove from attendance or reactivate`,
      );
    }
  }

  const doc = await Attendance.findOneAndUpdate(
    { tenantId, class: input.class, section: input.section, dateKey: input.dateKey },
    {
      $set: {
        records: input.records,
        markedBy: input.markedByUserId,
      },
      $setOnInsert: {
        tenantId,
        dateKey: input.dateKey,
        class: input.class,
        section: input.section,
      },
    },
    { new: true, upsert: true, runValidators: true },
  ).exec();

  if (!doc) {
    throw new Error("Failed to save attendance");
  }

  const jobs: AttendanceSmsJob[] = [];
  const absent = input.records.filter((r) => r.status === "ABSENT");

  for (const r of absent) {
    const student = students.find((s) => s._id.toString() === r.studentId);
    if (!student) continue;
    const phone = student.parentPhoneNumber?.trim();
    if (!phone) {
      continue;
    }

    const message = `Attendance: ${student.studentName} (${input.class}-${input.section}) is marked ABSENT on ${input.dateKey}. — School`;

    try {
      const n = await AttendanceAbsenceNotification.create({
        tenantId,
        studentId: r.studentId,
        dateKey: input.dateKey,
        attendanceId: doc._id.toString(),
        jobStatus: "queued",
        queuedAt: new Date(),
      });
      jobs.push({
        notificationId: n._id.toString(),
        phone,
        message,
      });
    } catch (err) {
      if (isDuplicateKeyError(err)) {
        continue;
      }
      throw err;
    }
  }

  enqueueAttendanceSmsJobs(jobs);

  return serializeAttendance(doc);
}

export async function getAttendance(input: {
  tenantId: string;
  class: StudentClass;
  section: StudentSection;
  dateKey: string;
}): Promise<ReturnType<typeof serializeAttendance> | null> {
  assertValidDateKey(input.dateKey);
  const doc = await Attendance.findOne({
    tenantId: input.tenantId,
    class: input.class,
    section: input.section,
    dateKey: input.dateKey,
  }).exec();
  return doc ? serializeAttendance(doc) : null;
}
