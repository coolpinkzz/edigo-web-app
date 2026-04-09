import { Request, Response } from "express";
import { isTenantType } from "../../types/tenant";
import * as authService from "./auth.service";
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
