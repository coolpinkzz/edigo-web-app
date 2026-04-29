import { Request, Response } from "express";
import * as branchService from "./branch.service";

/**
 * GET /branches — list branches for current tenant.
 */
export async function list(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = req.user!.tenantId;
    const rows = await branchService.listBranches(tenantId);
    res.json({ branches: rows });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to list branches";
    res.status(400).json({ error: message });
  }
}

/**
 * GET /branches/:branchId
 */
export async function getById(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = req.user!.tenantId;
    const { branchId } = req.params as { branchId: string };
    const row = await branchService.getBranchById(tenantId, branchId);
    if (!row) {
      res.status(404).json({ error: "Branch not found" });
      return;
    }
    res.json(row);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to load branch";
    res.status(400).json({ error: message });
  }
}

/**
 * POST /branches
 */
export async function create(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = req.user!.tenantId;
    const body = req.body as branchService.CreateBranchInput;
    const created = await branchService.createBranch(tenantId, body);
    res.status(201).json(created);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to create branch";
    const status = message.includes("already exists") ? 409 : 400;
    res.status(status).json({ error: message });
  }
}

/**
 * PATCH /branches/:branchId
 */
export async function update(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = req.user!.tenantId;
    const { branchId } = req.params as { branchId: string };
    const body = req.body as branchService.UpdateBranchInput;
    const updated = await branchService.updateBranch(tenantId, branchId, body);
    if (!updated) {
      res.status(404).json({ error: "Branch not found" });
      return;
    }
    res.json(updated);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to update branch";
    const status = message.includes("already exists") ? 409 : 400;
    res.status(status).json({ error: message });
  }
}

/**
 * DELETE /branches/:branchId
 */
export async function remove(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = req.user!.tenantId;
    const { branchId } = req.params as { branchId: string };
    const ok = await branchService.deleteBranch(tenantId, branchId);
    if (!ok) {
      res.status(404).json({ error: "Branch not found" });
      return;
    }
    res.status(204).send();
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to delete branch";
    const lower = message.toLowerCase();
    const status = lower.includes("cannot delete") ? 409 : 400;
    res.status(status).json({ error: message });
  }
}
