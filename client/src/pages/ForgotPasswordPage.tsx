import { useState } from "react";
import { useForm } from "react-hook-form";
import { Eye, EyeOff } from "lucide-react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import {
  requestPasswordResetOtp,
  resetPasswordAfterOtp,
  verifyPasswordResetOtp,
} from "../api/auth.api";
import { STORAGE_ACCESS_TOKEN } from "../constants";
import { getErrorMessage } from "../utils";

type Step = 1 | 2 | 3;

interface PhoneForm {
  phone: string;
}

interface OtpForm {
  otp: string;
}

interface NewPasswordForm {
  newPassword: string;
  confirmPassword: string;
}

const STRONG_PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/;

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const token = localStorage.getItem(STORAGE_ACCESS_TOKEN);
  const [step, setStep] = useState<Step>(1);
  const [phone, setPhone] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const phoneForm = useForm<PhoneForm>({
    defaultValues: { phone: "" },
    mode: "onSubmit",
  });

  const otpForm = useForm<OtpForm>({
    defaultValues: { otp: "" },
    mode: "onSubmit",
  });

  const passwordForm = useForm<NewPasswordForm>({
    defaultValues: { newPassword: "", confirmPassword: "" },
    mode: "onSubmit",
  });

  const requestMutation = useMutation({
    mutationFn: (p: string) => requestPasswordResetOtp({ phone: p }),
    onSuccess: (_, p) => {
      setPhone(p);
      setStep(2);
      otpForm.reset({ otp: "" });
    },
  });

  const verifyMutation = useMutation({
    mutationFn: (otp: string) => verifyPasswordResetOtp({ phone, otp }),
    onSuccess: () => {
      setStep(3);
      passwordForm.reset({ newPassword: "", confirmPassword: "" });
    },
  });

  const resetMutation = useMutation({
    mutationFn: (newPassword: string) =>
      resetPasswordAfterOtp({ phone, newPassword }),
    onSuccess: () => {
      navigate("/login", { replace: true, state: { passwordReset: true } });
    },
  });

  if (token) {
    return <Navigate to="/dashboard" replace />;
  }

  const onPhoneSubmit = (values: PhoneForm) => {
    requestMutation.mutate(values.phone.trim());
  };

  const onOtpSubmit = (values: OtpForm) => {
    verifyMutation.mutate(values.otp);
  };

  const onPasswordSubmit = (values: NewPasswordForm) => {
    if (values.newPassword !== values.confirmPassword) {
      passwordForm.setError("confirmPassword", {
        type: "manual",
        message: "Passwords do not match",
      });
      return;
    }
    resetMutation.mutate(values.newPassword);
  };

  const errorForStep =
    step === 1
      ? requestMutation.isError && requestMutation.error
        ? getErrorMessage(requestMutation.error)
        : null
      : step === 2
        ? verifyMutation.isError && verifyMutation.error
          ? getErrorMessage(verifyMutation.error)
          : requestMutation.isError && requestMutation.error
            ? getErrorMessage(requestMutation.error)
            : null
        : resetMutation.isError && resetMutation.error
          ? getErrorMessage(resetMutation.error)
          : null;

  const pending =
    step === 1
      ? requestMutation.isPending
      : step === 2
        ? verifyMutation.isPending
        : resetMutation.isPending;

  return (
    <div className="flex min-h-full items-center justify-center bg-gradient-to-br from-background via-muted/60 to-secondary px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-card-border bg-card p-8 shadow-xl shadow-black/[0.08]">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {step === 1 && "Reset password"}
            {step === 2 && "Enter verification code"}
            {step === 3 && "Choose a new password"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {step === 1 &&
              "We’ll send a code to your phone if this account exists."}
            {step === 2 && "Enter the 6-digit code from your SMS."}
            {step === 3 && "Use a strong password you have not used elsewhere."}
          </p>
        </div>

        {step === 1 && (
          <form
            className="space-y-5"
            onSubmit={phoneForm.handleSubmit(onPhoneSubmit)}
            noValidate
          >
            <div>
              <label
                htmlFor="fp-phone"
                className="mb-1.5 block text-sm font-medium text-foreground/80"
              >
                Phone number
              </label>
              <input
                id="fp-phone"
                type="tel"
                autoComplete="tel"
                inputMode="tel"
                placeholder="9876543210"
                className="block w-full rounded-lg border border-border px-3 py-2 text-foreground shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
                {...phoneForm.register("phone", {
                  required: "Phone number is required",
                  minLength: {
                    value: 8,
                    message: "Enter a valid phone number",
                  },
                })}
              />
              {phoneForm.formState.errors.phone && (
                <p className="mt-1 text-sm text-red-600" role="alert">
                  {phoneForm.formState.errors.phone.message}
                </p>
              )}
            </div>

            {errorForStep && (
              <div
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
                role="alert"
              >
                {errorForStep}
              </div>
            )}

            <button
              type="submit"
              disabled={pending}
              className="flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? (
                <span className="flex items-center gap-2">
                  <span
                    className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"
                    aria-hidden
                  />
                  Sending…
                </span>
              ) : (
                "Send code"
              )}
            </button>

            <p className="text-center text-sm text-muted-foreground">
              <Link
                to="/login"
                className="font-medium text-primary hover:underline"
              >
                Back to sign in
              </Link>
            </p>
          </form>
        )}

        {step === 2 && (
          <form
            className="space-y-5"
            onSubmit={otpForm.handleSubmit(onOtpSubmit)}
            noValidate
          >
            <div>
              <label
                htmlFor="fp-otp"
                className="mb-1.5 block text-sm font-medium text-foreground/80"
              >
                Verification code
              </label>
              <input
                id="fp-otp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="000000"
                className="block w-full rounded-lg border border-border px-3 py-2 text-center font-mono text-lg tracking-[0.3em] text-foreground shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
                {...otpForm.register("otp", {
                  required: "Code is required",
                  setValueAs: (v) =>
                    String(v ?? "")
                      .replace(/\D/g, "")
                      .slice(0, 6),
                  validate: (v) =>
                    v.length === 6 || "Enter the 6-digit code",
                })}
              />
              {otpForm.formState.errors.otp && (
                <p className="mt-1 text-sm text-red-600" role="alert">
                  {otpForm.formState.errors.otp.message}
                </p>
              )}
            </div>

            {errorForStep && (
              <div
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
                role="alert"
              >
                {errorForStep}
              </div>
            )}

            <button
              type="submit"
              disabled={pending}
              className="flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? (
                <span className="flex items-center gap-2">
                  <span
                    className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"
                    aria-hidden
                  />
                  Verifying…
                </span>
              ) : (
                "Verify code"
              )}
            </button>

            <div className="flex flex-col gap-2 text-center text-sm">
              <button
                type="button"
                className="font-medium text-primary hover:underline disabled:opacity-50"
                disabled={requestMutation.isPending}
                onClick={() => requestMutation.mutate(phone)}
              >
                Resend code
              </button>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => {
                  phoneForm.reset({ phone });
                  setStep(1);
                  verifyMutation.reset();
                  otpForm.reset({ otp: "" });
                }}
              >
                Use a different number
              </button>
            </div>
          </form>
        )}

        {step === 3 && (
          <form
            className="space-y-5"
            onSubmit={passwordForm.handleSubmit(onPasswordSubmit)}
            noValidate
          >
            <div>
              <label
                htmlFor="fp-new"
                className="mb-1.5 block text-sm font-medium text-foreground/80"
              >
                New password
              </label>
              <div className="relative">
                <input
                  id="fp-new"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  className="block w-full rounded-lg border border-border py-2 pr-10 pl-3 text-foreground shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
                  {...passwordForm.register("newPassword", {
                    required: "Password is required",
                    minLength: {
                      value: 8,
                      message: "Password must be at least 8 characters",
                    },
                    maxLength: {
                      value: 128,
                      message: "Password must be at most 128 characters",
                    },
                    validate: (v) =>
                      STRONG_PASSWORD_REGEX.test(v) ||
                      "Include uppercase, lowercase, a number, and a special character",
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
              {passwordForm.formState.errors.newPassword && (
                <p className="mt-1 text-sm text-red-600" role="alert">
                  {passwordForm.formState.errors.newPassword.message}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="fp-confirm"
                className="mb-1.5 block text-sm font-medium text-foreground/80"
              >
                Confirm password
              </label>
              <div className="relative">
                <input
                  id="fp-confirm"
                  type={showConfirm ? "text" : "password"}
                  autoComplete="new-password"
                  className="block w-full rounded-lg border border-border py-2 pr-10 pl-3 text-foreground shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
                  {...passwordForm.register("confirmPassword", {
                    required: "Confirm your password",
                  })}
                />
                <button
                  type="button"
                  className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => setShowConfirm((v) => !v)}
                  aria-label={showConfirm ? "Hide password" : "Show password"}
                  aria-pressed={showConfirm}
                >
                  {showConfirm ? (
                    <EyeOff className="size-4" aria-hidden />
                  ) : (
                    <Eye className="size-4" aria-hidden />
                  )}
                </button>
              </div>
              {passwordForm.formState.errors.confirmPassword && (
                <p className="mt-1 text-sm text-red-600" role="alert">
                  {passwordForm.formState.errors.confirmPassword.message}
                </p>
              )}
            </div>

            {errorForStep && (
              <div
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
                role="alert"
              >
                {errorForStep}
              </div>
            )}

            <button
              type="submit"
              disabled={pending}
              className="flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? (
                <span className="flex items-center gap-2">
                  <span
                    className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"
                    aria-hidden
                  />
                  Updating…
                </span>
              ) : (
                "Update password"
              )}
            </button>

            <p className="text-center text-sm text-muted-foreground">
              <Link
                to="/login"
                className="font-medium text-primary hover:underline"
              >
                Back to sign in
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
