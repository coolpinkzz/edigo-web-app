import bcrypt from "bcryptjs";
import { randomInt } from "crypto";
import { env } from "../../config/env";
import { Tenant } from "./tenant.model";
import { User } from "./user.model";
import { PasswordResetOtp } from "./password-reset-otp.model";
import { normalizePhone } from "../../utils/phone.util";
import { sendSms } from "../reminder/sms.service";
import { logger } from "../../utils/logger";

const LOG_SCOPE = "auth.passwordReset";

const PASSWORD_SALT_ROUNDS = 12;
/** Slightly lower cost than full password hashing; still slows brute force per guess. */
const OTP_BCRYPT_ROUNDS = 10;

const OTP_LENGTH = 6;
const OTP_TTL_MS = 5 * 60 * 1000;
const RESET_WINDOW_MS = 10 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

const GENERIC_REQUEST_MSG =
  "If an account exists for this organization, a verification code was sent.";
const GENERIC_VERIFY_FAIL = "Invalid or expired verification code.";
const GENERIC_RESET_FAIL = "Unable to reset password. Request a new code and try again.";

function assertStrongPassword(password: string): void {
  if (password.length < 8 || password.length > 128) {
    throw new Error(
      "Password must be between 8 and 128 characters",
    );
  }
  if (
    !/[a-z]/.test(password) ||
    !/[A-Z]/.test(password) ||
    !/\d/.test(password) ||
    !/[^A-Za-z0-9]/.test(password)
  ) {
    throw new Error(
      "Password must include uppercase, lowercase, a number, and a special character",
    );
  }
}

function generateNumericOtp(length: number): string {
  const min = 10 ** (length - 1);
  const max = 10 ** length - 1;
  return String(randomInt(min, max + 1));
}

async function resolveTenant(tenantSlug: string) {
  const tenant = await Tenant.findOne({
    slug: tenantSlug.toLowerCase(),
    isActive: true,
  });
  return tenant;
}

export async function requestPasswordResetOtp(input: {
  phone: string;
  tenantSlug: string;
}): Promise<{ message: string }> {
  const obfuscate = env.authObfuscatePhoneExists;

  const phone = normalizePhone(input.phone);
  if (!phone) {
    throw new Error("Invalid phone number");
  }

  const tenant = await resolveTenant(input.tenantSlug);
  if (!tenant) {
    if (obfuscate) {
      return { message: GENERIC_REQUEST_MSG };
    }
    throw new Error("Organization not found");
  }

  const user = await User.findOne({
    phone,
    tenantId: tenant._id,
    isActive: true,
  });

  if (!user) {
    if (obfuscate) {
      return { message: GENERIC_REQUEST_MSG };
    }
    throw new Error("No account found for this phone number");
  }

  await PasswordResetOtp.deleteMany({ phone, tenantId: tenant._id });

  const otp = generateNumericOtp(OTP_LENGTH);
  const otpHash = await bcrypt.hash(otp, OTP_BCRYPT_ROUNDS);
  const otpExpiresAt = new Date(Date.now() + OTP_TTL_MS);

  await PasswordResetOtp.create({
    phone,
    tenantId: tenant._id,
    otpHash,
    otpExpiresAt,
    attempts: 0,
    verified: false,
    resetExpiresAt: null,
    consumed: false,
  });

  const smsBody = `Edigo: Your password reset code is ${otp}. It expires in 5 minutes. Do not share this code.`;
  const smsResult = await sendSms(phone, smsBody);
  if (!smsResult.ok) {
    logger.warn(LOG_SCOPE, "OTP SMS failed", {
      phone: phone.slice(-4),
      error: smsResult.error,
    });
    await PasswordResetOtp.deleteMany({ phone, tenantId: tenant._id });
    throw new Error("Could not send verification code. Try again later.");
  }

  return { message: GENERIC_REQUEST_MSG };
}

export async function verifyPasswordResetOtp(input: {
  phone: string;
  tenantSlug: string;
  otp: string;
}): Promise<{ message: string }> {
  const phone = normalizePhone(input.phone);
  if (!phone) {
    throw new Error(GENERIC_VERIFY_FAIL);
  }

  const otpDigits = String(input.otp).replace(/\D/g, "");
  if (otpDigits.length !== OTP_LENGTH) {
    throw new Error(GENERIC_VERIFY_FAIL);
  }

  const tenant = await resolveTenant(input.tenantSlug);
  if (!tenant) {
    throw new Error(GENERIC_VERIFY_FAIL);
  }

  const row = await PasswordResetOtp.findOne({
    phone,
    tenantId: tenant._id,
    consumed: false,
  });

  if (!row || row.verified) {
    throw new Error(GENERIC_VERIFY_FAIL);
  }

  if (row.otpExpiresAt.getTime() < Date.now()) {
    throw new Error(GENERIC_VERIFY_FAIL);
  }

  if (row.attempts >= MAX_OTP_ATTEMPTS) {
    throw new Error("Too many incorrect attempts. Request a new code.");
  }

  const hash = row.otpHash;
  if (!hash) {
    throw new Error(GENERIC_VERIFY_FAIL);
  }

  const match = await bcrypt.compare(otpDigits, hash);
  if (!match) {
    row.attempts += 1;
    await row.save();
    throw new Error(GENERIC_VERIFY_FAIL);
  }

  await PasswordResetOtp.findByIdAndUpdate(row._id, {
    $set: {
      verified: true,
      resetExpiresAt: new Date(Date.now() + RESET_WINDOW_MS),
    },
    $unset: { otpHash: 1 },
  });

  return { message: "Code verified. You can set a new password." };
}

export async function resetPasswordAfterOtp(input: {
  phone: string;
  tenantSlug: string;
  newPassword: string;
}): Promise<{ message: string }> {
  assertStrongPassword(input.newPassword);

  const phone = normalizePhone(input.phone);
  if (!phone) {
    throw new Error(GENERIC_RESET_FAIL);
  }

  const tenant = await resolveTenant(input.tenantSlug);
  if (!tenant) {
    throw new Error(GENERIC_RESET_FAIL);
  }

  const row = await PasswordResetOtp.findOne({
    phone,
    tenantId: tenant._id,
    verified: true,
    consumed: false,
  });

  if (
    !row ||
    !row.resetExpiresAt ||
    row.resetExpiresAt.getTime() < Date.now()
  ) {
    throw new Error(GENERIC_RESET_FAIL);
  }

  const user = await User.findOne({
    phone,
    tenantId: tenant._id,
    isActive: true,
  }).select("+password");

  if (!user) {
    throw new Error(GENERIC_RESET_FAIL);
  }

  const hashed = await bcrypt.hash(input.newPassword, PASSWORD_SALT_ROUNDS);
  user.password = hashed;
  await user.save();

  await PasswordResetOtp.deleteMany({ phone, tenantId: tenant._id });

  return { message: "Password updated. You can sign in with your new password." };
}
