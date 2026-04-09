import { Request, Response } from "express";
import * as teamService from "./team.service";
import type { UpdateTeamMemberInput } from "./team.service";

/**
 * GET /auth/team — list users in tenant (tenant admin).
 */
export async function list(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = req.user!.tenantId;
    const members = await teamService.listTeamMembers(tenantId);
    res.json({ members });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to list team members";
    res.status(400).json({ error: message });
  }
}

/**
 * PATCH /auth/team/:userId — update role / active flag (tenant admin).
 */
export async function updateMember(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = req.user!.tenantId;
    const { userId } = req.params as { userId: string };
    const body = req.body as UpdateTeamMemberInput;

    const updated = await teamService.updateTeamMember(tenantId, userId, {
      role: body.role,
      isActive: body.isActive,
    });
    res.json({ member: updated });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to update team member";
    const lower = message.toLowerCase();
    const status =
      lower.includes("not found") ? 404 : lower.includes("invalid") ? 400 : 400;
    res.status(status).json({ error: message });
  }
}
