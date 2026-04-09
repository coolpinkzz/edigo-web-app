import type {
  InviteTeamMemberPayload,
  InviteTeamMemberResponse,
  PatchTeamMemberPayload,
  TeamMemberDto,
} from "../types/team.types";
import { apiClient } from "./client";

export async function listTeamMembers(): Promise<TeamMemberDto[]> {
  const { data } = await apiClient.get<{ members: TeamMemberDto[] }>(
    "/auth/team",
  );
  return data.members;
}

export async function inviteTeamMember(
  payload: InviteTeamMemberPayload,
): Promise<InviteTeamMemberResponse> {
  const { data } = await apiClient.post<InviteTeamMemberResponse>(
    "/auth/invite",
    payload,
  );
  return data;
}

export async function patchTeamMember(
  userId: string,
  payload: PatchTeamMemberPayload,
): Promise<TeamMemberDto> {
  const { data } = await apiClient.patch<{ member: TeamMemberDto }>(
    `/auth/team/${userId}`,
    payload,
  );
  return data.member;
}
