import type {
  ClassPerformanceDto,
  DashboardOverviewDto,
  DashboardSettlementsDto,
  DashboardTrendGranularity,
  RevenueTrendDto,
} from "../types";
import { apiClient } from "./client";

export interface DashboardOverviewParams {
  from: Date;
  to: Date;
  /** When true, server returns previous-period collected + changePercent. */
  compare?: boolean;
}

export async function getDashboardOverview(
  params: DashboardOverviewParams,
): Promise<DashboardOverviewDto> {
  const { data } = await apiClient.get<DashboardOverviewDto>("/dashboard/overview", {
    params: {
      from: params.from.toISOString(),
      to: params.to.toISOString(),
      compare: params.compare ?? false,
    },
  });
  return data;
}

export interface RevenueTrendParams {
  from: Date;
  to: Date;
  granularity: DashboardTrendGranularity;
}

export async function getRevenueTrend(
  params: RevenueTrendParams,
): Promise<RevenueTrendDto> {
  const { data } = await apiClient.get<RevenueTrendDto>(
    "/dashboard/revenue-trend",
    {
      params: {
        from: params.from.toISOString(),
        to: params.to.toISOString(),
        granularity: params.granularity,
      },
    },
  );
  return data;
}

export async function getClassPerformance(): Promise<ClassPerformanceDto> {
  const { data } = await apiClient.get<ClassPerformanceDto>(
    "/dashboard/class-performance",
  );
  return data;
}

export interface DashboardSettlementsParams {
  page?: number
  limit?: number
}

export async function getDashboardSettlements(
  params?: DashboardSettlementsParams,
): Promise<DashboardSettlementsDto> {
  const { data } = await apiClient.get<DashboardSettlementsDto>(
    "/dashboard/settlements",
    {
      params: {
        page: params?.page ?? 1,
        limit: params?.limit ?? 20,
      },
    },
  );
  return data;
}
