import { PipelineStage } from "mongoose";
import {
  FeeStatus,
  FeeType,
  FEE_STATUSES,
  FEE_TYPES,
  IFee,
} from "../fee/fee.model";
import { serializeFee } from "../fee/fee.service";
import { IStudent, Student } from "./student.model";
import { StudentClass, StudentSection, StudentStatus } from "./student.model";
import {
  applyTenantResponseShape,
  attachCourseSummaries,
  getTenantType,
  serializeStudent,
  StudentPublic,
} from "./student.service";

const PRIORITY: Record<FeeStatus, number> = {
  OVERDUE: 4,
  PARTIAL: 3,
  PENDING: 2,
  PAID: 1,
};

function rollupFeeStatus(fees: { status: FeeStatus }[]): FeeStatus | null {
  if (fees.length === 0) return null;
  let best: FeeStatus = "PAID";
  for (const f of fees) {
    if (PRIORITY[f.status] > PRIORITY[best]) best = f.status;
  }
  return best;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function countsByStatus(fees: { status: FeeStatus }[]): Record<FeeStatus, number> {
  const init: Record<FeeStatus, number> = {
    PENDING: 0,
    PARTIAL: 0,
    PAID: 0,
    OVERDUE: 0,
  };
  for (const f of fees) {
    init[f.status] += 1;
  }
  return init;
}

export type StudentFeeOverviewSortBy =
  | "studentName"
  | "class"
  | "pendingTotal"
  | "createdAt";

export interface StudentFeeOverviewParams {
  page: number;
  limit: number;
  /** Enrollment status (student.status) */
  studentStatus?: StudentStatus;
  class?: StudentClass;
  section?: StudentSection;
  search?: string;
  /** If set, only students with at least one fee matching all given dimensions (same fee row). */
  feeStatuses?: FeeStatus[];
  feeTypes?: FeeType[];
  sortBy: StudentFeeOverviewSortBy;
  sortDir: "asc" | "desc";
}

export interface StudentFeeOverviewRow {
  student: StudentPublic;
  fees: ReturnType<typeof serializeFee>[];
  feeSummary: {
    feeCount: number;
    pendingTotal: number;
    paidTotal: number;
    totalDue: number;
    rollupStatus: FeeStatus | null;
    countsByStatus: Record<FeeStatus, number>;
  };
}

export interface PaginatedStudentFeeOverview {
  data: StudentFeeOverviewRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

function feeFilterExpression(
  feeStatuses: FeeStatus[] | undefined,
  feeTypes: FeeType[] | undefined,
): Record<string, unknown> | null {
  const parts: Record<string, unknown>[] = [];
  if (feeStatuses?.length) {
    parts.push({ $in: ["$$f.status", feeStatuses] });
  }
  if (feeTypes?.length) {
    parts.push({ $in: ["$$f.feeType", feeTypes] });
  }
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0]!;
  return { $and: parts };
}

function leanFeeToSerialized(f: IFee | Record<string, unknown>) {
  return serializeFee(f as IFee);
}

/**
 * Paginated student-centric fee overview for the command center: each row is one student
 * with all their fees and aggregate totals. Optional fee status/type filters keep only
 * students who have at least one fee matching those constraints (same fee row).
 */
export async function listStudentFeeOverview(
  tenantId: string,
  params: StudentFeeOverviewParams,
): Promise<PaginatedStudentFeeOverview> {
  const skip = (params.page - 1) * params.limit;

  const studentMatch: Record<string, unknown> = { tenantId };
  if (params.studentStatus !== undefined) {
    studentMatch.status = params.studentStatus;
  }
  if (params.class !== undefined) {
    studentMatch.class = params.class;
  }
  if (params.section !== undefined) {
    studentMatch.section = params.section;
  }
  const q = params.search?.trim();
  if (q) {
    const rx = new RegExp(escapeRegex(q), "i");
    studentMatch.$or = [
      { studentName: rx },
      { admissionId: rx },
      { scholarId: rx },
    ];
  }

  const filterExpr = feeFilterExpression(params.feeStatuses, params.feeTypes);

  const pipeline: PipelineStage[] = [
    { $match: studentMatch },
    {
      $lookup: {
        from: "fees",
        let: { sid: { $toString: "$_id" } },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$tenantId", tenantId] },
                  { $eq: ["$studentId", "$$sid"] },
                ],
              },
            },
          },
        ],
        as: "fees",
      },
    },
  ];

  if (filterExpr !== null) {
    pipeline.push({
      $match: {
        $expr: {
          $gt: [
            {
              $size: {
                $filter: {
                  input: "$fees",
                  as: "f",
                  cond: filterExpr,
                },
              },
            },
            0,
          ],
        },
      },
    });
  }

  pipeline.push({
    $addFields: {
      pendingTotal: { $sum: "$fees.pendingAmount" },
      paidTotal: { $sum: "$fees.paidAmount" },
      totalDue: { $sum: "$fees.totalAmount" },
    },
  });

  const sortDir = params.sortDir === "desc" ? -1 : 1;
  const sortField =
    params.sortBy === "pendingTotal"
      ? "pendingTotal"
      : params.sortBy === "class"
        ? "class"
        : params.sortBy === "createdAt"
          ? "createdAt"
          : "studentName";

  const sortSpec: Record<string, 1 | -1> = { [sortField]: sortDir };
  if (sortField !== "studentName") {
    sortSpec.studentName = 1;
  }

  pipeline.push({
    $facet: {
      count: [{ $count: "total" }],
      rows: [
        { $sort: sortSpec },
        { $skip: skip },
        { $limit: params.limit },
      ],
    },
  });

  const agg = await Student.aggregate(pipeline).exec();
  const facet = agg[0] as
    | { count: { total: number }[]; rows: unknown[] }
    | undefined;

  const total = facet?.count?.[0]?.total ?? 0;
  const totalPages = total === 0 ? 0 : Math.ceil(total / params.limit);
  const rawRows = (facet?.rows ?? []) as Array<
    IStudent & {
      fees: IFee[];
      pendingTotal: number;
      paidTotal: number;
      totalDue: number;
    }
  >;

  const tenantType = await getTenantType(tenantId);

  const data: StudentFeeOverviewRow[] = rawRows.map((doc) => {
    const fees = (doc.fees ?? []).map(leanFeeToSerialized);
    const feeDocs = doc.fees ?? [];
    const rollupStatus = rollupFeeStatus(feeDocs);
    return {
      student: applyTenantResponseShape(
        tenantType,
        serializeStudent(doc as unknown as IStudent),
      ),
      fees,
      feeSummary: {
        feeCount: feeDocs.length,
        pendingTotal: doc.pendingTotal ?? 0,
        paidTotal: doc.paidTotal ?? 0,
        totalDue: doc.totalDue ?? 0,
        rollupStatus,
        countsByStatus: countsByStatus(feeDocs),
      },
    };
  });

  const students = data.map((row) => row.student);
  const enrichedStudents = await attachCourseSummaries(
    tenantId,
    tenantType,
    students,
  );
  const dataWithCourses = data.map((row, i) => ({
    ...row,
    student: enrichedStudents[i]!,
  }));

  return {
    data: dataWithCourses,
    total,
    page: params.page,
    limit: params.limit,
    totalPages,
  };
}

/**
 * Comma-separated query (e.g. `PENDING,OVERDUE`).
 * Returns undefined if empty, null if any token is invalid.
 */
export function parseFeeStatusList(
  raw: string | undefined,
): FeeStatus[] | undefined | null {
  if (raw === undefined || raw.trim() === "") return undefined;
  const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
  const out: FeeStatus[] = [];
  for (const p of parts) {
    if (!FEE_STATUSES.includes(p as FeeStatus)) return null;
    out.push(p as FeeStatus);
  }
  return out.length ? out : undefined;
}

export function parseFeeTypeList(
  raw: string | undefined,
): FeeType[] | undefined | null {
  if (raw === undefined || raw.trim() === "") return undefined;
  const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
  const out: FeeType[] = [];
  for (const p of parts) {
    if (!FEE_TYPES.includes(p as FeeType)) return null;
    out.push(p as FeeType);
  }
  return out.length ? out : undefined;
}
