/** Assignable roles for invites and updates (matches server). */
export type TeamMemberRole = "TENANT_ADMIN" | "STAFF" | "VIEWER";

export interface TeamMemberDto {
  id: string;
  phone: string;
  name: string;
  role: TeamMemberRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InviteTeamMemberPayload {
  phone: string;
  name: string;
  role: TeamMemberRole;
}

export interface InviteTeamMemberResponse {
  id: string;
  phone: string;
  temporaryPassword: string;
}

export interface PatchTeamMemberPayload {
  role?: TeamMemberRole;
  isActive?: boolean;
}
