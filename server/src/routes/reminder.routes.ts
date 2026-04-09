import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import { requireRole } from "../middleware/rbac.middleware";
import { ROLES } from "../types/roles";
import * as reminderController from "../modules/reminder/reminder.controller";
import {
  feeReminderParamsSchema,
  installmentReminderParamsSchema,
} from "../modules/reminder/reminder.validation";

const router = Router();

router.use(authenticate);

/**
 * Staff (and above): trigger the same SMS reminder job as the daily cron
 * (installments + lump-sum), scoped to the signed-in tenant (except SUPER_ADMIN,
 * which processes all tenants).
 */
router.post("/run", requireRole(ROLES.STAFF), (req, res) => {
  void reminderController.runReminders(req, res);
});

/** Staff+: send SMS reminder for one installment (same rules as bulk run; tenant-scoped). */
router.post(
  "/installment/:installmentId",
  requireRole(ROLES.STAFF),
  validate(installmentReminderParamsSchema),
  (req, res) => {
    void reminderController.sendInstallmentReminder(req, res);
  },
);

/** Staff+: send SMS reminder for one lump-sum fee (same rules as bulk run; tenant-scoped). */
router.post(
  "/fee/:feeId",
  requireRole(ROLES.STAFF),
  validate(feeReminderParamsSchema),
  (req, res) => {
    void reminderController.sendFeeReminder(req, res);
  },
);

export default router;
