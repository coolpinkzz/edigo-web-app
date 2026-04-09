import type { StudentClass, StudentSection } from "./student.types";

export interface AttendanceDashboardFiltersDto {
  from: string;
  to: string;
  class?: StudentClass;
  section?: StudentSection;
}

export interface AttendanceDashboardSummaryDto {
  filters: AttendanceDashboardFiltersDto;
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

export interface AttendanceDashboardTrendPointDto {
  dateKey: string;
  label: string;
  presentCount: number;
  absentCount: number;
  studentsMarked: number;
  attendancePercent: number;
}

export interface AttendanceDashboardTrendDto {
  granularity: "daily" | "weekly" | "monthly";
  filters: AttendanceDashboardFiltersDto;
  points: AttendanceDashboardTrendPointDto[];
}
