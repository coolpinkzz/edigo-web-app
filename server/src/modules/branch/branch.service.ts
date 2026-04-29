import mongoose from "mongoose";
import { Branch, IBranch } from "./branch.model";
import { Tenant } from "../auth/tenant.model";

export interface CreateBranchInput {
  name: string;
  code?: string;
  address?: string;
}

export interface UpdateBranchInput {
  name?: string;
  code?: string;
  address?: string | null;
}

function serialize(doc: IBranch) {
  return {
    id: doc._id.toString(),
    tenantId: doc.tenantId.toString(),
    name: doc.name,
    code: doc.code,
    address: doc.address,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export async function assertBranchBelongsToTenant(
  tenantId: string,
  branchId: string,
): Promise<IBranch> {
  if (!mongoose.isValidObjectId(branchId)) {
    throw new Error("Invalid branch id");
  }
  const doc = await Branch.findOne({
    _id: branchId,
    tenantId,
  }).exec();
  if (!doc) {
    throw new Error("Branch not found");
  }
  return doc;
}

export async function createBranch(
  tenantId: string,
  input: CreateBranchInput,
): Promise<ReturnType<typeof serialize>> {
  if (!mongoose.isValidObjectId(tenantId)) {
    throw new Error("Invalid tenant id");
  }
  const tenant = await Tenant.findById(tenantId).select("_id").lean().exec();
  if (!tenant) {
    throw new Error("Tenant not found");
  }

  const name = input.name.trim();
  if (!name) {
    throw new Error("Branch name is required");
  }

  const code =
    input.code != null && String(input.code).trim() !== ""
      ? String(input.code).trim()
      : undefined;

  try {
    const doc = await Branch.create({
      tenantId,
      name,
      ...(code ? { code } : {}),
      ...(input.address != null && String(input.address).trim() !== ""
        ? { address: String(input.address).trim() }
        : {}),
    });
    return serialize(doc);
  } catch (err: unknown) {
    if (isDuplicateKeyError(err)) {
      throw new Error(
        "A branch with this name or code already exists for this tenant",
      );
    }
    throw err;
  }
}

export async function listBranches(
  tenantId: string,
): Promise<ReturnType<typeof serialize>[]> {
  const docs = await Branch.find({ tenantId })
    .sort({ name: 1 })
    .exec();
  return docs.map(serialize);
}

export async function getBranchById(
  tenantId: string,
  branchId: string,
): Promise<ReturnType<typeof serialize> | null> {
  if (!mongoose.isValidObjectId(branchId)) {
    return null;
  }
  const doc = await Branch.findOne({ _id: branchId, tenantId }).exec();
  return doc ? serialize(doc) : null;
}

export async function updateBranch(
  tenantId: string,
  branchId: string,
  input: UpdateBranchInput,
): Promise<ReturnType<typeof serialize> | null> {
  const doc = await Branch.findOne({ _id: branchId, tenantId }).exec();
  if (!doc) {
    return null;
  }

  if (input.name !== undefined) {
    const n = input.name.trim();
    if (!n) {
      throw new Error("Branch name cannot be empty");
    }
    doc.name = n;
  }
  if (input.code !== undefined) {
    doc.code =
      input.code === null || input.code === ""
        ? undefined
        : String(input.code).trim();
  }
  if (input.address !== undefined) {
    doc.address =
      input.address === null || input.address === ""
        ? undefined
        : String(input.address).trim();
  }

  try {
    await doc.save();
    return serialize(doc);
  } catch (err: unknown) {
    if (isDuplicateKeyError(err)) {
      throw new Error(
        "A branch with this name or code already exists for this tenant",
      );
    }
    throw err;
  }
}

export async function deleteBranch(
  tenantId: string,
  branchId: string,
): Promise<boolean> {
  if (!mongoose.isValidObjectId(branchId)) {
    return false;
  }

  const { Student } = await import("../student/student.model");
  const inUse = await Student.countDocuments({
    tenantId,
    branchId,
  }).exec();
  if (inUse > 0) {
    throw new Error(
      "Cannot delete branch: students are still assigned to it",
    );
  }

  const { User } = await import("../auth/user.model");
  const usersWithBranch = await User.countDocuments({
    tenantId,
    branchIds: branchId,
  }).exec();
  if (usersWithBranch > 0) {
    throw new Error(
      "Cannot delete branch: remove it from team members first",
    );
  }

  const result = await Branch.deleteOne({ _id: branchId, tenantId }).exec();
  return result.deletedCount === 1;
}

function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: number }).code === 11000
  );
}

/**
 * Creates many branches in one insert (signup). Skips empty names.
 */
export async function createBranchesForTenant(
  tenantId: mongoose.Types.ObjectId,
  rows: CreateBranchInput[],
): Promise<void> {
  const cleaned = rows
    .map((r) => ({
      name: r.name?.trim() ?? "",
      code:
        r.code != null && String(r.code).trim() !== ""
          ? String(r.code).trim()
          : undefined,
      address:
        r.address != null && String(r.address).trim() !== ""
          ? String(r.address).trim()
          : undefined,
    }))
    .filter((r) => r.name.length > 0);

  if (cleaned.length === 0) {
    return;
  }

  const names = new Set<string>();
  for (const r of cleaned) {
    const key = r.name.toLowerCase();
    if (names.has(key)) {
      throw new Error(`Duplicate branch name in request: ${r.name}`);
    }
    names.add(key);
  }

  const payloads = cleaned.map((r) => ({
    tenantId,
    name: r.name,
    ...(r.code ? { code: r.code } : {}),
    ...(r.address ? { address: r.address } : {}),
  }));

  try {
    await Branch.insertMany(payloads, { ordered: true });
  } catch (err: unknown) {
    if (isDuplicateKeyError(err)) {
      throw new Error(
        "A branch with this name or code already exists for this tenant",
      );
    }
    throw err;
  }
}
