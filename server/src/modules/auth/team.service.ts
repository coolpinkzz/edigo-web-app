import mongoose from "mongoose";
import { User, IUser } from "./user.model";
import { ROLES, Role } from "../../types/roles";

const ASSIGNABLE_ROLES: Role[] = [
  ROLES.TENANT_ADMIN,
  ROLES.STAFF,
  ROLES.VIEWER,
];

export type TeamMemberPublic = {
  id: string;
  phone: string;
  name: string;
  role: Role;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

function serialize(u: IUser): TeamMemberPublic {
  return {
    id: u._id.toString(),
    phone: u.phone,
    name: u.name,
    role: u.role as Role,
    isActive: u.isActive,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  };
}

export async function listTeamMembers(
  tenantId: string,
): Promise<TeamMemberPublic[]> {
  const docs = await User.find({ tenantId })
    .sort({ createdAt: -1 })
    .exec();
  return docs.map(serialize);
}

async function countActiveTenantAdmins(
  tenantId: string,
  excludeUserId?: string,
): Promise<number> {
  const filter: Record<string, unknown> = {
    tenantId,
    role: ROLES.TENANT_ADMIN,
    isActive: true,
  };
  if (excludeUserId && mongoose.isValidObjectId(excludeUserId)) {
    filter._id = { $ne: new mongoose.Types.ObjectId(excludeUserId) };
  }
  return User.countDocuments(filter).exec();
}

export type UpdateTeamMemberInput = {
  role?: Role;
  isActive?: boolean;
};

/**
 * Tenant admin updates a user in the same tenant. Prevents removing the last active TENANT_ADMIN.
 */
export async function updateTeamMember(
  tenantId: string,
  targetUserId: string,
  input: UpdateTeamMemberInput,
): Promise<TeamMemberPublic> {
  if (!mongoose.isValidObjectId(targetUserId)) {
    throw new Error("Invalid user id");
  }

  if (input.role !== undefined && !ASSIGNABLE_ROLES.includes(input.role)) {
    throw new Error("Invalid role");
  }

  const target = await User.findOne({
    _id: targetUserId,
    tenantId,
  }).exec();
  if (!target) {
    throw new Error("User not found");
  }

  const wasActiveAdmin =
    target.role === ROLES.TENANT_ADMIN && target.isActive === true;

  const nextRole = input.role ?? (target.role as Role);
  const nextActive =
    input.isActive !== undefined ? input.isActive : target.isActive;

  const becomesNonAdmin =
    nextRole !== ROLES.TENANT_ADMIN ||
    nextActive === false;

  if (wasActiveAdmin && becomesNonAdmin) {
    const others = await countActiveTenantAdmins(tenantId, targetUserId);
    if (others === 0) {
      throw new Error(
        "Cannot remove or demote the last active tenant administrator",
      );
    }
  }

  if (input.role !== undefined) target.role = input.role;
  if (input.isActive !== undefined) target.isActive = input.isActive;

  await target.save();
  return serialize(target);
}
