import { Router } from "express";
import * as quotationController from "../modules/quotation/quotation.controller";
import {
  createQuotationSchema,
  listQuotationsQuerySchema,
  quotationAcceptStaffBodySchema,
  quotationIdParamsSchema,
  updateQuotationSchema,
} from "../modules/quotation/quotation.validation";
import { authenticate } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import { requireRole } from "../middleware/rbac.middleware";
import { ROLES } from "../types/roles";
import {
  quotationAcceptRateLimit,
  quotationSendSmsRateLimit,
} from "../middleware/rate-limit.middleware";

const router = Router();

router.use(authenticate);

router.get(
  "/",
  validate({ query: listQuotationsQuerySchema }),
  (req, res) => {
    void quotationController.list(req, res);
  },
);

router.post(
  "/",
  requireRole(ROLES.STAFF),
  validate({ body: createQuotationSchema }),
  (req, res) => {
    void quotationController.create(req, res);
  },
);

router.get(
  "/:id",
  validate({ params: quotationIdParamsSchema }),
  (req, res) => {
    void quotationController.getById(req, res);
  },
);

router.patch(
  "/:id",
  requireRole(ROLES.STAFF),
  validate({ params: quotationIdParamsSchema, body: updateQuotationSchema }),
  (req, res) => {
    void quotationController.update(req, res);
  },
);

router.get(
  "/:id/pdf",
  validate({ params: quotationIdParamsSchema }),
  (req, res) => {
    void quotationController.downloadPdf(req, res);
  },
);

router.post(
  "/:id/send-sms",
  quotationSendSmsRateLimit,
  requireRole(ROLES.STAFF),
  validate({ params: quotationIdParamsSchema }),
  (req, res) => {
    void quotationController.sendPdfSms(req, res);
  },
);

router.post(
  "/:id/accept-checkout",
  quotationAcceptRateLimit,
  requireRole(ROLES.STAFF),
  validate({
    params: quotationIdParamsSchema,
    body: quotationAcceptStaffBodySchema,
  }),
  (req, res) => {
    void quotationController.acceptCheckout(req, res);
  },
);

export default router;
