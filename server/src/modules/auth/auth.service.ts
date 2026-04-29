import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { Branch } from "../branch/branch.model";
import { createBranchesForTenant } from "../branch/branch.service";
import { Tenant } from "./tenant.model";
import { User, IUser } from "./user.model";
import { env } from "../../config/env";
import { JwtPayload } from "../../types/express";
import { ROLES, Role } from "../../types/roles";
import { normalizePhone } from "../../utils/phone.util";
import { logger } from "../../utils/logger";
import { TenantType } from "../../types/tenant";
import { sendSms } from "../reminder/sms.service";

const SALT_ROUNDS = 12;
const LOG_SCOPE = "auth.invite";

function signAccessToken(payload: JwtPayload): string {
  if (!env.jwtSecret) {
    throw new Error("JWT_SECRET is not configured");
  }
  const options: jwt.SignOptions = {};
  if (env.jwtExpiresIn) {
    options.expiresIn = env.jwtExpiresIn as jwt.SignOptions["expiresIn"];
  }
  return jwt.sign(payload, env.jwtSecret, options);
}

function userBranchIdsForJwt(
  user: Pick<IUser, "branchIds">,
): string[] | undefined {
  const ids = user.branchIds?.filter(
    (id) => typeof id === "string" && id.length === 24,
  );
  if (!ids?.length) {
    return undefined;
  }
  return ids;
}

function buildJwtPayload(user: IUser, tenantIdStr: string): JwtPayload {
  const payload: JwtPayload = {
    userId: user._id.toString(),
    tenantId: tenantIdStr,
    role: user.role as Role,
    phone: user.phone,
    name: user.name,
  };
  const b = userBranchIdsForJwt(user);
  if (b?.length) {
    payload.branchIds = b;
  }
  return payload;
}

export interface SignupBranchInput {
  name: string;
  code?: string;
  address?: string;
}

export interface SignupInput {
  /** For new tenant: org name. Creates tenant + admin user. */
  tenantName: string;
  tenantSlug: string;
  /** SCHOOL vs ACADEMY — used for class/section vs course-oriented UI. */
  tenantType: TenantType;
  phone: string;
  password: string;
  name: string;
  /** Optional campuses created after the tenant. */
  branches?: SignupBranchInput[];
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
    /** Present when the user is restricted to specific branches. */
    branchIds?: string[];
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

  if (input.branches?.length) {
    await createBranchesForTenant(tenant._id, input.branches);
  }

  const hashedPassword = await bcrypt.hash(input.password, SALT_ROUNDS);
  const user = await User.create({
    phone,
    password: hashedPassword,
    name: input.name,
    tenantId: tenant._id,
    role: ROLES.TENANT_ADMIN,
    isActive: true,
  });

  const payload = buildJwtPayload(user, tenant._id.toString());
  const token = signAccessToken(payload);

  return {
    token,
    user: {
      id: user._id.toString(),
      phone: user.phone,
      name: user.name,
      tenantId: tenant._id.toString(),
      role: user.role as Role,
      tenantType: tenant.tenantType,
      branchIds: payload.branchIds,
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

  const payload = buildJwtPayload(user, tenant._id.toString());
  const token = signAccessToken(payload);

  return {
    token,
    user: {
      id: user._id.toString(),
      phone: user.phone,
      name: user.name,
      tenantId: tenant._id.toString(),
      role: user.role as Role,
      tenantType: tenant.tenantType ?? "SCHOOL",
      branchIds: payload.branchIds,
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
  /** When set, user only sees data for these branches (must exist on tenant). */
  branchIds?: string[];
}

export async function assertBranchIdsForTenant(
  tenantId: string,
  branchIds: string[] | undefined,
): Promise<string[] | undefined> {
  if (!branchIds?.length) {
    return undefined;
  }
  const unique = [...new Set(branchIds)].filter(
    (id) => typeof id === "string" && mongoose.isValidObjectId(id),
  );
  if (unique.length === 0) {
    return undefined;
  }
  const found = await Branch.find({
    tenantId,
    _id: { $in: unique },
  })
    .select("_id")
    .lean()
    .exec();
  if (found.length !== unique.length) {
    throw new Error("One or more branch ids are invalid for this tenant");
  }
  return found.map((b) => b._id.toString());
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

  const validatedBranchIds = await assertBranchIdsForTenant(
    input.tenantId,
    input.branchIds,
  );

  const tempPassword = Math.random().toString(36).slice(-10);
  const hashedPassword = await bcrypt.hash(tempPassword, SALT_ROUNDS);

  const user = await User.create({
    phone,
    password: hashedPassword,
    name: input.name,
    tenantId: input.tenantId,
    role: input.role,
    isActive: true,
    ...(validatedBranchIds?.length ? { branchIds: validatedBranchIds } : {}),
  });

  const tenantDoc = await Tenant.findById(input.tenantId).select("name").lean();
  const orgName =
    typeof tenantDoc?.name === "string" ? tenantDoc.name : "your organization";
  const loginHint = env.clientAppUrl ? ` ${env.clientAppUrl}/login` : "";
  const smsBody = `Edigo: Your account for ${orgName} is ready.${loginHint} Sign in with your phone number. Temporary password: ${tempPassword}`;

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
