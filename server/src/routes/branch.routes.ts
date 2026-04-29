import { Router } from "express";
import Joi from "joi";
import * as branchController from "../modules/branch/branch.controller";
import { authenticate } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/rbac.middleware";
import { ROLES } from "../types/roles";
import { validate } from "../middleware/validate.middleware";
import { env } from "../config/env";

const mongoId = Joi.string().hex().length(24);

const branchIdParams = Joi.object({
  branchId: mongoId.required(),
});

const createBody = Joi.object({
  name: Joi.string().trim().min(1).max(200).required(),
  code: Joi.string().trim().max(64).allow("").optional(),
  address: Joi.string().trim().max(1000).allow("").optional(),
}).unknown(false);

const patchBody = Joi.object({
  name: Joi.string().trim().min(1).max(200).optional(),
  code: Joi.string().trim().max(64).allow("", null).optional(),
  address: Joi.string().trim().max(1000).allow("", null).optional(),
})
  .min(1)
  .unknown(false);

const router = Router();

router.use(authenticate);

/** List branches (STAFF+). */
router.get(
  "/",
  requireRole(ROLES.STAFF),
  (req, res) => {
    void branchController.list(req, res);
  },
);

/** Create branch (tenant admin). Disabled when multi-branch feature is off. */
router.post(
  "/",
  requireRole(ROLES.TENANT_ADMIN),
  validate({ body: createBody }),
  (req, res) => {
    if (!env.multiBranchEnabled) {
      res.status(403).json({ error: "Multi-branch is disabled" });
      return;
    }
    void branchController.create(req, res);
  },
);

router.get(
  "/:branchId",
  requireRole(ROLES.STAFF),
  validate({ params: branchIdParams }),
  (req, res) => {
    void branchController.getById(req, res);
  },
);

router.patch(
  "/:branchId",
  requireRole(ROLES.TENANT_ADMIN),
  validate({ params: branchIdParams, body: patchBody }),
  (req, res) => {
    if (!env.multiBranchEnabled) {
      res.status(403).json({ error: "Multi-branch is disabled" });
      return;
    }
    void branchController.update(req, res);
  },
);

router.delete(
  "/:branchId",
  requireRole(ROLES.TENANT_ADMIN),
  validate({ params: branchIdParams }),
  (req, res) => {
    if (!env.multiBranchEnabled) {
      res.status(403).json({ error: "Multi-branch is disabled" });
      return;
    }
    void branchController.remove(req, res);
  },
);

export default router;
