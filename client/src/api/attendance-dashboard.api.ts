import type {
  AttendanceDashboardSummaryDto,
  AttendanceDashboardTrendDto,
  StudentClass,
  StudentSection,
} from "../types";
import { apiClient } from "./client";

export interface AttendanceDashboardSummaryParams {
  from: string;
  to: string;
  class?: StudentClass;
  section?: StudentSection;
}

export async function getAttendanceDashboardSummary(
  params: AttendanceDashboardSummaryParams,
): Promise<AttendanceDashboardSummaryDto> {
  const { data } = await apiClient.get<AttendanceDashboardSummaryDto>(
    "/attendance/dashboard/summary",
    { params },
  );
  return data;
}

export interface AttendanceDashboardTrendParams
  extends AttendanceDashboardSummaryParams {
  granularity: "daily" | "weekly" | "monthly";
}

export async function getAttendanceDashboardTrend(
  params: AttendanceDashboardTrendParams,
): Promise<AttendanceDashboardTrendDto> {
  const { data } = await apiClient.get<AttendanceDashboardTrendDto>(
    "/attendance/dashboard/trend",
    { params },
  );
  return data;
}
