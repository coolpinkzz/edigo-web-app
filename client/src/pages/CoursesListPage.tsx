import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createCourse, deleteCourse, updateCourse } from "../api/course.api";
import { ConfirmationModal } from "../components/ConfirmationModal";
import {
  Button,
  Card,
  CardDescription,
  CardTitle,
  Input,
} from "../components/ui";
import { coursesQueryKey } from "../constants/query-keys";
import { useCourses } from "../hooks/useCourses";
import { getErrorMessage } from "../utils";

/**
 * Tenant admin: manage course catalog (academy students reference these ids).
 */
export function CoursesListPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, error, refetch } = useCourses({
    limit: 100,
    includeInactive: true,
  });

  const [name, setName] = useState("");
  const [shortCode, setShortCode] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const createMutation = useMutation({
    mutationFn: () =>
      createCourse({
        name: name.trim(),
        shortCode: shortCode.trim() || undefined,
      }),
    onSuccess: async () => {
      setName("");
      setShortCode("");
      setFormError(null);
      await queryClient.invalidateQueries({ queryKey: coursesQueryKey });
    },
    onError: (e) => setFormError(getErrorMessage(e)),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      updateCourse(id, { isActive: !isActive }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: coursesQueryKey }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCourse(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: coursesQueryKey }),
    onError: (e) => setFormError(getErrorMessage(e)),
  });

  const handleCreate = () => {
    if (!name.trim()) {
      setFormError("Course name is required");
      return;
    }
    createMutation.mutate();
  };

  const confirmDeleteCourse = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id, {
      onSuccess: () => setDeleteTarget(null),
    });
  };

  const rows = data?.data ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <ConfirmationModal
        open={deleteTarget != null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete course?"
        description={
          deleteTarget ? (
            <>
              Delete “<strong>{deleteTarget.name}</strong>”? This only works if
              no students use it.
            </>
          ) : null
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        confirmVariant="danger"
        isConfirming={deleteMutation.isPending}
        onConfirm={confirmDeleteCourse}
      />
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Courses</h1>
        <p className="text-sm text-muted-foreground">
          Define courses so academy students can be assigned to a catalog entry.
        </p>
      </div>

      <Card>
        <div className="mb-4">
          <CardTitle className="text-lg">Add course</CardTitle>
          <CardDescription>
            Name is required; short code is optional (e.g. batch label).
          </CardDescription>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. JEE Mains 2026"
          />
          <Input
            label="Short code"
            value={shortCode}
            onChange={(e) => setShortCode(e.target.value)}
            placeholder="Optional"
          />
        </div>
        {formError && (
          <p className="mt-3 text-sm text-red-600" role="alert">
            {formError}
          </p>
        )}
        <div className="mt-4">
          <Button
            type="button"
            onClick={handleCreate}
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? "Adding…" : "Add course"}
          </Button>
        </div>
      </Card>

      <Card className="p-0! overflow-hidden">
        <div className="border-b border-border px-6 py-4">
          <CardTitle className="text-lg">All courses</CardTitle>
          <CardDescription>
            Deactivate instead of delete if students are still assigned.
          </CardDescription>
        </div>
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
            No courses yet. Add one above.
          </p>
        )}
        {!isLoading && !isError && rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="border-b bg-primary-gradient text-primary-foreground">
                <tr>
                  <th className="px-6 py-3 font-medium">Name</th>
                  <th className="px-6 py-3 font-medium">Code</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {rows.map((c) => (
                  <tr key={c.id} className="bg-card">
                    <td className="px-6 py-3 font-medium text-foreground">
                      {c.name}
                    </td>
                    <td className="px-6 py-3 text-muted-foreground">
                      {c.shortCode ?? "—"}
                    </td>
                    <td className="px-6 py-3">
                      <span
                        className={
                          c.isActive
                            ? "text-emerald-700"
                            : "text-muted-foreground"
                        }
                      >
                        {c.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          className="text-sm font-medium text-primary hover:underline disabled:opacity-50"
                          disabled={toggleMutation.isPending}
                          onClick={() =>
                            toggleMutation.mutate({
                              id: c.id,
                              isActive: c.isActive,
                            })
                          }
                        >
                          {c.isActive ? "Deactivate" : "Activate"}
                        </button>
                        <button
                          type="button"
                          className="text-sm font-medium text-red-600 hover:underline disabled:opacity-50"
                          disabled={deleteMutation.isPending}
                          onClick={() =>
                            setDeleteTarget({ id: c.id, name: c.name })
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
