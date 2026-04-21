import { Router } from "express";
import * as paymentController from "../modules/payment/payment.controller";
import { createOrderBodySchema } from "../modules/payment/payment.validation";
import { authenticate } from "../middleware/auth.middleware";
import { paymentWebhookRateLimit } from "../middleware/rate-limit.middleware";
import { validate } from "../middleware/validate.middleware";
import { requireRole } from "../middleware/rbac.middleware";
import { ROLES } from "../types/roles";

const router = Router();

/**
 * Webhook: no auth; signature verification only. Must run after express.json with `verify` (rawBody).
 */
router.post("/webhook", paymentWebhookRateLimit, (req, res) => {
  void paymentController.webhook(req, res);
});

router.use(authenticate);

/**
 * @openapi
 * /payments/create-order:
 *   post:
 *     tags: [Payments]
 *     summary: Create Razorpay order and persist payment (INITIATED)
 *     description: |
 *       Validates fee/installment, prevents overpayment, creates Razorpay order, saves Payment.
 *       If the tenant has completed Razorpay Route (linked account + route product on file), the order includes a Route `transfer` for the full amount to that linked account.
 *       Requires `Idempotency-Key` header (1–128 chars). Success is confirmed only via webhook, not the client.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: Idempotency-Key
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [studentId, feeId]
 *             properties:
 *               studentId: { type: string }
 *               feeId: { type: string }
 *               installmentId: { type: string }
 *               amount: { type: integer, description: Amount in paise (omit = remaining balance) }
 *               currency: { type: string, default: INR }
 *     responses:
 *       201:
 *         description: Order created
 *       200:
 *         description: Idempotent replay
 *       400:
 *         description: Validation or business rule error
 *       409:
 *         description: Idempotency conflict
 *       503:
 *         description: Razorpay or persistence error
 */
router.post(
  "/create-order",
  requireRole(ROLES.STAFF),
  validate({ body: createOrderBodySchema }),
  (req, res) => {
    void paymentController.createOrder(req, res);
  },
);

export default router;
