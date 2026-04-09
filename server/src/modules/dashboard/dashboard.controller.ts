import { Request, Response } from "express";
import {
  getClassPerformance,
  getDashboardOverview,
  getRevenueTrend,
} from "./dashboard.service";
import { getTenantSettlementDashboard } from "../settlement/settlement.service";

/**
 * GET /dashboard/overview
 */
export async function overview(req: Request, res: Response): Promise<void> {
  const tenantId = req.user!.tenantId;
  const { from, to, compare } = req.query as unknown as {
    from: Date;
    to: Date;
    compare: boolean;
  };

  const data = await getDashboardOverview({
    tenantId,
    from,
    to,
    compare,
  });
  res.json(data);
}

/**
 * GET /dashboard/revenue-trend
 */
export async function revenueTrend(req: Request, res: Response): Promise<void> {
  const tenantId = req.user!.tenantId;
  const { from, to, granularity } = req.query as unknown as {
    from: Date;
    to: Date;
    granularity: "daily" | "weekly" | "monthly";
  };
  const data = await getRevenueTrend({
    tenantId,
    from,
    to,
    granularity,
  });
  res.json(data);
}

/**
 * GET /dashboard/class-performance
 */
export async function classPerformance(
  req: Request,
  res: Response,
): Promise<void> {
  const tenantId = req.user!.tenantId;
  const data = await getClassPerformance(tenantId);
  res.json(data);
}

/**
 * GET /dashboard/settlements
 */
export async function settlements(req: Request, res: Response): Promise<void> {
  const tenantId = req.user!.tenantId;
  const { page, limit } = req.query as unknown as {
    page: number;
    limit: number;
  };
  const data = await getTenantSettlementDashboard({
    tenantId,
    page,
    limit,
  });
  res.json(data);
}
