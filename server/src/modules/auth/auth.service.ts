import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Tenant } from "./tenant.model";
import { User } from "./user.model";
import { env } from "../../config/env";
import { JwtPayload } from "../../types/express";
import { ROLES, Role } from "../../types/roles";
import { normalizePhone } from "../../utils/phone.util";
import { logger } from "../../utils/logger";
import { TenantType } from "../../types/tenant";
import { sendSms } from "../reminder/sms.service";

const SALT_ROUNDS = 12;
const LOG_SCOPE = "auth.invite";

export interface SignupInput {
  /** For new tenant: org name. Creates tenant + admin user. */
  tenantName: string;
  tenantSlug: string;
  /** SCHOOL vs ACADEMY — used for class/section vs course-oriented UI. */
  tenantType: TenantType;
  phone: string;
  password: string;
  name: string;
}

export interface LoginInput {
  phone: string;
  password: string;
  /** Required for multi-tenant: identifies which org to login into */
  tenantSlug: string;
}

export interface AuthResult {
  token: string;
  user: {
    id: string;
    phone: string;
    name: string;
    tenantId: string;
    role: Role;
    tenantType: TenantType;
  };
}

/**
 * Signup: creates a new tenant with an admin user.
 */
export async function signup(input: SignupInput): Promise<AuthResult> {
  const phone = normalizePhone(input.phone);
  if (!phone) {
    throw new Error("Invalid phone number");
  }

  const existing = await Tenant.findOne({ slug: input.tenantSlug });
  if (existing) {
    throw new Error("Tenant slug already exists");
  }

  const tenant = await Tenant.create({
    name: input.tenantName,
    slug: input.tenantSlug.toLowerCase(),
    tenantType: input.tenantType,
    isActive: true,
  });

  const hashedPassword = await bcrypt.hash(input.password, SALT_ROUNDS);
  const user = await User.create({
    phone,
    password: hashedPassword,
    name: input.name,
    tenantId: tenant._id,
    role: ROLES.TENANT_ADMIN,
    isActive: true,
  });

  const payload: JwtPayload = {
    userId: user._id.toString(),
    tenantId: tenant._id.toString(),
    role: user.role as Role,
    phone: user.phone,
    name: user.name,
  };

  const token = jwt.sign(payload, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn as string,
  } as jwt.SignOptions);

  return {
    token,
    user: {
      id: user._id.toString(),
      phone: user.phone,
      name: user.name,
      tenantId: tenant._id.toString(),
      role: user.role as Role,
      tenantType: tenant.tenantType,
    },
  };
}

/**
 * Login: authenticates user within a tenant.
 */
export async function login(input: LoginInput): Promise<AuthResult> {
  const phone = normalizePhone(input.phone);
  if (!phone) {
    throw new Error("Invalid tenant or credentials");
  }

  const tenant = await Tenant.findOne({
    slug: input.tenantSlug.toLowerCase(),
    isActive: true,
  });
  if (!tenant) {
    throw new Error("Invalid tenant or credentials");
  }

  const user = await User.findOne({
    phone,
    tenantId: tenant._id,
    isActive: true,
  }).select("+password");

  if (!user || !(await bcrypt.compare(input.password, user.password))) {
    throw new Error("Invalid tenant or credentials");
  }

  const payload: JwtPayload = {
    userId: user._id.toString(),
    tenantId: tenant._id.toString(),
    role: user.role as Role,
    phone: user.phone,
    name: user.name,
  };

  const token = jwt.sign(payload, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn as string,
  } as jwt.SignOptions);

  return {
    token,
    user: {
      id: user._id.toString(),
      phone: user.phone,
      name: user.name,
      tenantId: tenant._id.toString(),
      role: user.role as Role,
      tenantType: tenant.tenantType ?? "SCHOOL",
    },
  };
}

/**
 * Invite user to existing tenant (for tenant admins).
 */
export interface InviteUserInput {
  phone: string;
  name: string;
  role: Role;
  tenantId: string;
  inviterUserId: string;
}

export async function inviteUser(
  input: InviteUserInput,
): Promise<{ id: string; phone: string; temporaryPassword: string }> {
  const phone = normalizePhone(input.phone);
  if (!phone) {
    throw new Error("Invalid phone number");
  }

  const existing = await User.findOne({
    phone,
    tenantId: input.tenantId,
  });
  if (existing) {
    throw new Error("User already exists in this tenant");
  }

  const tempPassword = Math.random().toString(36).slice(-10);
  const hashedPassword = await bcrypt.hash(tempPassword, SALT_ROUNDS);

  const user = await User.create({
    phone,
    password: hashedPassword,
    name: input.name,
    tenantId: input.tenantId,
    role: input.role,
    isActive: true,
  });

  const tenantDoc = await Tenant.findById(input.tenantId).select("name").lean();
  const orgName =
    typeof tenantDoc?.name === "string" ? tenantDoc.name : "your organization";
  const loginHint = env.clientAppUrl
    ? ` ${env.clientAppUrl}/login`
    : "";
  const smsBody = `EduRapid: Your account for ${orgName} is ready.${loginHint} Sign in with your phone number. Temporary password: ${tempPassword}`;

  const smsResult = await sendSms(user.phone, smsBody);
  if (!smsResult.ok) {
    logger.warn(LOG_SCOPE, "SMS not sent for new user", {
      userId: user._id.toString(),
      error: smsResult.error,
    });
  }

  return {
    id: user._id.toString(),
    phone: user.phone,
    temporaryPassword: tempPassword,
  };
}
