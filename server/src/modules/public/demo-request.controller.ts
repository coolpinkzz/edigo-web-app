import { Request, Response } from "express";
import { isDemoEmailConfigured } from "../../config/env";
import { sendDemoRequestEmail } from "./demo-request.service";
import { logger } from "../../utils/logger";

export async function postBookDemo(req: Request, res: Response): Promise<void> {
  if (!isDemoEmailConfigured()) {
    logger.warn(
      "demo.public",
      "book demo rejected — set SMTP_HOST, SMTP_USER, SMTP_PASS (and optional SMTP_PORT / SMTP_SECURE)",
    );
    res.status(503).json({
      ok: false,
      error:
        "Demo booking is temporarily unavailable. Please try again later or contact us directly.",
    });
    return;
  }

  const { name, phone, email } = req.body as {
    name: string;
    phone: string;
    email: string;
  };

  try {
    await sendDemoRequestEmail({ name, phone, email });
    res.status(200).json({ ok: true });
  } catch (err: unknown) {
    logger.error(
      "demo.public",
      "failed to send demo request email",
      {
        message: err instanceof Error ? err.message : String(err),
      },
    );
    res.status(502).json({
      ok: false,
      error: "Could not send your request. Please try again in a few minutes.",
    });
  }
}
