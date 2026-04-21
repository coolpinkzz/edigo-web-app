/** Mirrors server `types/tenant.ts` / `Tenant.tenantType`. */
export type TenantType = "SCHOOL" | "ACADEMY";

/** Live fields from Razorpay GET /v2/accounts/:id (when fetch succeeds). */
export interface RazorpayLinkedAccountRemote {
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
}

/** Razorpay Route linked account summary (GET /auth/me, PATCH /auth/tenant). */
export interface RazorpayLinkedAccountSummary {
  linked: boolean;
  accountId?: string;
  status?: string;
  remote?: RazorpayLinkedAccountRemote;
}

/** Route product + settlement onboarding status (no bank data — server-only). */
export interface RazorpayRouteSummary {
  productConfigured: boolean;
  activationStatus?: string;
  payoutsReady: boolean;
}

/** GET /auth/me — JWT claims + tenant metadata. */
export interface AuthMeResponse {
  user: {
    userId: string;
    tenantId: string;
    role: string;
    phone: string;
    name?: string;
  };
  tenant: {
    name: string;
    tenantType: TenantType;
    /** Omitted on older API responses until session is refreshed. */
    razorpayLinkedAccount?: RazorpayLinkedAccountSummary;
    razorpayRoute?: RazorpayRouteSummary;
  };
}

/** PATCH /auth/tenant — updated tenant metadata. */
export interface PatchTenantResponse {
  tenant: {
    name: string;
    tenantType: TenantType;
    razorpayLinkedAccount?: RazorpayLinkedAccountSummary;
    razorpayRoute?: RazorpayRouteSummary;
  };
}

/** POST /auth/razorpay-linked-account — create Route linked account. */
export interface CreateRazorpayLinkedAccountBody {
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
  legalInfo: {
    pan: string;
    gst?: string;
  };
}

export interface CreateRazorpayLinkedAccountResponse {
  tenant: PatchTenantResponse["tenant"];
}

/** POST /auth/razorpay-route-settlements */
export interface RazorpayRouteSettlementsBody {
  tncAccepted: boolean;
  beneficiaryName: string;
  accountNumber: string;
  ifscCode: string;
}

export interface RazorpayRouteSettlementsResponse {
  tenant: PatchTenantResponse["tenant"];
}
