import { Request, Response } from "express";
import { isTenantType } from "../../types/tenant";
import * as authService from "./auth.service";
import * as passwordResetService from "./password-reset.service";
import {
  createLinkedAccountForTenant,
  fetchLinkedAccountRemote,
  LinkedAccountAlreadyExistsError,
  LinkedAccountRequiredError,
  RazorpayLinkedAccountApiError,
  type RazorpayLinkedAccountRemote,
  submitRouteSettlementBankForTenant,
} from "./razorpay-linked-account.service";
import { Tenant } from "./tenant.model";

const TENANT_AUTH_SELECT =
  "name tenantType razorpayLinkedAccountId razorpayLinkedAccountStatus razorpayRouteProductId razorpayRouteActivationStatus" as const;

function tenantRazorpayLinkedAccountShape(
  t: {
    razorpayLinkedAccountId?: string | null;
    razorpayLinkedAccountStatus?: string | null;
  } | null | undefined,
  remote?: RazorpayLinkedAccountRemote | null,
): {
  linked: boolean;
  accountId?: string;
  status?: string;
  remote?: RazorpayLinkedAccountRemote;
} {
  const id = t?.razorpayLinkedAccountId;
  const base: {
    linked: boolean;
    accountId?: string;
    status?: string;
    remote?: RazorpayLinkedAccountRemote;
  } = {
    linked: Boolean(id),
    ...(id ? { accountId: id } : {}),
    ...(t?.razorpayLinkedAccountStatus
      ? { status: t.razorpayLinkedAccountStatus }
      : {}),
  };
  if (remote) {
    base.remote = remote;
  }
  return base;
}

function tenantRazorpayRouteShape(t: {
  razorpayRouteProductId?: string | null;
  razorpayRouteActivationStatus?: string | null;
} | null | undefined): {
  productConfigured: boolean;
  activationStatus?: string;
  payoutsReady: boolean;
} {
  const st = t?.razorpayRouteActivationStatus;
  return {
    productConfigured: Boolean(t?.razorpayRouteProductId),
    ...(typeof st === "string" && st ? { activationStatus: st } : {}),
    payoutsReady: st === "activated",
  };
}

function tenantAuthPayload(
  t: {
    name?: string;
    tenantType?: string;
    razorpayLinkedAccountId?: string | null;
    razorpayLinkedAccountStatus?: string | null;
    razorpayRouteProductId?: string | null;
    razorpayRouteActivationStatus?: string | null;
  } | null | undefined,
  linkedAccountRemote?: RazorpayLinkedAccountRemote | null,
): {
  name: string;
  tenantType: string;
  razorpayLinkedAccount: ReturnType<typeof tenantRazorpayLinkedAccountShape>;
  razorpayRoute: ReturnType<typeof tenantRazorpayRouteShape>;
} {
  return {
    name: typeof t?.name === "string" ? t.name : "",
    tenantType: t?.tenantType ?? "SCHOOL",
    razorpayLinkedAccount: tenantRazorpayLinkedAccountShape(
      t,
      linkedAccountRemote,
    ),
    razorpayRoute: tenantRazorpayRouteShape(t),
  };
}

/** Loads tenant JSON for auth responses; refreshes linked account from Razorpay GET when `acc_` id exists. */
async function tenantAuthPayloadWithRemote(
  tenantId: string,
  tenant: {
    name?: string;
    tenantType?: string;
    razorpayLinkedAccountId?: string | null;
    razorpayLinkedAccountStatus?: string | null;
    razorpayRouteProductId?: string | null;
    razorpayRouteActivationStatus?: string | null;
  } | null,
): Promise<ReturnType<typeof tenantAuthPayload>> {
  if (!tenant) {
    return tenantAuthPayload(null);
  }
  let remote: RazorpayLinkedAccountRemote | null = null;
  const accId = tenant.razorpayLinkedAccountId;
  if (typeof accId === "string" && accId.startsWith("acc_")) {
    remote = await fetchLinkedAccountRemote(accId);
    if (
      remote?.status &&
      remote.status !== tenant.razorpayLinkedAccountStatus
    ) {
      await Tenant.findByIdAndUpdate(tenantId, {
        $set: { razorpayLinkedAccountStatus: remote.status },
      }).exec();
      tenant = { ...tenant, razorpayLinkedAccountStatus: remote.status };
    }
  }
  return tenantAuthPayload(tenant, remote);
}

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
      .select(TENANT_AUTH_SELECT)
      .lean()
      .exec();

    res.json({
      user: req.user,
      tenant: await tenantAuthPayloadWithRemote(tenantId, tenant),
    });
  } catch {
    res.status(500).json({ error: "Failed to load tenant" });
  }
}

/**
 * PATCH /auth/tenant
 * Tenant admin: update organization display name (login slug unchanged).
 */
export async function patchTenant(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const tenantId = req.user!.tenantId;
    const { name } = req.body as { name: string };

    const updated = await Tenant.findByIdAndUpdate(
      tenantId,
      { $set: { name: name.trim() } },
      { new: true },
    )
      .select(TENANT_AUTH_SELECT)
      .lean()
      .exec();

    if (!updated) {
      res.status(404).json({ error: "Tenant not found" });
      return;
    }

    res.json({
      tenant: await tenantAuthPayloadWithRemote(tenantId, updated),
    });
  } catch {
    res.status(500).json({ error: "Failed to update tenant" });
  }
}

/**
 * POST /auth/razorpay-linked-account
 * Tenant admin: create Razorpay Route linked account and store id on tenant.
 */
export async function createRazorpayLinkedAccount(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const tenantId = req.user!.tenantId;
    const body = req.body as {
      email: string;
      phone: string;
      legalBusinessName: string;
      customerFacingBusinessName?: string;
      contactName: string;
      businessType: string;
      profile: {
        category: string;
        subcategory: string;
        addresses: {
          registered: {
            street1: string;
            street2?: string;
            city: string;
            state: string;
            postalCode: string;
            country: string;
          };
        };
      };
      legalInfo: { pan: string; gst?: string };
    };

    const result = await createLinkedAccountForTenant({
      tenantId,
      payload: {
        email: body.email,
        phone: body.phone,
        legalBusinessName: body.legalBusinessName,
        customerFacingBusinessName: body.customerFacingBusinessName,
        contactName: body.contactName,
        businessType: body.businessType,
        profile: body.profile,
        legalInfo: {
          pan: body.legalInfo.pan,
          gst: body.legalInfo.gst,
        },
      },
    });

    const tenant = await Tenant.findById(tenantId)
      .select(TENANT_AUTH_SELECT)
      .lean()
      .exec();

    res.status(201).json({
      tenant: await tenantAuthPayloadWithRemote(tenantId, tenant),
    });
  } catch (err) {
    if (err instanceof LinkedAccountAlreadyExistsError) {
      res.status(409).json({ error: err.message });
      return;
    }
    if (err instanceof RazorpayLinkedAccountApiError) {
      const status = err.httpStatus >= 500 ? 502 : 400;
      res.status(status).json({ error: err.message });
      return;
    }
    const message = err instanceof Error ? err.message : "Request failed";
    if (message === "Tenant not found") {
      res.status(404).json({ error: message });
      return;
    }
    if (message === "Razorpay API keys are not configured") {
      res.status(503).json({ error: message });
      return;
    }
    res.status(500).json({ error: message });
  }
}

/**
 * POST /auth/razorpay-route-settlements
 * Tenant admin: Route product + settlement bank (server-only; no bank data stored in DB).
 */
export async function createRazorpayRouteSettlements(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const tenantId = req.user!.tenantId;
    const body = req.body as {
      tncAccepted: boolean;
      beneficiaryName: string;
      accountNumber: string;
      ifscCode: string;
    };

    await submitRouteSettlementBankForTenant({
      tenantId,
      tncAccepted: body.tncAccepted,
      beneficiaryName: body.beneficiaryName,
      accountNumber: body.accountNumber,
      ifscCode: body.ifscCode,
    });

    const tenant = await Tenant.findById(tenantId)
      .select(TENANT_AUTH_SELECT)
      .lean()
      .exec();

    res.status(200).json({
      tenant: await tenantAuthPayloadWithRemote(tenantId, tenant),
    });
  } catch (err) {
    if (err instanceof LinkedAccountRequiredError) {
      res.status(400).json({ error: err.message });
      return;
    }
    if (err instanceof RazorpayLinkedAccountApiError) {
      const status = err.httpStatus >= 500 ? 502 : 400;
      res.status(status).json({ error: err.message });
      return;
    }
    const message = err instanceof Error ? err.message : "Request failed";
    if (message === "Tenant not found") {
      res.status(404).json({ error: message });
      return;
    }
    if (message === "Razorpay Route terms must be accepted") {
      res.status(400).json({ error: message });
      return;
    }
    if (message === "Razorpay API keys are not configured") {
      res.status(503).json({ error: message });
      return;
    }
    res.status(500).json({ error: message });
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
