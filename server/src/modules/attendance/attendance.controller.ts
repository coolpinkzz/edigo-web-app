import { Request, Response } from "express";
import * as attendanceService from "./attendance.service";
import type {
  AttendanceDashboardRecordsQuery,
  AttendanceDashboardSummaryQuery,
  AttendanceDashboardTrendQuery,
  GetAttendanceQuery,
  MarkAttendanceBody,
} from "./attendance.validation";

/**
 * POST /attendance/mark
 */
export async function mark(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body as MarkAttendanceBody;
    const tenantId = req.user!.tenantId;
    const markedByUserId = req.user!.userId;

    const saved = await attendanceService.markAttendance(tenantId, {
      dateKey: body.dateKey,
      class: body.class,
      section: body.section,
      records: body.records,
      markedByUserId,
    });

    res.status(200).json({ attendance: saved });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to save attendance";
    res.status(400).json({ error: message });
  }
}

/**
 * GET /attendance
 */
export async function get(req: Request, res: Response): Promise<void> {
  try {
    const q = req.query as unknown as GetAttendanceQuery;
    const tenantId = req.user!.tenantId;

    const attendance = await attendanceService.getAttendance({
      tenantId,
      class: q.class,
      section: q.section,
      dateKey: q.dateKey,
    });

    res.json({ attendance });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to load attendance";
    res.status(400).json({ error: message });
  }
}

/**
 * GET /attendance/dashboard/summary
 */
export async function dashboardSummary(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const q = req.query as unknown as AttendanceDashboardSummaryQuery;
    const tenantId = req.user!.tenantId;
    const data = await attendanceService.getAttendanceDashboardSummary({
      tenantId,
      from: q.from,
      to: q.to,
      class: q.class,
      section: q.section,
    });
    res.json(data);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to load attendance summary";
    res.status(400).json({ error: message });
  }
}

/**
 * GET /attendance/dashboard/trend
 */
export async function dashboardTrend(req: Request, res: Response): Promise<void> {
  try {
    const q = req.query as unknown as AttendanceDashboardTrendQuery;
    const tenantId = req.user!.tenantId;
    const data = await attendanceService.getAttendanceDashboardTrend({
      tenantId,
      from: q.from,
      to: q.to,
      class: q.class,
      section: q.section,
      granularity: q.granularity,
    });
    res.json(data);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to load attendance trend";
    res.status(400).json({ error: message });
  }
}

/**
 * GET /attendance/dashboard/records
 */
export async function dashboardRecords(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const q = req.query as unknown as AttendanceDashboardRecordsQuery;
    const tenantId = req.user!.tenantId;
    const data = await attendanceService.getAttendanceDashboardRecords({
      tenantId,
      dateKey: q.dateKey,
      class: q.class,
      section: q.section,
      status: q.status,
      page: q.page,
      limit: q.limit,
    });
    res.json(data);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to load attendance records";
    res.status(400).json({ error: message });
  }
}
