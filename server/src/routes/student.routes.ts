import { Router } from "express";
import * as studentController from "../modules/student/student.controller";
import {
  confirmStudentImportSchema,
  createStudentSchema,
  feeOverviewSchema,
  getStudentsSchema,
  studentIdParamsSchema,
  updateStudentSchema,
} from "../modules/student/student.validation";
import { uploadExcelMemory } from "../middleware/upload.middleware";
import { authenticate } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import { requireRole } from "../middleware/rbac.middleware";
import { ROLES } from "../types/roles";

const router = Router();

/** All student routes require authentication; tenant is taken from JWT. */
router.use(authenticate);

router.post(
  "/import/validate",
  requireRole(ROLES.STAFF),
  (req, res, next) => {
    uploadExcelMemory.single("file")(req, res, (err: unknown) => {
      if (err) {
        const message =
          err instanceof Error ? err.message : "Upload failed";
        res.status(400).json({ error: message });
        return;
      }
      next();
    });
  },
  (req, res) => {
    void studentController.importValidate(req, res);
  },
);

router.post(
  "/import/confirm",
  requireRole(ROLES.STAFF),
  validate(confirmStudentImportSchema),
  (req, res) => {
    void studentController.importConfirm(req, res);
  },
);

/**
 * @openapi
 * /students:
 *   post:
 *     tags: [Students]
 *     summary: Create a student
 *     description: |
 *       Creates a student for the current tenant. Requires STAFF or higher.
 *       Optional `feeTemplateId` (plus `assignmentAnchorDate` / `feeOverrides`) instantiates one fee from that template after save; if fee creation fails, the student is not persisted.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/StudentCreate'
 *     responses:
 *       201:
 *         description: Student created (includes feeFromTemplate when a template was assigned)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StudentCreated'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 *   get:
 *     tags: [Students]
 *     summary: List students
 *     description: Paginated list with optional filters by status, class, and search.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ACTIVE, INACTIVE, DROPPED]
 *       - in: query
 *         name: class
 *         schema:
 *           type: string
 *           enum:
 *             - Nursery
 *             - KG
 *             - Prep
 *             - 1st
 *             - 2nd
 *             - 3rd
 *             - 4th
 *             - 5th
 *             - 6th
 *             - 7th
 *             - 8th
 *             - 9th
 *             - 10th
 *             - 11th
 *             - 12th
 *         description: Filter by class (exact match)
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *           maxLength: 200
 *         description: Case-insensitive match on name, admissionId, or scholarId
 *     responses:
 *       200:
 *         description: Paginated students
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StudentListResponse'
 *       400:
 *         description: Invalid query parameters
 *       401:
 *         description: Unauthorized
 */
router.post(
  "/",
  requireRole(ROLES.STAFF),
  validate(createStudentSchema),
  (req, res) => {
    void studentController.create(req, res);
  },
);

/** Backward/alternate alias for create payload variants. */
router.post(
  "/create",
  requireRole(ROLES.STAFF),
  validate(createStudentSchema),
  (req, res) => {
    void studentController.create(req, res);
  },
);

router.get(
  "/",
  requireRole(ROLES.VIEWER),
  validate(getStudentsSchema),
  (req, res) => {
    void studentController.list(req, res);
  },
);

/**
 * @openapi
 * /students/fee-overview:
 *   get:
 *     tags: [Students]
 *     summary: Student fee overview (command center)
 *     description: |
 *       Paginated list of students with all fees per student, totals, and rollup status.
 *       Optional feeStatuses and feeTypes (comma-separated) keep only students who have
 *       at least one fee matching those constraints on the same fee row.
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
 *         name: studentStatus
 *         schema: { type: string, enum: [ACTIVE, INACTIVE, DROPPED] }
 *         description: Filter by student enrollment status
 *       - in: query
 *         name: class
 *         schema: { type: string }
 *       - in: query
 *         name: section
 *         schema: { type: string, enum: [A, B, C, D] }
 *       - in: query
 *         name: search
 *         schema: { type: string, maxLength: 200 }
 *         description: Case-insensitive match on name, admissionId, or scholarId
 *       - in: query
 *         name: feeStatuses
 *         schema: { type: string }
 *         description: Comma-separated — PENDING, PARTIAL, PAID, OVERDUE
 *       - in: query
 *         name: feeTypes
 *         schema: { type: string }
 *         description: Comma-separated — TUITION, TRANSPORT, HOSTEL, OTHER
 *       - in: query
 *         name: sortBy
 *         schema: { type: string, enum: [studentName, class, pendingTotal, createdAt], default: studentName }
 *       - in: query
 *         name: sortDir
 *         schema: { type: string, enum: [asc, desc], default: asc }
 *     responses:
 *       200:
 *         description: Paginated student fee overview rows
 *       400:
 *         description: Invalid query (e.g. unknown fee status/type token)
 *       401:
 *         description: Unauthorized
 */
router.get(
  "/fee-overview",
  requireRole(ROLES.VIEWER),
  validate(feeOverviewSchema),
  (req, res) => {
    void studentController.feeOverview(req, res);
  },
);

/**
 * @openapi
 * /students/{id}:
 *   get:
 *     tags: [Students]
 *     summary: Get student by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Student
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Student'
 *       404:
 *         description: Not found
 *       401:
 *         description: Unauthorized
 *   patch:
 *     tags: [Students]
 *     summary: Update student
 *     description: Partial update. Requires STAFF or higher.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/StudentUpdate'
 *     responses:
 *       200:
 *         description: Updated student
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Student'
 *       400:
 *         description: Validation error
 *       404:
 *         description: Not found
 *       403:
 *         description: Insufficient permissions
 *   delete:
 *     tags: [Students]
 *     summary: Delete student
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Deleted
 *       404:
 *         description: Not found
 *       403:
 *         description: Insufficient permissions
 */
router.get(
  "/:id",
  requireRole(ROLES.VIEWER),
  validate(studentIdParamsSchema),
  (req, res) => {
    void studentController.getById(req, res);
  },
);

router.patch(
  "/:id",
  requireRole(ROLES.STAFF),
  validate(updateStudentSchema),
  (req, res) => {
    void studentController.update(req, res);
  },
);

router.delete(
  "/:id",
  requireRole(ROLES.STAFF),
  validate(studentIdParamsSchema),
  (req, res) => {
    void studentController.remove(req, res);
  },
);

export default router;
