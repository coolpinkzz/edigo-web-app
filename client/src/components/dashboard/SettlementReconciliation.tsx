import type { DashboardSettlementsDto } from '../../types'
import { formatInr } from '../../utils'

export function SettlementReconciliation({
  data,
  loading,
  errorMessage,
}: {
  data: DashboardSettlementsDto | undefined
  loading: boolean
  errorMessage?: string | null
}) {
  if (errorMessage) {
    return (
      <p className="text-sm text-red-600" role="alert">
        {errorMessage}
      </p>
    )
  }

  if (loading) {
    return (
      <div className="space-y-4 py-2" aria-busy>
        <div className="grid gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-lg bg-muted/60 shadow-sm"
            />
          ))}
        </div>
        <div className="h-40 animate-pulse rounded-lg bg-muted/40 shadow-sm" />
      </div>
    )
  }

  const s = data?.summary
  const rows = data?.items ?? []

  return (
    <div className="space-y-6">
      <dl className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-white/20 bg-primary-gradient p-4 text-white shadow-md shadow-black/5">
          <dt className="text-xs font-medium uppercase tracking-wide text-white/80">
            Total collected (gateway)
          </dt>
          <dd className="mt-1 text-xl font-semibold tabular-nums">
            {formatInr(s?.totalCollectedInr ?? 0)}
          </dd>
          <p className="mt-1 text-xs text-white/70">
            Successful online payments
          </p>
        </div>
        <div className="rounded-lg border border-white/20 bg-primary-gradient p-4 text-white shadow-md shadow-black/5">
          <dt className="text-xs font-medium uppercase tracking-wide text-white/80">
            Total settled (linked)
          </dt>
          <dd className="mt-1 text-xl font-semibold tabular-nums">
            {formatInr(s?.totalSettledInr ?? 0)}
          </dd>
          <p className="mt-1 text-xs text-white/70">
            Payments linked to a settlement
          </p>
        </div>
        <div className="rounded-lg border border-white/20 bg-primary-gradient p-4 text-white shadow-md shadow-black/5">
          <dt className="text-xs font-medium uppercase tracking-wide text-white/80">
            In transit
          </dt>
          <dd className="mt-1 text-xl font-semibold tabular-nums">
            {formatInr(s?.inTransitInr ?? 0)}
          </dd>
          <p className="mt-1 text-xs text-white/70">
            Captured, not yet linked to settlement
          </p>
        </div>
      </dl>

      <div className="overflow-x-auto rounded-lg border border-card-border bg-card shadow-md shadow-black/[0.06]">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-primary-gradient text-primary-foreground">
            <tr className="border-b border-border">
              <th className="px-3 py-2 font-medium">Settlement id</th>
              <th className="px-3 py-2 font-medium">Net settled</th>
              <th className="px-3 py-2 font-medium">Fees</th>
              <th className="px-3 py-2 font-medium">Tax</th>
              <th className="px-3 py-2 font-medium">Settled at</th>
              <th className="px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  className="px-3 py-8 text-center text-muted-foreground"
                  colSpan={6}
                >
                  No settlements linked to your payments yet. Sync runs every 6
                  hours when Razorpay keys are configured.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr
                  key={r.settlementId}
                  className="border-b border-border/60 last:border-0"
                >
                  <td className="px-3 py-2 font-mono text-xs text-foreground">
                    {r.settlementId}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-foreground">
                    {formatInr(r.amount)}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">
                    {formatInr(r.fees)}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">
                    {formatInr(r.tax)}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {r.settledAt
                      ? new Date(r.settledAt).toLocaleString('en-IN', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })
                      : '—'}
                  </td>
                  <td className="px-3 py-2">
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium capitalize text-foreground">
                      {r.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {data && data.total > data.items.length ? (
        <p className="text-xs text-muted-foreground">
          Showing {data.items.length} of {data.total} settlements (page{' '}
          {data.page}).
        </p>
      ) : null}
    </div>
  )
}
