import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Button,
  Card,
  SELECT_EMPTY_VALUE,
  SelectField,
} from "../components/ui";
import { useQuotations } from "../hooks/useQuotations";
import { useBranches } from "../hooks/useBranches";
import { getErrorMessage } from "../utils";
import type { QuotationStatus } from "../types/quotation.types";

const STATUS_OPTIONS: { value: QuotationStatus | ""; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "DRAFT", label: "Draft" },
  { value: "SENT", label: "Sent" },
  { value: "PENDING_PAYMENT", label: "Pending payment" },
  { value: "ACCEPTED", label: "Accepted" },
  { value: "REJECTED", label: "Rejected" },
  { value: "EXPIRED", label: "Expired" },
];

export function QuotationsListPage() {
  const branchesQuery = useBranches();
  const [branchId, setBranchId] = useState<string>("");
  const [status, setStatus] = useState<QuotationStatus | "">("");

  const listQuery = useQuotations({
    branchId: branchId || undefined,
    status: status || undefined,
    limit: 50,
  });

  const branchOptions = [
    { value: SELECT_EMPTY_VALUE, label: "All branches" },
    ...(branchesQuery.data ?? []).map((b) => ({
      value: b.id,
      label: b.name,
    })),
  ];

  const statusOptions = STATUS_OPTIONS.map((o) => ({
    value: o.value === "" ? SELECT_EMPTY_VALUE : o.value,
    label: o.label,
  }));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Quotations</h1>
          <p className="text-sm text-muted-foreground">
            Lead quotes with PDF and SMS delivery.
          </p>
        </div>
        <Link to="/quotations/new">
          <Button type="button">New quotation</Button>
        </Link>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[160px]">
          <SelectField
            label="Branch"
            name="filter-quotation-branch"
            options={branchOptions}
            value={branchId === "" ? SELECT_EMPTY_VALUE : branchId}
            onValueChange={(v) =>
              setBranchId(v === SELECT_EMPTY_VALUE ? "" : v)
            }
            disabled={branchesQuery.isLoading}
          />
        </div>
        <div className="min-w-[160px]">
          <SelectField
            label="Status"
            name="filter-quotation-status"
            options={statusOptions}
            value={status === "" ? SELECT_EMPTY_VALUE : status}
            onValueChange={(v) =>
              setStatus(v === SELECT_EMPTY_VALUE ? "" : (v as QuotationStatus))
            }
          />
        </div>
      </div>

      <Card className="overflow-hidden p-0!">
        {listQuery.isLoading && (
          <p className="px-6 py-8 text-sm text-muted-foreground">Loading…</p>
        )}
        {listQuery.isError && (
          <p className="px-6 py-8 text-sm text-red-600" role="alert">
            {getErrorMessage(listQuery.error)}
          </p>
        )}
        {listQuery.data && listQuery.data.data.length === 0 && (
          <p className="px-6 py-8 text-sm text-muted-foreground">
            No quotations yet.
          </p>
        )}
        {listQuery.data && listQuery.data.data.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-border bg-muted/40">
                <tr>
                  <th className="px-4 py-3 font-medium">Ref</th>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Branch</th>
                  <th className="px-4 py-3 font-medium">Total</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Valid until</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {listQuery.data.data.map((q) => (
                  <tr
                    key={q.id}
                    className="border-b border-border/80 last:border-0"
                  >
                    <td className="px-4 py-3 font-mono text-xs">
                      {q.quotationRef}
                    </td>
                    <td className="px-4 py-3">{q.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {q.branchName ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      Rs{" "}
                      {q.quotedTotal.toLocaleString("en-IN", {
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-md bg-muted px-2 py-0.5 text-xs">
                        {q.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(q.validUntil).toLocaleDateString("en-IN")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to={`/quotations/${q.id}`}
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        View
                      </Link>
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
