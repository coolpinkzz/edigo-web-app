import { Router } from "express";
import { postBookDemo } from "../modules/public/demo-request.controller";
import { bookDemoBodySchema } from "../modules/public/demo-request.validation";
import { validate } from "../middleware/validate.middleware";
import { demoRequestRateLimit } from "../middleware/rate-limit.middleware";

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

export default router;
