import { Router } from "express";
import * as feeController from "../modules/fee/fee.controller";
import {
  addInstallmentsSchema,
  assignTemplateToStudentsSchema,
  createFeeSchema,
  listFeesSchema,
  listOverdueFeesSchema,
  feeIdParamsOnlySchema,
  recalculateFeeSchema,
  updateFeeSchema,
  updateInstallmentSchema,
} from "../modules/fee/fee.validation";
import { authenticate } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import { requireRole } from "../middleware/rbac.middleware";
import { ROLES } from "../types/roles";

const router = Router();

router.use(authenticate);

router.post(
  "/assign",
  requireRole(ROLES.STAFF),
  validate(assignTemplateToStudentsSchema),
  (req, res) => {
    void feeController.assignTemplate(req, res);
  },
);

/**
 * @openapi
 * /fees:
 *   post:
 *     tags: [Fees]
 *     summary: Create a fee
 *     description: |
 *       `source`: **CUSTOM** (manual fields) or **TEMPLATE** (`templateId` + optional `feeOverrides`; data copied from template, then independent).
 *       Optional `Idempotency-Key` header (1–128 chars: letters, digits, `_`, `-`).
 *       Same key + same body returns **200** with the existing fee; same key + different body returns **409**.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: Idempotency-Key
 *         required: false
 *         schema:
 *           type: string
 *         description: Client-generated key to safely retry creates without duplicating fees
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/FeeCreate'
 *     responses:
 *       200:
 *         description: Existing fee (idempotent replay; same key and body as a prior successful create)
 *       201:
 *         description: Fee created
 *       400:
 *         description: Validation or business rule error
 *       409:
 *         description: Idempotency key reused with a different request body
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 *   get:
 *     tags: [Fees]
 *     summary: List fees
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 10 }
 *       - in: query
 *         name: studentId
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, PARTIAL, PAID, OVERDUE]
 *       - in: query
 *         name: feeType
 *         schema:
 *           type: string
 *           enum: [TUITION, TRANSPORT, HOSTEL, OTHER]
 *     responses:
 *       200:
 *         description: Paginated fees
 */
router.post(
  "/",
  requireRole(ROLES.STAFF),
  validate(createFeeSchema),
  (req, res) => {
    void feeController.create(req, res);
  },
);

router.get(
  "/",
  requireRole(ROLES.VIEWER),
  validate(listFeesSchema),
  (req, res) => {
    void feeController.list(req, res);
  },
);

/**
 * @openapi
 * /fees/overdue:
 *   get:
 *     tags: [Fees]
 *     summary: List overdue fees (installments and lump-sum)
 *     description: |
 *       Installment rows with due date before today (IST) and a balance; plus lump-sum fees
 *       with `endDate` before today IST, unpaid (`paidAmount` 0), and `pendingAmount` > 0.
 *       Lump-sum rows have empty `installmentId`.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
 *       - in: query
 *         name: feeType
 *         schema:
 *           type: string
 *           enum: [TUITION, TRANSPORT, HOSTEL, OTHER]
 *       - in: query
 *         name: class
 *         schema: { type: string }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Paginated overdue rows and summary totals
 */
router.get(
  "/overdue",
  requireRole(ROLES.VIEWER),
  validate(listOverdueFeesSchema),
  (req, res) => {
    void feeController.listOverdue(req, res);
  },
);

/**
 * @openapi
 * /fees/{feeId}/recalculate:
 *   post:
 *     tags: [Fees]
 *     summary: Recalculate fee status and amounts
 *     description: Syncs paid/pending/status from installments or non-installment paidAmount.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: feeId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Updated fee
 *       404:
 *         description: Not found
 */
router.post(
  "/:feeId/recalculate",
  requireRole(ROLES.STAFF),
  validate(recalculateFeeSchema),
  (req, res) => {
    void feeController.recalculateStatus(req, res);
  },
);

/**
 * @openapi
 * /fees/{feeId}/installments:
 *   post:
 *     tags: [Fees]
 *     summary: Add installments to a fee
 *     description: Sum of installment amounts must equal fee totalAmount. Sets isInstallment to true.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: feeId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AddInstallmentsBody'
 *     responses:
 *       201:
 *         description: Fee with installments
 *       400:
 *         description: Validation error
 */
router.post(
  "/:feeId/installments",
  requireRole(ROLES.STAFF),
  validate(addInstallmentsSchema),
  (req, res) => {
    void feeController.addInstallments(req, res);
  },
);

/**
 * @openapi
 * /fees/{feeId}/installments/{installmentId}:
 *   patch:
 *     tags: [Fees]
 *     summary: Update an installment
 *     description: Adjust amounts or due date; fee aggregates are synced (no payment gateway).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: feeId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: installmentId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Updated fee and installment
 *       404:
 *         description: Not found
 */
router.patch(
  "/:feeId/installments/:installmentId",
  requireRole(ROLES.STAFF),
  validate(updateInstallmentSchema),
  (req, res) => {
    void feeController.updateInstallment(req, res);
  },
);

/**
 * @openapi
 * /fees/{feeId}:
 *   get:
 *     tags: [Fees]
 *     summary: Get fee with installments
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: feeId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Fee and installments
 *       404:
 *         description: Not found
 *   patch:
 *     tags: [Fees]
 *     summary: Update fee
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: feeId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/FeeUpdate'
 *     responses:
 *       200:
 *         description: Updated fee
 *       404:
 *         description: Not found
 */
router.get(
  "/:feeId",
  requireRole(ROLES.VIEWER),
  validate(feeIdParamsOnlySchema),
  (req, res) => {
    void feeController.getById(req, res);
  },
);

router.patch(
  "/:feeId",
  requireRole(ROLES.STAFF),
  validate(updateFeeSchema),
  (req, res) => {
    void feeController.update(req, res);
  },
);

export default router;
