import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { JwtPayload } from '../types/express';

/**
 * Extracts Bearer token from Authorization header and attaches user to req.
 */
function verifyAccessToken(token: string, secret: string): JwtPayload {
  const raw = jwt.verify(token, secret);
  if (typeof raw === "string") {
    throw new Error("Unexpected string JWT payload");
  }
  return raw as unknown as JwtPayload;
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  if (!env.jwtSecret) {
    res.status(500).json({ error: "Server misconfiguration" });
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const decoded = verifyAccessToken(token, env.jwtSecret);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Optional auth: attaches user if token present, does not reject if absent.
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    next();
    return;
  }

  const token = authHeader.slice(7);
  if (env.jwtSecret) {
    try {
      const decoded = verifyAccessToken(token, env.jwtSecret);
      req.user = decoded;
    } catch {
      // Ignore invalid token for optional auth
    }
  }
  next();
}
