import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  createRazorpayLinkedAccount,
  createRazorpayRouteSettlements,
  patchTenant,
} from "../api";
import { Button, Card, Input, SelectField } from "../components/ui";
import { authMeQueryKey } from "../constants/query-keys";
import { useAuthSession } from "../hooks/useAuthSession";
import type {
  AuthMeResponse,
  CreateRazorpayLinkedAccountBody,
  RazorpayLinkedAccountSummary,
  RazorpayRouteSummary,
} from "../types";
import { getErrorMessage } from "../utils";

type OrgFormValues = { name: string };

type SettlementFormValues = {
  beneficiaryName: string;
  accountNumber: string;
  ifscCode: string;
  tncAccepted: boolean;
};

const BUSINESS_TYPE_OPTIONS = [
  { value: "partnership", label: "Partnership" },
  { value: "proprietary", label: "Proprietary / sole proprietorship" },
  { value: "private_limited", label: "Private limited" },
  { value: "public_limited", label: "Public limited" },
  { value: "llp", label: "LLP" },
  { value: "trust", label: "Trust" },
  { value: "society", label: "Society" },
  { value: "educational_institutes", label: "Educational institute" },
  { value: "others", label: "Others" },
];

function defaultLinkedForm(): CreateRazorpayLinkedAccountBody {
  return {
    email: "",
    phone: "",
    legalBusinessName: "",
    customerFacingBusinessName: "",
    contactName: "",
    businessType: "partnership",
    profile: {
      category: "",
      subcategory: "",
      addresses: {
        registered: {
          street1: "",
          street2: "",
          city: "",
          state: "",
          postalCode: "",
          country: "IN",
        },
      },
    },
    legalInfo: {
      pan: "",
      gst: "",
    },
  };
}

function defaultSettlementForm(): SettlementFormValues {
  return {
    beneficiaryName: "",
    accountNumber: "",
    ifscCode: "",
    tncAccepted: false,
  };
}

/**
 * Tenant admins: organization name; two-step Razorpay Route onboarding (business, then settlement bank).
 */
export function SettingsPage() {
  const queryClient = useQueryClient();
  const sessionQuery = useAuthSession();
  const orgForm = useForm<OrgFormValues>({ defaultValues: { name: "" } });
  const linkedForm = useForm<CreateRazorpayLinkedAccountBody>({
    defaultValues: defaultLinkedForm(),
  });
  const settlementForm = useForm<SettlementFormValues>({
    defaultValues: defaultSettlementForm(),
  });

  useEffect(() => {
    const name = sessionQuery.data?.tenant?.name;
    if (name !== undefined) {
      orgForm.reset({ name });
    }
  }, [sessionQuery.data?.tenant?.name, orgForm]);

  const orgMutation = useMutation({
    mutationFn: patchTenant,
    onSuccess: (data) => {
      void queryClient.setQueryData(authMeQueryKey, (prev: unknown) => {
        if (!prev || typeof prev !== "object") return prev;
        const p = prev as AuthMeResponse;
        return {
          ...p,
          tenant: data.tenant,
        };
      });
    },
  });

  const linkedMutation = useMutation({
    mutationFn: createRazorpayLinkedAccount,
    onSuccess: (data) => {
      void queryClient.setQueryData(authMeQueryKey, (prev: unknown) => {
        if (!prev || typeof prev !== "object") return prev;
        const p = prev as AuthMeResponse;
        return {
          ...p,
          tenant: data.tenant,
        };
      });
    },
  });

  const settlementMutation = useMutation({
    mutationFn: createRazorpayRouteSettlements,
    onSuccess: (data) => {
      void queryClient.setQueryData(authMeQueryKey, (prev: unknown) => {
        if (!prev || typeof prev !== "object") return prev;
        const p = prev as AuthMeResponse;
        return {
          ...p,
          tenant: data.tenant,
        };
      });
    },
  });

  const onSubmitOrg = orgForm.handleSubmit((values) => {
    orgMutation.mutate({ name: values.name.trim() });
  });

  const onSubmitLinked = linkedForm.handleSubmit((values) => {
    const gst = values.legalInfo.gst?.trim();
    const payload: CreateRazorpayLinkedAccountBody = {
      email: values.email.trim(),
      phone: values.phone.trim(),
      legalBusinessName: values.legalBusinessName.trim(),
      contactName: values.contactName.trim(),
      businessType: values.businessType.trim(),
      profile: {
        category: values.profile.category.trim(),
        subcategory: values.profile.subcategory.trim(),
        addresses: {
          registered: {
            street1: values.profile.addresses.registered.street1.trim(),
            city: values.profile.addresses.registered.city.trim(),
            state: values.profile.addresses.registered.state.trim(),
            postalCode: values.profile.addresses.registered.postalCode.trim(),
            country: values.profile.addresses.registered.country
              .trim()
              .toUpperCase(),
            ...(values.profile.addresses.registered.street2?.trim()
              ? {
                  street2: values.profile.addresses.registered.street2.trim(),
                }
              : {}),
          },
        },
      },
      legalInfo: {
        pan: values.legalInfo.pan.trim().toUpperCase(),
        ...(gst ? { gst: gst.toUpperCase() } : {}),
      },
    };
    const cf = values.customerFacingBusinessName?.trim();
    if (cf) {
      payload.customerFacingBusinessName = cf;
    }
    linkedMutation.mutate(payload);
  });

  const onSubmitSettlement = settlementForm.handleSubmit((values) => {
    settlementMutation.mutate({
      tncAccepted: values.tncAccepted,
      beneficiaryName: values.beneficiaryName.trim(),
      accountNumber: values.accountNumber.trim(),
      ifscCode: values.ifscCode.trim().toUpperCase(),
    });
  });

  if (sessionQuery.isLoading) {
    return (
      <div className="mx-auto max-w-2xl">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (sessionQuery.isError) {
    return (
      <div className="mx-auto max-w-2xl">
        <p className="text-sm text-red-600" role="alert">
          Could not load settings.
        </p>
      </div>
    );
  }

  const rp: RazorpayLinkedAccountSummary =
    sessionQuery.data?.tenant?.razorpayLinkedAccount ?? { linked: false };
  const razorpayLinked = Boolean(rp.linked);

  const route: RazorpayRouteSummary =
    sessionQuery.data?.tenant?.razorpayRoute ?? {
      productConfigured: false,
      payoutsReady: false,
    };

  const activationStatus = route.activationStatus;
  const settlementBlocked =
    activationStatus === "under_review" || activationStatus === "suspended";
  /** Step 2 bank form only when Route product is not already stored on the tenant (`razorpayRouteProductId`). */
  const showSettlementForm =
    razorpayLinked &&
    !route.productConfigured &&
    !route.payoutsReady &&
    !settlementBlocked;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <p className="text-sm text-muted-foreground">
        The organization name appears in the app header for everyone in your
        workspace. Your sign-in URL (tenant slug) is not changed here.
      </p>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-foreground">Organization</h2>
        <form onSubmit={onSubmitOrg} className="mt-4 space-y-4">
          <Input
            label="Organization name"
            {...orgForm.register("name", { required: true })}
            disabled={orgMutation.isPending}
          />
          {orgMutation.isError && (
            <p className="text-sm text-red-600" role="alert">
              {getErrorMessage(orgMutation.error)}
            </p>
          )}
          <Button
            type="submit"
            variant="primary"
            disabled={orgMutation.isPending}
          >
            {orgMutation.isPending ? "Saving…" : "Save"}
          </Button>
        </form>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-foreground">
          Razorpay Route onboarding
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Two steps: (1) business linked account, (2) settlement bank account
          sent to Razorpay only—nothing is stored in our database. Requires Route
          on your merchant account.{" "}
          <a
            href="https://razorpay.com/docs/payments/route/linked-account/"
            target="_blank"
            rel="noreferrer noopener"
            className="text-primary underline underline-offset-2"
          >
            Linked accounts
          </a>
        </p>

        <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
          <li>
            <span className="text-foreground">Business profile</span> — create
            the linked account
          </li>
          <li>
            <span className="text-foreground">Settlement account</span> — IFSC &
            account for Route payouts
          </li>
        </ol>

        {!razorpayLinked ? (
          <form onSubmit={onSubmitLinked} className="mt-6 space-y-6">
            <p className="text-sm font-medium text-foreground">Step 1 of 2</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Business email"
                type="email"
                autoComplete="email"
                {...linkedForm.register("email", { required: true })}
                disabled={linkedMutation.isPending}
              />
              <Input
                label="Business phone"
                placeholder="10–15 digits"
                autoComplete="tel"
                {...linkedForm.register("phone", { required: true })}
                disabled={linkedMutation.isPending}
              />
            </div>
            <Input
              label="Legal business name"
              {...linkedForm.register("legalBusinessName", { required: true })}
              disabled={linkedMutation.isPending}
            />
            <Input
              label="Customer-facing business name (optional)"
              {...linkedForm.register("customerFacingBusinessName")}
              disabled={linkedMutation.isPending}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Contact person name"
                {...linkedForm.register("contactName", { required: true })}
                disabled={linkedMutation.isPending}
              />
              <Controller
                name="businessType"
                control={linkedForm.control}
                rules={{ required: true }}
                render={({ field }) => (
                  <SelectField
                    label="Business type"
                    placeholder="Select type"
                    options={[...BUSINESS_TYPE_OPTIONS]}
                    value={field.value}
                    onValueChange={field.onChange}
                    onBlur={field.onBlur}
                    disabled={linkedMutation.isPending}
                  />
                )}
              />
            </div>

            <div>
              <p className="mb-3 text-sm font-medium text-foreground/90">
                Business profile
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Category"
                  placeholder="e.g. education"
                  {...linkedForm.register("profile.category", {
                    required: true,
                  })}
                  disabled={linkedMutation.isPending}
                />
                <Input
                  label="Subcategory"
                  placeholder="e.g. school"
                  {...linkedForm.register("profile.subcategory", {
                    required: true,
                  })}
                  disabled={linkedMutation.isPending}
                />
              </div>
            </div>

            <div>
              <p className="mb-3 text-sm font-medium text-foreground/90">
                Registered address
              </p>
              <div className="space-y-4">
                <Input
                  label="Street line 1"
                  {...linkedForm.register(
                    "profile.addresses.registered.street1",
                    { required: true },
                  )}
                  disabled={linkedMutation.isPending}
                />
                <Input
                  label="Street line 2 (optional)"
                  {...linkedForm.register(
                    "profile.addresses.registered.street2",
                  )}
                  disabled={linkedMutation.isPending}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="City"
                    {...linkedForm.register(
                      "profile.addresses.registered.city",
                      { required: true },
                    )}
                    disabled={linkedMutation.isPending}
                  />
                  <Input
                    label="State"
                    {...linkedForm.register(
                      "profile.addresses.registered.state",
                      { required: true },
                    )}
                    disabled={linkedMutation.isPending}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Postal code"
                    {...linkedForm.register(
                      "profile.addresses.registered.postalCode",
                      { required: true },
                    )}
                    disabled={linkedMutation.isPending}
                  />
                  <Input
                    label="Country (ISO code)"
                    maxLength={2}
                    {...linkedForm.register(
                      "profile.addresses.registered.country",
                      { required: true, maxLength: 2, minLength: 2 },
                    )}
                    disabled={linkedMutation.isPending}
                  />
                </div>
              </div>
            </div>

            <div>
              <p className="mb-3 text-sm font-medium text-foreground/90">
                Tax IDs (India)
              </p>
              <p className="mb-3 text-xs text-muted-foreground leading-relaxed">
                Use the PAN issued to this legal entity. If Razorpay rejects the
                combination of PAN and business type, adjust the business type (e.g.
                company → Private/Public limited) or use the PAN that matches the
                entity. See{" "}
                <a
                  href="https://razorpay.com/docs/api/payments/route/create-linked-account/"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-primary underline underline-offset-2"
                >
                  Create a Linked Account
                </a>
                .
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="PAN"
                  {...linkedForm.register("legalInfo.pan", { required: true })}
                  disabled={linkedMutation.isPending}
                />
                <Input
                  label="GST (optional)"
                  {...linkedForm.register("legalInfo.gst")}
                  disabled={linkedMutation.isPending}
                />
              </div>
            </div>

            {linkedMutation.isError && (
              <p className="text-sm text-red-600" role="alert">
                {getErrorMessage(linkedMutation.error)}
              </p>
            )}

            <Button
              type="submit"
              variant="primary"
              disabled={linkedMutation.isPending}
            >
              {linkedMutation.isPending
                ? "Submitting…"
                : "Continue — create linked account"}
            </Button>
          </form>
        ) : (
          <div className="mt-6 space-y-6">
            <div className="rounded-lg border border-card-border bg-muted/40 px-4 py-3 text-sm">
              <p className="font-medium text-foreground">
                Step 1 complete — Linked account
              </p>
              {rp.accountId ? (
                <p className="mt-1 text-muted-foreground">
                  Account ID:{" "}
                  <span className="font-mono text-foreground">{rp.accountId}</span>
                </p>
              ) : null}
              {rp.status ? (
                <p className="mt-1 text-muted-foreground">
                  Account status:{" "}
                  <span className="text-foreground">{rp.status}</span>
                </p>
              ) : null}
              {rp.remote ? (
                <div className="mt-3 space-y-1.5 border-t border-card-border pt-3 text-xs">
                  <p className="font-medium text-foreground/80">
                    From Razorpay{" "}
                    <a
                      href="https://razorpay.com/docs/api/payments/route/fetch-with-id"
                      target="_blank"
                      rel="noreferrer noopener"
                      className="font-normal text-primary underline underline-offset-2"
                    >
                      (live)
                    </a>
                  </p>
                  {rp.remote.legalBusinessName ? (
                    <p className="text-muted-foreground">
                      Legal name:{" "}
                      <span className="text-foreground">
                        {rp.remote.legalBusinessName}
                      </span>
                    </p>
                  ) : null}
                  {rp.remote.businessType ? (
                    <p className="text-muted-foreground">
                      Business type:{" "}
                      <span className="font-mono text-foreground">
                        {rp.remote.businessType}
                      </span>
                    </p>
                  ) : null}
                  {rp.remote.email ? (
                    <p className="text-muted-foreground">
                      Email:{" "}
                      <span className="text-foreground">{rp.remote.email}</span>
                    </p>
                  ) : null}
                  {rp.remote.contactName ? (
                    <p className="text-muted-foreground">
                      Contact:{" "}
                      <span className="text-foreground">
                        {rp.remote.contactName}
                      </span>
                    </p>
                  ) : null}
                  {rp.remote.category || rp.remote.subcategory ? (
                    <p className="text-muted-foreground">
                      Category:{" "}
                      <span className="text-foreground">
                        {[rp.remote.category, rp.remote.subcategory]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>

            {route.payoutsReady ? (
              <div className="rounded-lg border border-emerald-600/30 bg-emerald-500/10 px-4 py-3 text-sm text-foreground">
                <p className="font-medium">Step 2 complete — Route settlements</p>
                <p className="mt-1 text-muted-foreground">
                  Activation:{" "}
                  <span className="text-foreground">
                    {activationStatus ?? "activated"}
                  </span>
                  . Payout configuration is ready on Razorpay’s side.
                </p>
              </div>
            ) : null}

            {settlementBlocked ? (
              <div
                className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm"
                role="status"
              >
                <p className="font-medium text-foreground">
                  Settlement details with Razorpay
                </p>
                <p className="mt-1 text-muted-foreground">
                  Status:{" "}
                  <span className="font-medium text-foreground">
                    {activationStatus}
                  </span>
                  . Razorpay is reviewing or has locked edits. Check the Razorpay
                  Dashboard or wait for their update; you cannot change bank
                  details here until that clears.
                </p>
              </div>
            ) : null}

            {route.productConfigured && !route.payoutsReady && !settlementBlocked ? (
              <div
                className="rounded-lg border border-card-border bg-muted/40 px-4 py-3 text-sm"
                role="status"
              >
                <p className="font-medium text-foreground">
                  Route product configured
                </p>
                <p className="mt-1 text-muted-foreground">
                  A Route product is already linked to this workspace. Settlement
                  bank details are managed in the Razorpay Dashboard; this app does
                  not collect step 2 here. Activation:{" "}
                  <span className="text-foreground">
                    {activationStatus ?? "pending"}
                  </span>
                  .
                </p>
              </div>
            ) : null}

            {showSettlementForm ? (
              <form onSubmit={onSubmitSettlement} className="space-y-4">
                <p className="text-sm font-medium text-foreground">Step 2 of 2</p>
                <p className="text-sm text-muted-foreground">
                  Bank details are transmitted to Razorpay only and are not stored
                  in this app.
                </p>
                <Input
                  label="Beneficiary name (as per bank)"
                  autoComplete="name"
                  {...settlementForm.register("beneficiaryName", {
                    required: true,
                  })}
                  disabled={settlementMutation.isPending}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Bank account number"
                    inputMode="numeric"
                    autoComplete="off"
                    {...settlementForm.register("accountNumber", {
                      required: true,
                    })}
                    disabled={settlementMutation.isPending}
                  />
                  <Input
                    label="IFSC code"
                    maxLength={11}
                    autoCapitalize="characters"
                    {...settlementForm.register("ifscCode", { required: true })}
                    disabled={settlementMutation.isPending}
                  />
                </div>
                <label className="flex cursor-pointer items-start gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    className="mt-1 rounded border-card-border"
                    {...settlementForm.register("tncAccepted", {
                      validate: (v) =>
                        v === true ||
                        "You must accept Razorpay Route terms to continue",
                    })}
                    disabled={settlementMutation.isPending}
                  />
                  <span>
                    I confirm our organization accepts Razorpay’s terms for Route
                    product configuration (including settlements). Submitting sends
                    these details to Razorpay only.
                  </span>
                </label>
                {settlementForm.formState.errors.tncAccepted ? (
                  <p className="text-sm text-red-600" role="alert">
                    {settlementForm.formState.errors.tncAccepted.message}
                  </p>
                ) : null}

                {settlementMutation.isError && (
                  <p className="text-sm text-red-600" role="alert">
                    {getErrorMessage(settlementMutation.error)}
                  </p>
                )}

                <Button
                  type="submit"
                  variant="primary"
                  disabled={settlementMutation.isPending}
                >
                  {settlementMutation.isPending
                    ? "Submitting…"
                    : "Submit settlement details"}
                </Button>
              </form>
            ) : null}
          </div>
        )}
      </Card>
    </div>
  );
}
