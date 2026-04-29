import { timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env";

/**
 * When `SIGNUP_API_KEY` is set, requires `X-Signup-Key` to match (constant-time).
 * When unset, signup remains open (set the env var in production to restrict creation).
 */
export function requireSignupApiKey(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const expected = env.signupApiKey.trim();
  if (!expected) {
    next();
    return;
  }

  const provided = (req.get("X-Signup-Key") ?? "").trim();
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(provided, "utf8");
  if (a.length !== b.length) {
    res.status(401).json({ error: "Invalid or missing signup key" });
    return;
  }
  if (!timingSafeEqual(a, b)) {
    res.status(401).json({ error: "Invalid or missing signup key" });
    return;
  }
  next();
}
