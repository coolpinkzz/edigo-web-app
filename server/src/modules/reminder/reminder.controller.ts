import { Request, Response } from "express";
import { logger } from "../../utils/logger";
import { ROLES } from "../../types/roles";
import {
  runInstallmentReminders,
  sendFeeReminderForTenant,
  sendInstallmentReminderForTenant,
} from "./reminder.service";

const SCOPE = "reminder.controller";

/**
 * POST /reminders/run — staff+; scopes to the user’s tenant unless SUPER_ADMIN (all tenants).
 */
export async function runReminders(req: Request, res: Response): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ ok: false, message: "Authentication required" });
      return;
    }

    const scopeAllTenants = user.role === ROLES.SUPER_ADMIN;
    const summary = await runInstallmentReminders(
      scopeAllTenants ? undefined : { tenantId: user.tenantId },
    );

    logger.info(SCOPE, "staff run reminders", {
      userId: user.userId,
      tenantId: user.tenantId,
      role: user.role,
      scope: scopeAllTenants ? "all_tenants" : "single_tenant",
      runId: summary.runId,
      smsSent: summary.smsSent,
    });

    res.json({ ok: true, summary });
  } catch (err: unknown) {
    logger.error(SCOPE, "staff run reminders failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    res.status(500).json({
      ok: false,
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * POST /reminders/installment/:installmentId — staff+; one SMS for this installment (tenant-scoped).
 */
export async function sendInstallmentReminder(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ ok: false, message: "Authentication required" });
      return;
    }

    const { installmentId } = req.params as { installmentId: string };
    const result = await sendInstallmentReminderForTenant(
      { tenantId: user.tenantId, role: user.role },
      installmentId,
    );

    if (result.ok) {
      res.json({ ok: true, message: result.message });
      return;
    }

    res.status(result.status).json({
      ok: false,
      message: result.message,
      ...(result.code ? { code: result.code } : {}),
    });
  } catch (err: unknown) {
    logger.error(SCOPE, "send installment reminder failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    res.status(500).json({
      ok: false,
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * POST /reminders/fee/:feeId — staff+; one SMS for a lump-sum (non-installment) fee.
 */
export async function sendFeeReminder(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ ok: false, message: "Authentication required" });
      return;
    }

    const { feeId } = req.params as { feeId: string };
    const result = await sendFeeReminderForTenant(
      { tenantId: user.tenantId, role: user.role },
      feeId,
    );

    if (result.ok) {
      res.json({ ok: true, message: result.message });
      return;
    }

    res.status(result.status).json({
      ok: false,
      message: result.message,
      ...(result.code ? { code: result.code } : {}),
    });
  } catch (err: unknown) {
    logger.error(SCOPE, "send fee reminder failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    res.status(500).json({
      ok: false,
      message: err instanceof Error ? err.message : String(err),
    });
  }
}
