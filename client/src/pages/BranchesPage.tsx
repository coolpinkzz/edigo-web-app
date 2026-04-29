import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createBranch,
  deleteBranch,
  updateBranch,
} from "../api/branch.api";
import { ConfirmationModal } from "../components/ConfirmationModal";
import {
  Button,
  Card,
  CardDescription,
  CardTitle,
  Input,
} from "../components/ui";
import { branchesQueryKey } from "../constants/query-keys";
import { useBranches } from "../hooks/useBranches";
import type { BranchDto, CreateBranchBody, UpdateBranchBody } from "../types";
import { getErrorMessage } from "../utils";

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

/**
 * Tenant admin: add and edit campuses (branches) for the organization.
 */
export function BranchesPage() {
  const queryClient = useQueryClient();
  const { data: branches, isLoading, isError, error, refetch } = useBranches();

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [address, setAddress] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [editing, setEditing] = useState<BranchDto | null>(null);
  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editAddress, setEditAddress] = useState("");

  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const createMutation = useMutation({
    mutationFn: (body: CreateBranchBody) => createBranch(body),
    onSuccess: async () => {
      setName("");
      setCode("");
      setAddress("");
      setCreateError(null);
      await queryClient.invalidateQueries({ queryKey: branchesQueryKey });
    },
    onError: (e) => setCreateError(getErrorMessage(e)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateBranchBody }) =>
      updateBranch(id, body),
    onSuccess: async () => {
      setEditing(null);
      setEditError(null);
      await queryClient.invalidateQueries({ queryKey: branchesQueryKey });
    },
    onError: (e) => setEditError(getErrorMessage(e)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteBranch(id),
    onSuccess: () => {
      setDeleteError(null);
      return queryClient.invalidateQueries({ queryKey: branchesQueryKey });
    },
    onError: (e) => setDeleteError(getErrorMessage(e)),
  });

  const handleCreate = () => {
    if (!name.trim()) {
      setCreateError("Branch name is required");
      return;
    }
    const body: CreateBranchBody = {
      name: name.trim(),
      ...(code.trim() ? { code: code.trim() } : {}),
      ...(address.trim() ? { address: address.trim() } : {}),
    };
    createMutation.mutate(body);
  };

  const startEdit = (b: BranchDto) => {
    setCreateError(null);
    setEditError(null);
    setEditing(b);
    setEditName(b.name);
    setEditCode(b.code ?? "");
    setEditAddress(b.address ?? "");
  };

  const cancelEdit = () => {
    setEditing(null);
    setEditError(null);
  };

  const saveEdit = () => {
    if (!editing) return;
    if (!editName.trim()) {
      setEditError("Branch name is required");
      return;
    }
    const body: UpdateBranchBody = {
      name: editName.trim(),
      code: editCode.trim() === "" ? null : editCode.trim(),
      address: editAddress.trim() === "" ? null : editAddress.trim(),
    };
    updateMutation.mutate({ id: editing.id, body });
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    setDeleteError(null);
    deleteMutation.mutate(deleteTarget.id, {
      onSuccess: () => {
        setDeleteTarget(null);
        if (editing?.id === deleteTarget.id) {
          setEditing(null);
        }
      },
    });
  };

  const rows = branches ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <ConfirmationModal
        open={deleteTarget != null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete branch?"
        description={
          deleteTarget ? (
            <>
              Delete “<strong>{deleteTarget.name}</strong>”? This only works if
              no students or team members are still assigned to it.
            </>
          ) : null
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        confirmVariant="danger"
        isConfirming={deleteMutation.isPending}
        onConfirm={confirmDelete}
      />

      <div>
        <h1 className="text-2xl font-semibold text-foreground">Branches</h1>
        <p className="text-sm text-muted-foreground">
          Configure campuses or locations. Assign students to a branch to scope
          fees and reports.
        </p>
      </div>

      <Card>
        <div className="mb-4">
          <CardTitle className="text-lg">Add branch</CardTitle>
          <CardDescription>
            Name is required. Code and address are optional.
          </CardDescription>
        </div>
        <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2">
          <Input
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Main Campus"
          />
          <Input
            label="Code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Optional short id (e.g. MAIN)"
          />
        </div>
        <div className="mt-4">
          <Input
            label="Address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Optional mailing address"
          />
        </div>
        {createError && (
          <p className="mt-3 text-sm text-red-600" role="alert">
            {createError}
          </p>
        )}
        <div className="mt-4">
          <Button
            type="button"
            onClick={handleCreate}
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? "Adding…" : "Add branch"}
          </Button>
        </div>
      </Card>

      {editing && (
        <Card className="border-primary/30">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle className="text-lg">Edit branch</CardTitle>
              <CardDescription>Update “{editing.name}”.</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={cancelEdit}
                disabled={updateMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={saveEdit}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2">
            <Input
              label="Name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
            />
            <Input
              label="Code"
              value={editCode}
              onChange={(e) => setEditCode(e.target.value)}
              placeholder="Optional"
            />
          </div>
          <div className="mt-4">
            <Input
              label="Address"
              value={editAddress}
              onChange={(e) => setEditAddress(e.target.value)}
              placeholder="Optional"
            />
          </div>
          {editError && (
            <p className="mt-3 text-sm text-red-600" role="alert">
              {editError}
            </p>
          )}
        </Card>
      )}

      <Card className="p-0! overflow-hidden">
        <div className="border-b border-border px-6 py-4">
          <CardTitle className="text-lg">All branches</CardTitle>
          <CardDescription>
            If branch management is disabled on the server, new saves will be
            blocked—contact your administrator.
          </CardDescription>
        </div>
        {deleteError && (
          <p className="px-6 pt-4 text-sm text-red-600" role="alert">
            {deleteError}
          </p>
        )}
        {isLoading && (
          <p className="px-6 py-8 text-sm text-muted-foreground">Loading…</p>
        )}
        {isError && (
          <p className="px-6 py-8 text-sm text-red-600" role="alert">
            {error instanceof Error ? error.message : "Failed to load"}
            <button
              type="button"
              className="ml-2 text-primary underline"
              onClick={() => void refetch()}
            >
              Retry
            </button>
          </p>
        )}
        {!isLoading && !isError && rows.length === 0 && (
          <p className="px-6 py-8 text-sm text-muted-foreground">
            No branches yet. Add one above, or they may have been created at
            signup.
          </p>
        )}
        {!isLoading && !isError && rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="border-b bg-primary-gradient text-primary-foreground">
                <tr>
                  <th className="px-6 py-3 font-medium">Name</th>
                  <th className="px-6 py-3 font-medium">Code</th>
                  <th className="px-6 py-3 font-medium">Address</th>
                  <th className="px-6 py-3 font-medium">Created</th>
                  <th className="px-6 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {rows.map((b) => (
                  <tr
                    key={b.id}
                    className={
                      editing?.id === b.id ? "bg-muted/50" : "bg-card"
                    }
                  >
                    <td className="px-6 py-3 font-medium text-foreground">
                      {b.name}
                    </td>
                    <td className="px-6 py-3 text-muted-foreground">
                      {b.code ?? "—"}
                    </td>
                    <td className="max-w-xs truncate px-6 py-3 text-muted-foreground">
                      {b.address?.trim() ? b.address : "—"}
                    </td>
                    <td className="px-6 py-3 text-muted-foreground">
                      {formatDate(b.createdAt)}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          className="text-sm font-medium text-primary hover:underline disabled:opacity-50"
                          disabled={updateMutation.isPending}
                          onClick={() => startEdit(b)}
                        >
                          {editing?.id === b.id ? "Editing…" : "Edit"}
                        </button>
                        <button
                          type="button"
                          className="text-sm font-medium text-red-600 hover:underline disabled:opacity-50"
                          disabled={deleteMutation.isPending}
                          onClick={() =>
                            setDeleteTarget({ id: b.id, name: b.name })
                          }
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
