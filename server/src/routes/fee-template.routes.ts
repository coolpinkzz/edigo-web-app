import { Router } from "express";
import * as feeTemplateController from "../modules/fee-template/fee-template.controller";
import {
  assignFeeTemplateSchema,
  createFeeTemplateSchema,
  listFeeTemplatesSchema,
  templateIdParamsOnlySchema,
  updateFeeTemplateSchema,
} from "../modules/fee-template/fee-template.validation";
import { authenticate } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import { requireRole } from "../middleware/rbac.middleware";
import { ROLES } from "../types/roles";

const router = Router();

router.use(authenticate);

/**
 * @openapi
 * /fee-templates:
 *   post:
 *     tags: [FeeTemplates]
 *     summary: Create a fee template
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/FeeTemplateCreate'
 *     responses:
 *       201:
 *         description: Template created
 *       400:
 *         description: Validation error
 *   get:
 *     tags: [FeeTemplates]
 *     summary: List fee templates
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
 *         name: feeType
 *         schema:
 *           type: string
 *           enum: [TUITION, TRANSPORT, HOSTEL, OTHER]
 *     responses:
 *       200:
 *         description: Paginated templates
 */
router.post(
  "/",
  requireRole(ROLES.STAFF),
  validate(createFeeTemplateSchema),
  (req, res) => {
    void feeTemplateController.create(req, res);
  },
);

router.get(
  "/",
  requireRole(ROLES.VIEWER),
  validate(listFeeTemplatesSchema),
  (req, res) => {
    void feeTemplateController.list(req, res);
  },
);

/**
 * @openapi
 * /fee-templates/{id}/assign:
 *   post:
 *     tags: [FeeTemplates]
 *     summary: Assign template to students (bulk)
 *     description: |
 *       Creates one Fee per student (and Installments when template.isInstallment) via insertMany.
 *       Send either studentIds or a class filter (optional section). Skips students who already
 *       have this template assigned. Template edits do not affect existing fees.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/FeeTemplateAssign'
 *     responses:
 *       200:
 *         description: Assignment counts (assignedCount, skippedDuplicateCount)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FeeTemplateAssignResult'
 *       404:
 *         description: Template not found
 */
router.post(
  "/:id/assign",
  requireRole(ROLES.STAFF),
  validate(assignFeeTemplateSchema),
  (req, res) => {
    void feeTemplateController.assign(req, res);
  },
);

/**
 * @openapi
 * /fee-templates/{templateId}:
 *   get:
 *     tags: [FeeTemplates]
 *     summary: Get fee template by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: templateId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Template
 *       404:
 *         description: Not found
 *   patch:
 *     tags: [FeeTemplates]
 *     summary: Update fee template
 *     description: Full replacement of template fields (same body as create). Does not change existing fees created from this template.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: templateId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/FeeTemplateCreate'
 *     responses:
 *       200:
 *         description: Updated template
 *       400:
 *         description: Validation error
 *       404:
 *         description: Not found
 *   delete:
 *     tags: [FeeTemplates]
 *     summary: Delete fee template
 *     description: Fails if any fee records were created from this template (TEMPLATE source).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: templateId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204:
 *         description: Deleted
 *       400:
 *         description: Cannot delete (fees reference template) or other error
 *       404:
 *         description: Not found
 */
router.get(
  "/:templateId",
  requireRole(ROLES.VIEWER),
  validate(templateIdParamsOnlySchema),
  (req, res) => {
    void feeTemplateController.getById(req, res);
  },
);

router.patch(
  "/:templateId",
  requireRole(ROLES.STAFF),
  validate(updateFeeTemplateSchema),
  (req, res) => {
    void feeTemplateController.update(req, res);
  },
);

router.delete(
  "/:templateId",
  requireRole(ROLES.STAFF),
  validate(templateIdParamsOnlySchema),
  (req, res) => {
    void feeTemplateController.remove(req, res);
  },
);

export default router;
