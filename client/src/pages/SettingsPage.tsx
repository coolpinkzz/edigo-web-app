import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { Check, ChevronDown, CircleAlert, Lock } from "lucide-react";
import {
  createRazorpayLinkedAccount,
  createRazorpayRouteSettlements,
  patchTenant,
  uploadTenantLogoAndGetUrl,
} from "../api";
import { Button, Card, Input, SelectField } from "../components/ui";
import {
  RAZORPAY_ROUTE_BUSINESS_CATEGORIES,
  RAZORPAY_ROUTE_DEFAULT_CATEGORY,
  RAZORPAY_ROUTE_DEFAULT_SUBCATEGORY,
  RAZORPAY_ROUTE_SUBCATEGORIES_BY_CATEGORY,
} from "../constants/razorpay-route-business-categories";
import { authMeQueryKey } from "../constants/query-keys";
import { useAuthSession } from "../hooks/useAuthSession";
import type {
  AuthMeResponse,
  CreateRazorpayLinkedAccountBody,
  RazorpayLinkedAccountSummary,
  RazorpayRouteSummary,
} from "../types";
import { cn } from "../lib/utils";
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
    contactName: "",
    businessType: "partnership",
    profile: {
      category: RAZORPAY_ROUTE_DEFAULT_CATEGORY,
      subcategory: RAZORPAY_ROUTE_DEFAULT_SUBCATEGORY,
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

/** Collapsible panel for onboarding subsections — button avoids nested forms. */
function AccordionSection({
  title,
  description,
  defaultOpen = false,
  children,
}: {
  title: string;
  description?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="overflow-hidden rounded-lg border border-card-border bg-background/90">
      <button
        type="button"
        aria-expanded={open}
        className={cn(
          "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40",
          open ? "border-b border-card-border" : "",
        )}
        onClick={() => setOpen((v) => !v)}
      >
        <ChevronDown
          className={cn(
            "mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
            open ? "rotate-180" : "rotate-0",
          )}
        />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-foreground">
            {title}
          </span>
          {description ? (
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {description}
            </span>
          ) : null}
        </span>
      </button>
      {/* Panels stay mounted (hidden when closed) so react-hook-form fields stay registered */}
      <div
        className={cn(
          "space-y-4 border-t border-card-border px-4 pb-4 pt-3",
          !open && "hidden",
        )}
        aria-hidden={!open}
      >
        {children}
      </div>
    </div>
  );
}

type Step1Badge = "active" | "done";
type Step2Badge = "locked" | "active" | "pending" | "done";

/** Horizontal two-step indicator for payouts (business → bank). */
function PayoutSetupStepper(props: { step1: Step1Badge; step2: Step2Badge }) {
  const step1Cls =
    props.step1 === "done"
      ? "border-emerald-600/70 bg-emerald-500/15 text-emerald-800 dark:text-emerald-200"
      : "border-primary bg-primary/10 text-primary ring-2 ring-primary/20";

  const step2Cls =
    props.step2 === "locked"
      ? "border border-dashed border-card-border bg-muted/30 text-muted-foreground"
      : props.step2 === "done"
        ? "border-emerald-600/70 bg-emerald-500/15 text-emerald-800 dark:text-emerald-200"
        : props.step2 === "active"
          ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/20"
          : "border-amber-500/60 bg-amber-500/10 text-foreground"; // pending

  const step2Sub =
    props.step2 === "locked"
      ? "After business details"
      : props.step2 === "active"
        ? "IFSC & account with Razorpay"
        : props.step2 === "pending"
          ? "Under review or waiting on Razorpay"
          : "Settlements ready";

  return (
    <nav
      aria-label="Payout setup progress"
      className="flex flex-col gap-4 sm:flex-row sm:items-stretch sm:gap-6"
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <div
          className={cn(
            "grid h-10 w-10 shrink-0 place-items-center rounded-full border text-sm font-semibold leading-none [&_svg]:block",
            step1Cls,
          )}
          aria-hidden
        >
          {props.step1 === "done" ? (
            <Check
              className="size-4.5 text-primary"
              strokeWidth={2.75}
              aria-hidden
            />
          ) : (
            <span className="tabular-nums">1</span>
          )}
        </div>
        <div className="min-w-0 pt-1">
          <p className="text-sm font-semibold text-foreground">
            Business details
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {props.step1 === "done"
              ? "Registered with Razorpay"
              : "Legal identity for payouts"}
          </p>
        </div>
      </div>

      <div
        className="hidden h-auto w-px shrink-0 self-stretch rounded-full bg-border sm:block sm:min-h-[52px]"
        aria-hidden
      />

      <div className="flex min-w-0 flex-1 items-start gap-3">
        <div
          className={cn(
            "grid h-10 w-10 shrink-0 place-items-center rounded-full border text-sm font-semibold leading-none [&_svg]:block",
            step2Cls,
          )}
          aria-hidden
        >
          {props.step2 === "locked" ? (
            <Lock className="size-[18px] opacity-80" aria-hidden />
          ) : props.step2 === "done" ? (
            <Check
              className="size-4.5 text-primary"
              strokeWidth={2.75}
              aria-hidden
            />
          ) : props.step2 === "pending" ? (
            <span aria-hidden className="text-xs font-bold leading-none">
              <CircleAlert className="size-4.5 text-amber-500" />
            </span>
          ) : (
            <span className="tabular-nums">2</span>
          )}
        </div>
        <div className="min-w-0 pt-1">
          <p className="text-sm font-semibold text-foreground">Bank payouts</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{step2Sub}</p>
        </div>
      </div>
    </nav>
  );
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

  const watchedProfileCategory = useWatch({
    control: linkedForm.control,
    name: "profile.category",
  });
  const razorpaySubcategoryOptions = useMemo(() => {
    if (!watchedProfileCategory?.trim()) return [];
    const list =
      RAZORPAY_ROUTE_SUBCATEGORIES_BY_CATEGORY[watchedProfileCategory];
    return list ? [...list] : [];
  }, [watchedProfileCategory]);

  useEffect(() => {
    if (razorpaySubcategoryOptions.length === 0) return;
    const cur = linkedForm.getValues("profile.subcategory");
    if (!razorpaySubcategoryOptions.some((o) => o.value === cur)) {
      linkedForm.setValue(
        "profile.subcategory",
        razorpaySubcategoryOptions[0].value,
        { shouldValidate: true },
      );
    }
  }, [linkedForm, razorpaySubcategoryOptions, watchedProfileCategory]);

  useEffect(() => {
    const name = sessionQuery.data?.tenant?.name;
    if (name !== undefined) {
      orgForm.reset({ name });
    }
  }, [sessionQuery.data?.tenant?.name, orgForm]);

  const orgMutation = useMutation({
    mutationFn: (body: { name?: string; logoUrl?: string | null }) =>
      patchTenant(body),
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

  const logoFileRef = useRef<HTMLInputElement>(null);
  const logoUploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const publicUrl = await uploadTenantLogoAndGetUrl(file);
      return patchTenant({ logoUrl: publicUrl });
    },
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

  const tenantLogoUrl = sessionQuery.data?.tenant?.logoUrl;
  const storagePending = orgMutation.isPending || logoUploadMutation.isPending;

  const onSubmitLinked = linkedForm.handleSubmit((values) => {
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
            street2: values.profile.addresses.registered.street2.trim(),
            city: values.profile.addresses.registered.city.trim(),
            state: values.profile.addresses.registered.state.trim(),
            postalCode: values.profile.addresses.registered.postalCode.trim(),
            country: values.profile.addresses.registered.country
              .trim()
              .toUpperCase(),
          },
        },
      },
      legalInfo: {
        pan: values.legalInfo.pan.trim().toUpperCase(),
      },
    };
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

  const rp: RazorpayLinkedAccountSummary = sessionQuery.data?.tenant
    ?.razorpayLinkedAccount ?? { linked: false };
  const razorpayLinked = Boolean(rp.linked);

  const route: RazorpayRouteSummary = sessionQuery.data?.tenant
    ?.razorpayRoute ?? {
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

  const payoutStep1: Step1Badge = razorpayLinked ? "done" : "active";
  const payoutStep2: Step2Badge = !razorpayLinked
    ? "locked"
    : route.payoutsReady
      ? "done"
      : showSettlementForm
        ? "active"
        : "pending";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-foreground">Organization</h2>
        <form onSubmit={onSubmitOrg} className="mt-4 space-y-4">
          <Input
            label="Organization name"
            {...orgForm.register("name", { required: true })}
            disabled={storagePending}
          />

          <div>
            <p className="mb-2 text-sm font-medium text-foreground/90">
              Organization logo
            </p>
            <div className="flex flex-wrap items-end gap-4">
              {tenantLogoUrl ? (
                <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-2">
                  <img
                    src={tenantLogoUrl}
                    alt=""
                    className="h-16 w-16 shrink-0 rounded-md border border-border bg-background object-contain"
                  />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No logo — a default mark is used in the sidebar.
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <input
                  ref={logoFileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) logoUploadMutation.mutate(f);
                  }}
                />
                <Button
                  type="button"
                  variant="secondary"
                  disabled={storagePending}
                  onClick={() => logoFileRef.current?.click()}
                >
                  {logoUploadMutation.isPending ? "Uploading…" : "Upload image"}
                </Button>
                {tenantLogoUrl && (
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={storagePending}
                    onClick={() => orgMutation.mutate({ logoUrl: null })}
                  >
                    {orgMutation.isPending ? "…" : "Remove logo"}
                  </Button>
                )}
              </div>
            </div>
            {logoUploadMutation.isError && (
              <p className="mt-2 text-sm text-red-600" role="alert">
                {getErrorMessage(logoUploadMutation.error)}
              </p>
            )}
          </div>

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
            {orgMutation.isPending ? "Saving…" : "Save name"}
          </Button>
        </form>
      </Card>

      <Card className="p-6">
        <div className="flex flex-wrap items-baseline gap-2">
          <h2 className="text-lg font-semibold text-foreground">
            Payouts & settlements
          </h2>
          <span className="rounded-md border border-card-border bg-muted/50 px-2 py-0.5 text-xs font-medium text-muted-foreground">
            Razorpay
          </span>
        </div>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Fee payments settle to your organization through Razorpay. Complete
          the business profile, then add your payout bank—Razorpay holds KYC &
          payout details securely. Route must be enabled on your merchant{" "}
          <a
            href="https://razorpay.com/docs/payments/route/linked-account/"
            target="_blank"
            rel="noreferrer noopener"
            className="font-medium text-primary underline underline-offset-2"
          >
            account
          </a>
          .
        </p>

        <div className="mt-6 rounded-xl border border-card-border bg-muted/30 p-4">
          <PayoutSetupStepper step1={payoutStep1} step2={payoutStep2} />
        </div>

        {!razorpayLinked ? (
          <form onSubmit={onSubmitLinked} className="mt-8 space-y-6">
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

            <div className="space-y-3">
              <AccordionSection
                title="Category & industry"
                description={
                  <span className="text-muted-foreground">
                    Matches Razorpay’s lists — see{" "}
                    <a
                      href="https://razorpay.com/docs/payments/route/integration-guide/#business-category"
                      target="_blank"
                      rel="noreferrer noopener"
                      className="font-medium text-primary underline underline-offset-2"
                    >
                      business category
                    </a>{" "}
                    &{" "}
                    <a
                      href="https://razorpay.com/docs/payments/route/integration-guide/#business-sub-category"
                      target="_blank"
                      rel="noreferrer noopener"
                      className="font-medium text-primary underline underline-offset-2"
                    >
                      business sub-category
                    </a>
                  </span>
                }
                defaultOpen
              >
                <div className="grid gap-4 sm:grid-cols-1 sm:gap-6 lg:grid-cols-2">
                  <Controller
                    name="profile.category"
                    control={linkedForm.control}
                    rules={{ required: true }}
                    render={({ field }) => (
                      <SelectField
                        label="Business category"
                        placeholder="Select category"
                        options={[...RAZORPAY_ROUTE_BUSINESS_CATEGORIES]}
                        value={field.value}
                        onValueChange={field.onChange}
                        onBlur={field.onBlur}
                        disabled={linkedMutation.isPending}
                        itemClassName="whitespace-normal leading-snug"
                      />
                    )}
                  />
                  <Controller
                    name="profile.subcategory"
                    control={linkedForm.control}
                    rules={{ required: true }}
                    render={({ field }) => (
                      <SelectField
                        label="Business sub-category"
                        placeholder={
                          watchedProfileCategory
                            ? "Select sub-category"
                            : "Select a category first"
                        }
                        options={razorpaySubcategoryOptions}
                        value={field.value}
                        onValueChange={field.onChange}
                        onBlur={field.onBlur}
                        disabled={
                          linkedMutation.isPending ||
                          razorpaySubcategoryOptions.length === 0
                        }
                        itemClassName="whitespace-normal leading-snug"
                      />
                    )}
                  />
                </div>
              </AccordionSection>

              <AccordionSection
                title="Registered address"
                description="Must match documents you may submit to Razorpay"
              >
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
                    label="Street line 2"
                    {...linkedForm.register(
                      "profile.addresses.registered.street2",
                      { required: true },
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
                        {
                          required: true,
                          maxLength: 2,
                          minLength: 2,
                        },
                      )}
                      disabled={linkedMutation.isPending}
                    />
                  </div>
                </div>
              </AccordionSection>

              <AccordionSection
                title="Tax IDs (India)"
                description="PAN for the legal entity"
              >
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Use the PAN issued to this legal entity. If verification
                  fails, try adjusting business type or the PAN used.{" "}
                  <a
                    href="https://razorpay.com/docs/api/payments/route/create-linked-account/"
                    target="_blank"
                    rel="noreferrer noopener"
                    className="font-medium text-primary underline underline-offset-2"
                  >
                    Razorpay docs
                  </a>
                </p>
                <div className="pt-2">
                  <Input
                    label="PAN"
                    {...linkedForm.register("legalInfo.pan", {
                      required: true,
                    })}
                    disabled={linkedMutation.isPending}
                  />
                </div>
              </AccordionSection>
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
                : "Continue to bank payouts"}
            </Button>
          </form>
        ) : (
          <div className="mt-8 space-y-6">
            <div className="rounded-lg border border-emerald-600/20 bg-emerald-500/8 px-4 py-4 text-sm dark:bg-emerald-500/10">
              <div className="flex w-full flex-wrap items-center gap-2">
                {rp.status ? (
                  <span className="min-w-0 grow text-xs font-medium capitalize text-foreground/90">
                    {rp.status.replace(/_/g, " ")}
                  </span>
                ) : (
                  <span className="grow" aria-hidden />
                )}
                <span className="inline-flex shrink-0 items-center rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white shadow-sm dark:bg-emerald-500">
                  Business verified
                </span>
              </div>
              <p className="mt-2 font-medium leading-snug text-foreground">
                {rp.remote?.legalBusinessName ??
                  "Your linked business account is on file with Razorpay."}
              </p>
              {rp.remote ? (
                <dl className="mt-4 space-y-1.5 text-xs text-muted-foreground">
                  {rp.remote.email ? (
                    <div className="flex flex-wrap gap-1">
                      <dt className="font-medium text-foreground/80">Email</dt>
                      <dd className="text-foreground">{rp.remote.email}</dd>
                    </div>
                  ) : null}
                  {rp.remote.contactName ? (
                    <div className="flex flex-wrap gap-1">
                      <dt className="font-medium text-foreground/80">
                        Contact
                      </dt>
                      <dd className="text-foreground">
                        {rp.remote.contactName}
                      </dd>
                    </div>
                  ) : null}
                </dl>
              ) : null}
            </div>

            {route.payoutsReady ? (
              <div className="rounded-lg border border-emerald-600/30 bg-emerald-500/10 px-4 py-3 text-sm text-foreground">
                <div className="flex w-full flex-wrap items-start gap-2">
                  <p className="min-w-0 grow font-medium leading-snug">
                    Payouts are active
                  </p>
                  <span className="inline-flex shrink-0 items-center rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-semibold capitalize text-white shadow-sm dark:bg-emerald-500">
                    {(activationStatus ?? "activated").replace(/_/g, " ")}
                  </span>
                </div>
              </div>
            ) : null}

            {settlementBlocked ? (
              <div
                className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm"
                role="status"
              >
                <p className="font-medium text-foreground">
                  Bank details under review
                </p>
                <p className="mt-1 text-muted-foreground">
                  Status:{" "}
                  <span className="font-medium capitalize text-foreground">
                    {activationStatus?.replace(/_/g, " ")}
                  </span>
                  . Razorpay may be reviewing information or temporarily locked
                  edits. Manage or follow up in the Razorpay Dashboard; you
                  cannot change bank details here until that clears.
                </p>
              </div>
            ) : null}

            {route.productConfigured &&
            !route.payoutsReady &&
            !settlementBlocked ? (
              <div
                className="rounded-lg border border-card-border bg-muted/40 px-4 py-3 text-sm"
                role="status"
              >
                <p className="font-medium text-foreground">
                  Payout banking on Razorpay
                </p>
                <p className="mt-1 text-muted-foreground">
                  Route is already configured for this workspace; settlement
                  bank details are managed in the Razorpay Dashboard (not
                  collected again here). Current status:{" "}
                  <span className="capitalize text-foreground">
                    {activationStatus ?? "pending"}
                  </span>
                  .
                </p>
              </div>
            ) : null}

            {showSettlementForm ? (
              <form onSubmit={onSubmitSettlement} className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Settlement bank account
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Enter the account Razorpay should pay out to (sent securely
                    to Razorpay; not stored here).
                  </p>
                </div>
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
                    I confirm our organization accepts Razorpay’s terms for
                    Route product configuration (including settlements).
                    Submitting sends these details to Razorpay only.
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
                    : "Save payout bank"}
                </Button>
              </form>
            ) : null}
          </div>
        )}
      </Card>
    </div>
  );
}
