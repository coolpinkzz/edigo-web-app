/** Server shape from GET /branches, POST, PATCH, GET /branches/:id */
export interface BranchDto {
  id: string;
  tenantId: string;
  name: string;
  code?: string;
  address?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBranchBody {
  name: string;
  code?: string;
  address?: string;
}

export interface UpdateBranchBody {
  name?: string;
  code?: string | null;
  address?: string | null;
}
