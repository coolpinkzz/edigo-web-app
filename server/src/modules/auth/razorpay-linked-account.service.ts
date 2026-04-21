import { env } from "../../config/env";
import { logger } from "../../utils/logger";
import { Tenant } from "./tenant.model";

const RAZORPAY_API_BASE = "https://api.razorpay.com";

export class LinkedAccountRequiredError extends Error {
  constructor() {
    super(
      "Complete the linked account (business) step before bank settlement details.",
    );
    this.name = "LinkedAccountRequiredError";
  }
}

export class LinkedAccountAlreadyExistsError extends Error {
  constructor() {
    super(
      "A Razorpay linked account is already connected for this organization.",
    );
    this.name = "LinkedAccountAlreadyExistsError";
  }
}

export class RazorpayLinkedAccountApiError extends Error {
  constructor(
    readonly httpStatus: number,
    message: string,
  ) {
    super(message);
    this.name = "RazorpayLinkedAccountApiError";
  }
}

function assertRazorpayConfigured(): void {
  if (!env.razorpayKeyId || !env.razorpayKeySecret) {
    throw new Error("Razorpay API keys are not configured");
  }
}

function basicAuthHeader(): string {
  return `Basic ${Buffer.from(
    `${env.razorpayKeyId}:${env.razorpayKeySecret}`,
  ).toString("base64")}`;
}

function extractRazorpayErrorMessage(body: unknown): string {
  if (!body || typeof body !== "object") {
    return "Razorpay request failed";
  }
  const o = body as Record<string, unknown>;
  const err = o.error;
  if (typeof err === "string" && err.trim()) {
    return err;
  }
  if (err && typeof err === "object") {
    const d = (err as { description?: unknown }).description;
    if (typeof d === "string" && d.trim()) {
      return d;
    }
  }
  const desc = o.description;
  if (typeof desc === "string" && desc.trim()) {
    return desc;
  }
  return "Razorpay request failed";
}

export type RegisteredAddressInput = {
  street1: string;
  street2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};

export type CreateLinkedAccountPayload = {
  email: string;
  /** Digits only, 8–15 chars (normalized server-side). */
  phone: string;
  legalBusinessName: string;
  customerFacingBusinessName?: string;
  contactName: string;
  businessType: string;
  profile: {
    category: string;
    subcategory: string;
    addresses: { registered: RegisteredAddressInput };
  };
  legalInfo?: { pan: string; gst?: string };
};

function normalizePhoneDigits(phone: string): string {
  return phone.replace(/\D/g, "");
}

function buildRazorpayBody(
  input: CreateLinkedAccountPayload,
): Record<string, unknown> {
  const phone = normalizePhoneDigits(input.phone);
  const panRaw = input.legalInfo?.pan?.trim();
  if (!panRaw) {
    throw new Error("PAN is required");
  }
  const legal: Record<string, string> = {
    pan: panRaw.toUpperCase(),
  };
  const gst = input.legalInfo?.gst?.trim();
  if (gst) {
    legal.gst = gst.toUpperCase();
  }

  const reg = input.profile.addresses.registered;
  const registered: Record<string, string> = {
    street1: reg.street1.trim(),
    city: reg.city.trim(),
    state: reg.state.trim().toUpperCase(),
    postal_code: reg.postalCode.trim(),
    country: reg.country.trim().toUpperCase(),
  };
  const street2 = reg.street2?.trim();
  if (street2) {
    registered.street2 = street2;
  }

  const body: Record<string, unknown> = {
    email: input.email.trim().toLowerCase(),
    phone,
    type: "route",
    legal_business_name: input.legalBusinessName.trim(),
    business_type: input.businessType.trim(),
    contact_name: input.contactName.trim(),
    profile: {
      category: input.profile.category.trim(),
      subcategory: input.profile.subcategory.trim(),
      addresses: { registered },
    },
    legal_info: legal,
  };

  const cf = input.customerFacingBusinessName?.trim();
  if (cf) {
    body.customer_facing_business_name = cf;
  }

  return body;
}

/**
 * Creates a Razorpay Route linked account (POST /v2/accounts) and stores id on Tenant.
 * Does not send `reference_id` (optional; avoids merchants without route_code_support).
 */
export async function createLinkedAccountForTenant(params: {
  tenantId: string;
  payload: CreateLinkedAccountPayload;
}): Promise<{ accountId: string; status: string }> {
  assertRazorpayConfigured();

  const existing = await Tenant.findById(params.tenantId)
    .select("razorpayLinkedAccountId")
    .lean()
    .exec();

  if (!existing) {
    throw new Error("Tenant not found");
  }
  if (existing.razorpayLinkedAccountId) {
    throw new LinkedAccountAlreadyExistsError();
  }

  const razorpayBody = buildRazorpayBody({
    ...params.payload,
    legalInfo: params.payload.legalInfo,
  });

  const res = await fetch(`${RAZORPAY_API_BASE}/v2/accounts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: basicAuthHeader(),
    },
    body: JSON.stringify(razorpayBody),
  });

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  if (!res.ok) {
    const msg = extractRazorpayErrorMessage(data);
    throw new RazorpayLinkedAccountApiError(res.status, msg);
  }

  const accountId = data.id;
  const status = data.status;
  if (typeof accountId !== "string" || !accountId.startsWith("acc_")) {
    throw new Error("Unexpected Razorpay response: missing account id");
  }
  const statusStr = typeof status === "string" && status ? status : "created";

  await Tenant.findByIdAndUpdate(params.tenantId, {
    $set: {
      razorpayLinkedAccountId: accountId,
      razorpayLinkedAccountStatus: statusStr,
      razorpayLinkedAccountCreatedAt: new Date(),
    },
  }).exec();

  return { accountId, status: statusStr };
}

async function razorpayV2Json(
  path: string,
  init: RequestInit,
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  assertRazorpayConfigured();
  const method = (init.method ?? "GET").toUpperCase();
  const headers: Record<string, string> = {
    Authorization: basicAuthHeader(),
    ...(init.headers as Record<string, string> | undefined),
  };
  if (method !== "GET" && method !== "HEAD") {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(`${RAZORPAY_API_BASE}${path}`, {
    ...init,
    headers,
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, status: res.status, data };
}

/** Public subset of GET /v2/accounts/:id (PAN/GST not exposed). */
export type RazorpayLinkedAccountRemote = {
  id: string;
  status: string;
  email?: string;
  phone?: string;
  legalBusinessName?: string;
  customerFacingBusinessName?: string;
  businessType?: string;
  contactName?: string;
  category?: string;
  subcategory?: string;
};

function mapLinkedAccountGetResponse(
  data: Record<string, unknown>,
): RazorpayLinkedAccountRemote | null {
  const id = data.id;
  const status = data.status;
  if (typeof id !== "string" || typeof status !== "string") {
    return null;
  }
  const profile = data.profile;
  let category: string | undefined;
  let subcategory: string | undefined;
  if (profile && typeof profile === "object") {
    const p = profile as Record<string, unknown>;
    if (typeof p.category === "string") {
      category = p.category;
    }
    if (typeof p.subcategory === "string") {
      subcategory = p.subcategory;
    }
  }
  const phoneRaw = data.phone;
  const phone =
    phoneRaw === undefined || phoneRaw === null
      ? undefined
      : String(phoneRaw);
  return {
    id,
    status,
    email: typeof data.email === "string" ? data.email : undefined,
    phone,
    legalBusinessName:
      typeof data.legal_business_name === "string"
        ? data.legal_business_name
        : undefined,
    customerFacingBusinessName:
      typeof data.customer_facing_business_name === "string"
        ? data.customer_facing_business_name
        : undefined,
    businessType:
      typeof data.business_type === "string" ? data.business_type : undefined,
    contactName:
      typeof data.contact_name === "string" ? data.contact_name : undefined,
    category,
    subcategory,
  };
}

/**
 * GET /v2/accounts/:account_id — [Fetch a Linked Account With ID](https://razorpay.com/docs/api/payments/route/fetch-with-id).
 * Returns null if Razorpay is not configured, the account is missing, or the request fails.
 */
export async function fetchLinkedAccountRemote(
  accountId: string,
): Promise<RazorpayLinkedAccountRemote | null> {
  if (!accountId.startsWith("acc_")) {
    return null;
  }
  try {
    assertRazorpayConfigured();
  } catch {
    return null;
  }
  try {
    const res = await razorpayV2Json(
      `/v2/accounts/${encodeURIComponent(accountId)}`,
      { method: "GET" },
    );
    if (!res.ok) {
      logger.warn("razorpay.linked_account", "fetch failed", {
        accountId,
        status: res.status,
        message: extractRazorpayErrorMessage(res.data),
      });
      return null;
    }
    return mapLinkedAccountGetResponse(res.data);
  } catch (err) {
    logger.warn("razorpay.linked_account", "fetch error", {
      accountId,
      message: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

function isRouteProductId(id: unknown): id is string {
  return typeof id === "string" && id.startsWith("acc_prd");
}

/**
 * Requests Route product (if missing) and PATCHes settlement bank details.
 * Does not persist account number or IFSC in MongoDB — only Razorpay product id + activation status.
 */
export async function submitRouteSettlementBankForTenant(params: {
  tenantId: string;
  tncAccepted: boolean;
  beneficiaryName: string;
  accountNumber: string;
  ifscCode: string;
}): Promise<{ activationStatus: string }> {
  assertRazorpayConfigured();
  if (!params.tncAccepted) {
    throw new Error("Razorpay Route terms must be accepted");
  }

  const tenant = await Tenant.findById(params.tenantId)
    .select("razorpayLinkedAccountId razorpayRouteProductId")
    .lean()
    .exec();

  if (!tenant) {
    throw new Error("Tenant not found");
  }
  if (!tenant.razorpayLinkedAccountId) {
    throw new LinkedAccountRequiredError();
  }

  const accountId = tenant.razorpayLinkedAccountId;
  let productId = tenant.razorpayRouteProductId;

  if (!productId) {
    const post = await razorpayV2Json(
      `/v2/accounts/${encodeURIComponent(accountId)}/products`,
      {
        method: "POST",
        body: JSON.stringify({
          product_name: "route",
          tnc_accepted: true,
        }),
      },
    );
    if (!post.ok) {
      const msg = extractRazorpayErrorMessage(post.data);
      throw new RazorpayLinkedAccountApiError(post.status, msg);
    }
    const pid = post.data.id;
    if (!isRouteProductId(pid)) {
      throw new Error("Unexpected Razorpay response: missing Route product id");
    }
    productId = pid;
    const postAct = post.data.activation_status;
    await Tenant.findByIdAndUpdate(params.tenantId, {
      $set: {
        razorpayRouteProductId: productId,
        ...(typeof postAct === "string" && postAct
          ? { razorpayRouteActivationStatus: postAct }
          : {}),
      },
    }).exec();
  }

  const accountNumber = params.accountNumber.replace(/\s/g, "");
  const patch = await razorpayV2Json(
    `/v2/accounts/${encodeURIComponent(accountId)}/products/${encodeURIComponent(productId)}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        settlements: {
          account_number: accountNumber,
          ifsc_code: params.ifscCode.trim().toUpperCase(),
          beneficiary_name: params.beneficiaryName.trim(),
        },
        tnc_accepted: true,
      }),
    },
  );

  if (!patch.ok) {
    const msg = extractRazorpayErrorMessage(patch.data);
    throw new RazorpayLinkedAccountApiError(patch.status, msg);
  }

  const act = patch.data.activation_status;
  const activationStatus = typeof act === "string" && act ? act : "requested";

  await Tenant.findByIdAndUpdate(params.tenantId, {
    $set: {
      razorpayRouteProductId: productId,
      razorpayRouteActivationStatus: activationStatus,
    },
  }).exec();

  return { activationStatus };
}
