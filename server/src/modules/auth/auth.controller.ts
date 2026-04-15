import { Request, Response } from "express";
import { isTenantType } from "../../types/tenant";
import * as authService from "./auth.service";
import * as passwordResetService from "./password-reset.service";
import { Tenant } from "./tenant.model";

/**
 * POST /auth/signup
 * Creates new tenant + admin user.
 */
export async function signup(req: Request, res: Response): Promise<void> {
  try {
    const { tenantName, tenantSlug, tenantType, phone, password, name } =
      req.body;

    if (
      !tenantName ||
      !tenantSlug ||
      tenantType === undefined ||
      tenantType === null ||
      !phone ||
      !password ||
      !name
    ) {
      res.status(400).json({
        error:
          "tenantName, tenantSlug, tenantType, phone, password, name are required",
      });
      return;
    }

    if (!isTenantType(tenantType)) {
      res.status(400).json({
        error: "tenantType must be SCHOOL or ACADEMY",
      });
      return;
    }

    const result = await authService.signup({
      tenantName,
      tenantSlug,
      tenantType,
      phone,
      password,
      name,
    });

    res.status(201).json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Signup failed";
    const code = message.includes("already exists") ? 409 : 400;
    res.status(code).json({ error: message });
  }
}

/**
 * POST /auth/login
 * Returns JWT for authenticated user in specified tenant.
 */
export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { phone, password, tenantSlug } = req.body;

    if (!phone || !password || !tenantSlug) {
      res.status(400).json({
        error: "phone, password, tenantSlug are required",
      });
      return;
    }

    const result = await authService.login({ phone, password, tenantSlug });
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Login failed";
    res.status(401).json({ error: message });
  }
}

/**
 * GET /auth/me
 * Current JWT claims plus tenant metadata (including tenantType).
 */
export async function me(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = req.user!.tenantId;
    const tenant = await Tenant.findById(tenantId)
      .select("name tenantType")
      .lean()
      .exec();

    res.json({
      user: req.user,
      tenant: {
        name: typeof tenant?.name === "string" ? tenant.name : "",
        tenantType: tenant?.tenantType ?? "SCHOOL",
      },
    });
  } catch {
    res.status(500).json({ error: "Failed to load tenant" });
  }
}

/**
 * PATCH /auth/tenant
 * Tenant admin: update organization display name (login slug unchanged).
 */
export async function patchTenant(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = req.user!.tenantId;
    const { name } = req.body as { name: string };

    const updated = await Tenant.findByIdAndUpdate(
      tenantId,
      { $set: { name: name.trim() } },
      { new: true },
    )
      .select("name tenantType")
      .lean()
      .exec();

    if (!updated) {
      res.status(404).json({ error: "Tenant not found" });
      return;
    }

    res.json({
      tenant: {
        name: updated.name,
        tenantType: updated.tenantType ?? "SCHOOL",
      },
    });
  } catch {
    res.status(500).json({ error: "Failed to update tenant" });
  }
}

/**
 * POST /auth/request-password-reset-otp
 */
export async function requestPasswordResetOtp(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const { phone, tenantSlug } = req.body as {
      phone: string;
      tenantSlug: string;
    };
    const result = await passwordResetService.requestPasswordResetOtp({
      phone,
      tenantSlug,
    });
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Request failed";
    if (message.includes("Could not send verification")) {
      res.status(503).json({ error: message });
      return;
    }
    res.status(400).json({ error: message });
  }
}

/**
 * POST /auth/verify-password-reset-otp
 */
export async function verifyPasswordResetOtp(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const { phone, tenantSlug, otp } = req.body as {
      phone: string;
      tenantSlug: string;
      otp: string;
    };
    const result = await passwordResetService.verifyPasswordResetOtp({
      phone,
      tenantSlug,
      otp,
    });
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Verification failed";
    const tooMany = message.includes("Too many incorrect");
    res.status(tooMany ? 429 : 400).json({ error: message });
  }
}

/**
 * POST /auth/reset-password
 */
export async function resetPassword(req: Request, res: Response): Promise<void> {
  try {
    const { phone, tenantSlug, newPassword } = req.body as {
      phone: string;
      tenantSlug: string;
      newPassword: string;
    };
    const result = await passwordResetService.resetPasswordAfterOtp({
      phone,
      tenantSlug,
      newPassword,
    });
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Reset failed";
    res.status(400).json({ error: message });
  }
}
