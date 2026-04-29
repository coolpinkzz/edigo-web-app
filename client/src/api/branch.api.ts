import type { BranchDto, CreateBranchBody, UpdateBranchBody } from "../types";
import { apiClient } from "./client";

export interface ListBranchesResponse {
  branches: BranchDto[];
}

export async function listBranches(): Promise<BranchDto[]> {
  const { data } = await apiClient.get<ListBranchesResponse>("/branches");
  return data.branches ?? [];
}

export async function getBranch(branchId: string): Promise<BranchDto> {
  const { data } = await apiClient.get<BranchDto>(`/branches/${branchId}`);
  return data;
}

export async function createBranch(body: CreateBranchBody): Promise<BranchDto> {
  const { data } = await apiClient.post<BranchDto>("/branches", body);
  return data;
}

export async function updateBranch(
  branchId: string,
  body: UpdateBranchBody,
): Promise<BranchDto> {
  const { data } = await apiClient.patch<BranchDto>(
    `/branches/${branchId}`,
    body,
  );
  return data;
}

export async function deleteBranch(branchId: string): Promise<void> {
  await apiClient.delete(`/branches/${branchId}`);
}
