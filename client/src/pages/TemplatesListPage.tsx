import { useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button, Card, CardDescription, CardTitle } from "../components/ui";
import { useDeleteFeeTemplate } from "../hooks/useDeleteFeeTemplate";
import { useFeeTemplates } from "../hooks/useFeeTemplates";
import { getErrorMessage } from "../utils";

/**
 * Lists fee structures; shows a flash banner after create (`?created=1`) or update (`?updated=1`).
 */
export function TemplatesListPage() {
  const { data, isLoading, isError, error } = useFeeTemplates({ limit: 50 });
  const deleteMutation = useDeleteFeeTemplate();
  const [searchParams, setSearchParams] = useSearchParams();
  const showCreated = searchParams.get("created") === "1";
  const showUpdated = searchParams.get("updated") === "1";

  useEffect(() => {
    if (!showCreated && !showUpdated) return;
    const id = window.setTimeout(() => {
      setSearchParams({}, { replace: true });
    }, 5000);
    return () => window.clearTimeout(id);
  }, [showCreated, showUpdated, setSearchParams]);

  const handleDelete = (id: string, title: string) => {
    if (
      !window.confirm(
        `Delete fee structure “${title}”? You can only delete structures that have not been used to create fees.`,
      )
    ) {
      return;
    }
    deleteMutation.mutate(id);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {showCreated && (
        <div
          className="rounded-lg bg-accent px-4 py-3 text-sm text-accent-foreground shadow-md shadow-primary/10 transition-opacity duration-300"
          role="status"
        >
          Fee structure created successfully.
        </div>
      )}
      {showUpdated && (
        <div
          className="rounded-lg bg-accent px-4 py-3 text-sm text-accent-foreground shadow-md shadow-primary/10 transition-opacity duration-300"
          role="status"
        >
          Fee structure updated successfully.
        </div>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Fee structures
          </h1>
          <p className="text-sm text-muted-foreground">
            Reusable definitions used when assigning fees to students.
          </p>
        </div>
        <Link to="/fee-templates/new">
          <Button type="button">Create structure</Button>
        </Link>
      </div>

      <Card className="p-0! overflow-hidden">
        <div className="border-b border-border px-6 py-4">
          <CardTitle className="text-lg">All fee structures</CardTitle>
          <CardDescription>Reusable fee definitions for your organization.</CardDescription>
        </div>

        {isLoading && (
          <p className="px-6 py-8 text-sm text-muted-foreground">Loading…</p>
        )}

        {isError && (
          <p className="px-6 py-8 text-sm text-red-600" role="alert">
            {error instanceof Error
              ? error.message
              : "Failed to load fee structures"}
          </p>
        )}

        {deleteMutation.isError && deleteMutation.error && (
          <p
            className="border-b border-red-100 bg-red-50 px-6 py-3 text-sm text-red-700"
            role="alert"
          >
            {getErrorMessage(deleteMutation.error)}
          </p>
        )}

        {!isLoading && !isError && data && data.data.length === 0 && (
          <p className="px-6 py-8 text-sm text-muted-foreground">
            No fee structures yet.{" "}
            <Link
              to="/fee-templates/new"
              className="font-medium text-primary hover:underline"
            >
              Create one
            </Link>
            .
          </p>
        )}

        {!isLoading && !isError && data && data.data.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="border-b border-border bg-primary-gradient text-primary-foreground">
                <tr>
                  <th className="px-6 py-3 font-medium">Title</th>
                  <th className="px-6 py-3 font-medium">Type</th>
                  <th className="px-6 py-3 font-medium text-right">Total</th>
                  <th className="px-6 py-3 font-medium">Installments</th>
                  <th className="px-6 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {data.data.map((t) => (
                  <tr key={t.id} className="bg-card hover:bg-muted/80">
                    <td className="px-6 py-3 font-medium text-foreground">
                      {t.title}
                    </td>
                    <td className="px-6 py-3 text-muted-foreground">{t.feeType}</td>
                    <td className="px-6 py-3 text-right tabular-nums text-foreground">
                      {t.totalAmount.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-6 py-3 text-muted-foreground">
                      {t.isInstallment
                        ? `${t.defaultInstallments.length} parts`
                        : "—"}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <Link
                          to={`/fee-templates/${t.id}/assign`}
                          className="text-sm font-medium text-primary hover:underline"
                        >
                          Assign
                        </Link>
                        <button
                          type="button"
                          className="text-sm font-medium text-red-600 hover:underline disabled:opacity-50"
                          disabled={deleteMutation.isPending}
                          onClick={() => handleDelete(t.id, t.title)}
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
