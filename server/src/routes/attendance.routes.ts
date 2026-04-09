import { Router } from "express";
import * as attendanceController from "../modules/attendance/attendance.controller";
import {
  attendanceDashboardRecordsSchema,
  attendanceDashboardSummarySchema,
  attendanceDashboardTrendSchema,
  getAttendanceSchema,
  markAttendanceSchema,
} from "../modules/attendance/attendance.validation";
import { authenticate } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import { requireRole } from "../middleware/rbac.middleware";
import { ROLES } from "../types/roles";

const router = Router();

router.use(authenticate);

router.post(
  "/mark",
  requireRole(ROLES.STAFF),
  validate(markAttendanceSchema),
  (req, res) => {
    void attendanceController.mark(req, res);
  },
);

router.get(
  "/dashboard/summary",
  requireRole(ROLES.VIEWER),
  validate(attendanceDashboardSummarySchema),
  (req, res) => {
    void attendanceController.dashboardSummary(req, res);
  },
);

router.get(
  "/dashboard/trend",
  requireRole(ROLES.VIEWER),
  validate(attendanceDashboardTrendSchema),
  (req, res) => {
    void attendanceController.dashboardTrend(req, res);
  },
);

router.get(
  "/dashboard/records",
  requireRole(ROLES.VIEWER),
  validate(attendanceDashboardRecordsSchema),
  (req, res) => {
    void attendanceController.dashboardRecords(req, res);
  },
);

router.get(
  "/",
  requireRole(ROLES.VIEWER),
  validate(getAttendanceSchema),
  (req, res) => {
    void attendanceController.get(req, res);
  },
);

export default router;
