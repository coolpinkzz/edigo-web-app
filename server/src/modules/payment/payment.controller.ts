import crypto from "crypto";
import { Request, Response } from "express";
import { logger } from "../../utils/logger";
import { parseIdempotencyKeyHeader } from "../fee/fee.validation";
import * as paymentService from "./payment.service";
import type { CreateOrderBody } from "./payment.validation";

const WEBHOOK_HTTP_SCOPE = "payment.webhook";

/**
 * POST /payments/create-order — authenticated; creates Razorpay order + Payment (INITIATED).
 * Requires Idempotency-Key header for safe retries.
 */
export async function createOrder(req: Request, res: Response): Promise<void> {
  let idempotencyKey: string;
  try {
    const raw = parseIdempotencyKeyHeader(req);
    if (!raw) {
      res.status(400).json({
        error: "Idempotency-Key header is required for create-order",
      });
      return;
    }
    idempotencyKey = raw;
  } catch (e) {
    const message = e instanceof Error ? e.message : "Invalid Idempotency-Key";
    res.status(400).json({ error: message });
    return;
  }

  try {
    const body = req.body as CreateOrderBody;
    const tenantId = req.user!.tenantId;

    const result = await paymentService.createOrder(
      tenantId,
      body,
      idempotencyKey,
    );

    res.status(result.replay ? 200 : 201).json({
      key: result.key,
      order: result.order,
      payment: result.payment,
      replay: result.replay,
    });
  } catch (err) {
    if (err instanceof paymentService.PaymentIdempotencyConflictError) {
      res.status(409).json({ error: err.message });
      return;
    }
    const message =
      err instanceof Error ? err.message : "Failed to create payment order";
    const status =
      message === "Razorpay API keys are not configured" ||
      message === "Failed to create payment order with Razorpay" ||
      message === "Failed to save payment record"
        ? 503
        : 400;
    res.status(status).json({ error: message });
  }
}

/**
 * POST /payments/webhook — Razorpay server-to-server; verifies signature; updates Payment + fee state.
 * Must not rely on client-reported success.
 */
export async function webhook(req: Request, res: Response): Promise<void> {
  console.log("webhook", req.body);
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  const signature =
    req.get("x-razorpay-signature") ?? req.get("X-Razorpay-Signature");

  let razorpayEvent: string | undefined;
  try {
    if (req.rawBody?.length) {
      const j = JSON.parse(req.rawBody.toString("utf8")) as {
        event?: string;
      };
      razorpayEvent = j.event;
    }
  } catch {
    razorpayEvent = undefined;
  }

  logger.info(WEBHOOK_HTTP_SCOPE, "incoming POST /payments/webhook", {
    requestId,
    razorpayEvent,
    bodyBytes: req.rawBody?.length ?? 0,
    hasSignatureHeader: Boolean(signature?.trim()),
    ip: req.ip,
  });

  try {
    const result = await paymentService.processWebhook(req.rawBody, signature, {
      requestId,
    });
    const durationMs = Date.now() - startedAt;

    if (!result.ok) {
      logger.warn(WEBHOOK_HTTP_SCOPE, "webhook rejected (pre-handler)", {
        requestId,
        durationMs,
        reason: result.message,
      });
      res.status(400).json({ received: false, message: result.message });
      return;
    }

    logger.info(WEBHOOK_HTTP_SCOPE, "webhook response OK", {
      requestId,
      durationMs,
      ignored: result.ignored ?? false,
      message: result.message,
    });

    res.status(200).json({
      received: true,
      ignored: result.ignored ?? false,
      message: result.message,
    });
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    const message =
      err instanceof Error ? err.message : "Webhook processing failed";
    logger.error(WEBHOOK_HTTP_SCOPE, "webhook handler threw", {
      requestId,
      durationMs,
      error: message,
      ...(err instanceof Error && err.stack ? { stack: err.stack } : {}),
    });
    res.status(500).json({ received: false, error: message });
  }
}
