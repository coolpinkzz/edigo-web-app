import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import { Link, Navigate } from "react-router-dom";
import { useTenantSignup } from "../hooks/useTenantSignup";
import { STORAGE_ACCESS_TOKEN } from "../constants";
import { getErrorMessage } from "../utils";
import type { TenantSignupFormValues } from "../hooks/useTenantSignup";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function normalizeSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

export function OnboardingPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [showSignupKey, setShowSignupKey] = useState(false);
  const signupMutation = useTenantSignup();
  const token = localStorage.getItem(STORAGE_ACCESS_TOKEN);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<TenantSignupFormValues>({
    defaultValues: {
      tenantName: "",
      tenantSlug: "",
      tenantType: "SCHOOL",
      phone: "",
      password: "",
      name: "",
      signupApiKey: "",
      branches: [{ name: "" }],
    },
    mode: "onSubmit",
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "branches",
  });

  const tenantType = watch("tenantType");

  if (token) {
    return <Navigate to="/dashboard" replace />;
  }

  const onSubmit = (values: TenantSignupFormValues) => {
    const branches = values.branches
      ?.map((b) => ({
        name: (b.name ?? "").trim(),
      }))
      .filter((b) => b.name.length > 0);
    signupMutation.mutate({
      ...values,
      tenantSlug: normalizeSlug(values.tenantSlug),
      branches: branches?.length ? branches : undefined,
    });
  };

  const errorMessage =
    signupMutation.isError && signupMutation.error
      ? getErrorMessage(signupMutation.error)
      : null;

  return (
    <div className="flex min-h-full items-center justify-center bg-gradient-to-br from-background via-muted/60 to-secondary px-4 py-12">
      <div className="w-full max-w-lg rounded-2xl border border-card-border bg-card p-8 shadow-xl shadow-black/[0.08]">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Create your organization
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Register a new tenant and admin account. You will sign in with your
            phone and the URL slug you choose below.
          </p>
        </div>

        <form
          className="space-y-5"
          onSubmit={handleSubmit(onSubmit)}
          noValidate
        >
          <div>
            <label
              htmlFor="tenantName"
              className="mb-1.5 block text-sm font-medium text-foreground/80"
            >
              Organization name
            </label>
            <input
              id="tenantName"
              type="text"
              autoComplete="organization"
              placeholder="Springfield High"
              className="block w-full rounded-lg border border-border px-3 py-2 text-foreground shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
              {...register("tenantName", {
                required: "Organization name is required",
                minLength: { value: 2, message: "Enter at least 2 characters" },
              })}
            />
            {errors.tenantName && (
              <p className="mt-1 text-sm text-red-600" role="alert">
                {errors.tenantName.message}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="tenantSlug"
              className="mb-1.5 block text-sm font-medium text-foreground/80"
            >
              URL slug
            </label>
            <input
              id="tenantSlug"
              type="text"
              autoComplete="off"
              placeholder="springfield-high"
              className="block w-full rounded-lg border border-border px-3 py-2 font-mono text-sm text-foreground shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
              {...register("tenantSlug", {
                required: "URL slug is required",
                validate: (v) => {
                  const s = normalizeSlug(v);
                  if (s.length < 2) return "Use at least 2 characters";
                  if (!SLUG_PATTERN.test(s)) {
                    return "Use lowercase letters, numbers, and hyphens only";
                  }
                  return true;
                },
              })}
              onBlur={(e) => {
                const n = normalizeSlug(e.target.value);
                if (n) setValue("tenantSlug", n, { shouldValidate: true });
              }}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Used at login to identify your organization (e.g. subdomain or dev
              {" "}
              <code className="rounded bg-muted px-1 py-0.5">VITE_TENANT_SLUG</code>
              ).
            </p>
            {errors.tenantSlug && (
              <p className="mt-1 text-sm text-red-600" role="alert">
                {errors.tenantSlug.message}
              </p>
            )}
          </div>

          <div>
            <span className="mb-1.5 block text-sm font-medium text-foreground/80">
              Organization type
            </span>
            <div className="flex gap-3">
              {(
                [
                  ["SCHOOL", "School (classes & sections)"],
                  ["ACADEMY", "Academy (courses)"],
                ] as const
              ).map(([value, label]) => (
                <label
                  key={value}
                  className={`flex flex-1 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition ${
                    tenantType === value
                      ? "border-primary bg-primary/5 text-foreground"
                      : "border-border text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  <input
                    type="radio"
                    value={value}
                    className="sr-only"
                    {...register("tenantType")}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label
              htmlFor="name"
              className="mb-1.5 block text-sm font-medium text-foreground/80"
            >
              Your name
            </label>
            <input
              id="name"
              type="text"
              autoComplete="name"
              placeholder="Admin name"
              className="block w-full rounded-lg border border-border px-3 py-2 text-foreground shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
              {...register("name", {
                required: "Name is required",
                minLength: { value: 2, message: "Enter at least 2 characters" },
              })}
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-600" role="alert">
                {errors.name.message}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="phone"
              className="mb-1.5 block text-sm font-medium text-foreground/80"
            >
              Phone number
            </label>
            <input
              id="phone"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              placeholder="9876543210"
              className="block w-full rounded-lg border border-border px-3 py-2 text-foreground shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
              {...register("phone", {
                required: "Phone number is required",
                minLength: {
                  value: 8,
                  message: "Enter a valid phone number",
                },
              })}
            />
            {errors.phone && (
              <p className="mt-1 text-sm text-red-600" role="alert">
                {errors.phone.message}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block text-sm font-medium text-foreground/80"
            >
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                className="block w-full rounded-lg border border-border py-2 pr-10 pl-3 text-foreground shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
                {...register("password", {
                  required: "Password is required",
                  minLength: {
                    value: 6,
                    message: "Password must be at least 6 characters",
                  },
                })}
              />
              <button
                type="button"
                className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
              >
                {showPassword ? (
                  <EyeOff className="size-4" aria-hidden />
                ) : (
                  <Eye className="size-4" aria-hidden />
                )}
              </button>
            </div>
            {errors.password && (
              <p className="mt-1 text-sm text-red-600" role="alert">
                {errors.password.message}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="signupApiKey"
              className="mb-1.5 block text-sm font-medium text-foreground/80"
            >
              Signup access key
            </label>
            <div className="relative">
              <input
                id="signupApiKey"
                type={showSignupKey ? "text" : "password"}
                autoComplete="off"
                placeholder="If your server uses SIGNUP_API_KEY"
                className="block w-full rounded-lg border border-border py-2 pr-10 pl-3 font-mono text-sm text-foreground shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
                {...register("signupApiKey")}
              />
              <button
                type="button"
                className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => setShowSignupKey((v) => !v)}
                aria-label={showSignupKey ? "Hide key" : "Show key"}
                aria-pressed={showSignupKey}
              >
                {showSignupKey ? (
                  <EyeOff className="size-4" aria-hidden />
                ) : (
                  <Eye className="size-4" aria-hidden />
                )}
              </button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Required when the API has{" "}
              <code className="rounded bg-muted px-1 py-0.5">SIGNUP_API_KEY</code>{" "}
              set. Sent only to your server as header{" "}
              <code className="rounded bg-muted px-1 py-0.5">X-Signup-Key</code>.
            </p>
          </div>

          <div className="rounded-lg border border-border/80 bg-muted/30 p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-foreground/90">
                Campuses (optional)
              </span>
              <button
                type="button"
                onClick={() => append({ name: "" })}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10"
              >
                <Plus className="size-3.5" aria-hidden />
                Add row
              </button>
            </div>
            <p className="mb-3 text-xs text-muted-foreground">
              Create initial branch records if you use multiple locations.
            </p>
            <ul className="flex flex-col gap-2">
              {fields.map((field, index) => (
                <li key={field.id} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Branch name"
                    className="min-w-0 flex-1 rounded-lg border border-border px-3 py-2 text-sm text-foreground shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
                    {...register(`branches.${index}.name` as const)}
                  />
                  {fields.length > 1 && (
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="shrink-0 rounded-lg border border-border p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      aria-label="Remove campus"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {errorMessage && (
            <div
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
              role="alert"
            >
              {errorMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={signupMutation.isPending}
            className="flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {signupMutation.isPending ? (
              <span className="flex items-center gap-2">
                <span
                  className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"
                  aria-hidden
                />
                Creating organization…
              </span>
            ) : (
              "Create organization"
            )}
          </button>

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link
              to="/login"
              className="font-medium text-primary hover:underline"
            >
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
