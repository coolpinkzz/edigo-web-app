import { Router } from "express";
import * as courseController from "../modules/course/course.controller";
import {
  createCourseSchema,
  deleteCourseSchema,
  getCourseSchema,
  listCoursesSchema,
  updateCourseSchema,
} from "../modules/course/course.validation";
import { authenticate } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import { requireRole } from "../middleware/rbac.middleware";
import { ROLES } from "../types/roles";

const router = Router();

router.use(authenticate);

/**
 * @openapi
 * /courses:
 *   post:
 *     tags: [Courses]
 *     summary: Create a course (tenant catalog entry)
 *     description: Tenant admins maintain the course list; student.courseId references these ids.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CourseCreate'
 *     responses:
 *       201:
 *         description: Course created
 *       400:
 *         description: Validation error
 *   get:
 *     tags: [Courses]
 *     summary: List courses for the current tenant
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 50 }
 *       - in: query
 *         name: includeInactive
 *         schema: { type: boolean }
 *         description: When true, includes inactive courses (default false)
 *     responses:
 *       200:
 *         description: Paginated courses
 */
router.post(
  "/",
  requireRole(ROLES.TENANT_ADMIN),
  validate(createCourseSchema),
  (req, res) => {
    void courseController.create(req, res);
  },
);

router.get(
  "/",
  requireRole(ROLES.VIEWER),
  validate(listCoursesSchema),
  (req, res) => {
    void courseController.list(req, res);
  },
);

/**
 * @openapi
 * /courses/{courseId}:
 *   get:
 *     tags: [Courses]
 *     summary: Get course by id
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Course
 *       404:
 *         description: Not found
 *   patch:
 *     tags: [Courses]
 *     summary: Update course
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CourseUpdate'
 *     responses:
 *       200:
 *         description: Updated course
 *       404:
 *         description: Not found
 *   delete:
 *     tags: [Courses]
 *     summary: Delete course
 *     description: Fails if any student has this courseId.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204:
 *         description: Deleted
 *       400:
 *         description: Course still assigned to students
 *       404:
 *         description: Not found
 */
router.get(
  "/:courseId",
  requireRole(ROLES.VIEWER),
  validate(getCourseSchema),
  (req, res) => {
    void courseController.getById(req, res);
  },
);

router.patch(
  "/:courseId",
  requireRole(ROLES.TENANT_ADMIN),
  validate(updateCourseSchema),
  (req, res) => {
    void courseController.update(req, res);
  },
);

router.delete(
  "/:courseId",
  requireRole(ROLES.TENANT_ADMIN),
  validate(deleteCourseSchema),
  (req, res) => {
    void courseController.remove(req, res);
  },
);

export default router;
