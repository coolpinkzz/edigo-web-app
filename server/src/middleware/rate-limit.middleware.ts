import { Request, Response } from "express";
import rateLimit from "express-rate-limit";

function rateLimitMessage(message: string): { error: string } {
  return { error: message };
}

function rateLimitHandler(message: string) {
  return (_req: Request, res: Response): void => {
    res.status(429).json(rateLimitMessage(message));
  };
}

const commonOptions = {
  standardHeaders: true,
  legacyHeaders: false,
} as const;

/** Public auth endpoints: reduce brute-force and enumeration pressure. */
export const signupRateLimit = rateLimit({
  ...commonOptions,
  windowMs: 15 * 60 * 1000,
  max: 10,
  handler: rateLimitHandler("Too many signup attempts. Please try again later."),
});

/** Stricter cap for credential checks. */
export const loginRateLimit = rateLimit({
  ...commonOptions,
  windowMs: 15 * 60 * 1000,
  max: 20,
  handler: rateLimitHandler("Too many login attempts. Please try again later."),
});

/** Tenant admin invite endpoint can be abused for SMS/account spam. */
export const inviteRateLimit = rateLimit({
  ...commonOptions,
  windowMs: 10 * 60 * 1000,
  max: 30,
  handler: rateLimitHandler("Too many invite attempts. Please try again later."),
});

/** Webhook endpoint should absorb retries but still cap flood abuse. */
export const paymentWebhookRateLimit = rateLimit({
  ...commonOptions,
  windowMs: 60 * 1000,
  max: 120,
  handler: rateLimitHandler("Too many webhook requests."),
});

/** Public pay-link endpoint: slows token probing and automated abuse. */
export const payLinkRateLimit = rateLimit({
  ...commonOptions,
  windowMs: 15 * 60 * 1000,
  max: 60,
  handler: rateLimitHandler("Too many payment link requests. Please try again later."),
});

/** Forgot password: OTP SMS abuse. */
export const passwordResetOtpRequestRateLimit = rateLimit({
  ...commonOptions,
  windowMs: 15 * 60 * 1000,
  max: 5,
  handler: rateLimitHandler(
    "Too many verification code requests. Please try again later.",
  ),
});

/** OTP guess throttling (per IP). */
export const passwordResetOtpVerifyRateLimit = rateLimit({
  ...commonOptions,
  windowMs: 15 * 60 * 1000,
  max: 30,
  handler: rateLimitHandler("Too many verification attempts. Please try again later."),
});

export const passwordResetSubmitRateLimit = rateLimit({
  ...commonOptions,
  windowMs: 15 * 60 * 1000,
  max: 10,
  handler: rateLimitHandler("Too many reset attempts. Please try again later."),
});

/** Public landing "book demo" form — limit abuse / spam. */
export const demoRequestRateLimit = rateLimit({
  ...commonOptions,
  windowMs: 15 * 60 * 1000,
  max: 8,
  handler: rateLimitHandler(
    "Too many demo requests from this address. Please try again later.",
  ),
});
