import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import { requireRole } from "../middleware/rbac.middleware";
import { ROLES } from "../types/roles";
import {
  dashboardOverviewQuerySchema,
  dashboardSettlementsQuerySchema,
  revenueTrendQuerySchema,
} from "../modules/dashboard/dashboard.validation";
import * as dashboardController from "../modules/dashboard/dashboard.controller";

const router = Router();

router.use(authenticate);

/**
 * @openapi
 * /dashboard/overview:
 *   get:
 *     tags: [Dashboard]
 *     summary: Overview KPIs for the tenant
 *     description: |
 *       Collected = successful Razorpay payments (`Payment.status` SUCCESS, `updatedAt` in range) plus manual
 *       staff-recorded credits (`ManualPaymentCredit` by `recordedAt`). Amounts are INR (rupees).
 *       Pending = sum of `fee.pendingAmount` (current outstanding, not filtered by date).
 *       When `compare=true`, the previous window of equal duration ending at `from` is used for collected trend.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: from
 *         required: true
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: to
 *         required: true
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: compare
 *         schema: { type: boolean, default: false }
 *     responses:
 *       200:
 *         description: Overview metrics
 */
router.get(
  "/overview",
  requireRole(ROLES.VIEWER),
  validate({ query: dashboardOverviewQuerySchema }),
  (req, res) => {
    void dashboardController.overview(req, res);
  },
);

/**
 * @openapi
 * /dashboard/revenue-trend:
 *   get:
 *     tags: [Dashboard]
 *     summary: Collected vs scheduled dues over time
 *     description: |
 *       `collected` = successful Razorpay payments plus manual credits per bucket.
 *       `due` = sum of installment amounts whose dueDate falls in the bucket (tenant fees only).
 *       Buckets use UTC (`$dateTrunc`). Range is limited to 2 years.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: from
 *         required: true
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: to
 *         required: true
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: granularity
 *         required: true
 *         schema: { type: string, enum: [daily, weekly, monthly] }
 *     responses:
 *       200:
 *         description: Time series for charts
 */
router.get(
  "/revenue-trend",
  requireRole(ROLES.VIEWER),
  validate({ query: revenueTrendQuerySchema }),
  (req, res) => {
    void dashboardController.revenueTrend(req, res);
  },
);

/**
 * @openapi
 * /dashboard/class-performance:
 *   get:
 *     tags: [Dashboard]
 *     summary: Collection rate by student class
 *     description: |
 *       Aggregates all fees per class (via student); `percentCollected` = paidAmount / totalAmount × 100.
 *       Classes with no fee volume are omitted.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Rows per class
 */
router.get("/class-performance", requireRole(ROLES.VIEWER), (req, res) => {
  void dashboardController.classPerformance(req, res);
});

/**
 * @openapi
 * /dashboard/settlements:
 *   get:
 *     tags: [Dashboard]
 *     summary: Razorpay settlement reconciliation
 *     description: |
 *       Summary uses gateway payments for the tenant: total collected (all successful),
 *       total settled (successful payments linked to a Razorpay settlement id),
 *       in-transit (successful payments not yet linked). Settlement rows are batches
 *       referenced by tenant payments (synced from Razorpay on a schedule).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
 *     responses:
 *       200:
 *         description: Summary and paginated settlements
 */
router.get(
  "/settlements",
  requireRole(ROLES.VIEWER),
  validate({ query: dashboardSettlementsQuerySchema }),
  (req, res) => {
    void dashboardController.settlements(req, res);
  },
);

export default router;
