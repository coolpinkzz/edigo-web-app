import { Router } from "express";
import { postBookDemo } from "../modules/public/demo-request.controller";
import { bookDemoBodySchema } from "../modules/public/demo-request.validation";
import { validate } from "../middleware/validate.middleware";
import {
  demoRequestRateLimit,
  quotationAcceptRateLimit,
  quotationPdfPublicRateLimit,
} from "../middleware/rate-limit.middleware";
import {
  downloadPdfByToken,
  getCheckoutPage,
  postAcceptQuotation,
} from "../modules/quotation/quotation-public.controller";
import {
  quotationAcceptPublicBodySchema,
  quotationIdParamsSchema,
} from "../modules/quotation/quotation.validation";

const router = Router();

/**
 * @openapi
 * /public/book-demo:
 *   post:
 *     tags: [Public]
 *     summary: Book a free demo (landing page)
 *     description: Sends an email to the configured team inbox with the visitor's contact details. Requires SMTP env vars on the server.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, phone, email]
 *             properties:
 *               name:
 *                 type: string
 *               phone:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Notification sent
 *       400:
 *         description: Validation error
 *       429:
 *         description: Too many requests
 *       503:
 *         description: Email not configured on server
 */
router.post(
  "/book-demo",
  demoRequestRateLimit,
  validate({ body: bookDemoBodySchema }),
  postBookDemo,
);

router.get(
  "/quotations/:id/pdf",
  quotationPdfPublicRateLimit,
  validate({ params: quotationIdParamsSchema }),
  downloadPdfByToken,
);

router.get(
  "/quotations/:id/checkout",
  quotationAcceptRateLimit,
  validate({ params: quotationIdParamsSchema }),
  (req, res) => {
    void getCheckoutPage(req, res);
  },
);

router.post(
  "/quotations/:id/accept",
  quotationAcceptRateLimit,
  validate({
    params: quotationIdParamsSchema,
    body: quotationAcceptPublicBodySchema,
  }),
  (req, res) => {
    void postAcceptQuotation(req, res);
  },
);

export default router;
