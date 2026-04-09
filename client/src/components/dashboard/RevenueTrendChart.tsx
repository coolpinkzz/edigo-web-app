import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { RevenueTrendDto } from '../../types'
import { cn, formatInr, formatInrTooltip } from '../../utils'

const collectedStroke = 'var(--color-primary)'
const dueStroke = '#d97706'

type TooltipPayload = {
  dataKey?: string
  name?: string
  value?: number
  color?: string
}

function TrendTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: TooltipPayload[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-card-border bg-card px-3 py-2 shadow-lg shadow-black/[0.08]">
      <p className="mb-2 text-xs font-medium text-muted-foreground">{label}</p>
      <ul className="space-y-1 text-sm">
        {payload.map((p) => (
          <li key={String(p.dataKey)} className="flex items-center gap-2">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: p.color }}
              aria-hidden
            />
            <span className="text-muted-foreground">
              {p.name === 'Collected' || p.dataKey === 'collected'
                ? 'Collected'
                : 'Due (scheduled)'}
            </span>
            <span className="ml-auto font-medium tabular-nums text-foreground">
              {formatInrTooltip(Number(p.value ?? 0))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function RevenueTrendChart({
  data,
  loading,
  errorMessage,
  className,
}: {
  data: RevenueTrendDto | undefined
  loading: boolean
  errorMessage?: string | null
  className?: string
}) {
  const chartData =
    data?.points.map((p) => ({
      label: p.label,
      collected: p.collected,
      due: p.due,
    })) ?? []

  if (errorMessage) {
    return (
      <p className="text-sm text-red-600" role="alert">
        {errorMessage}
      </p>
    )
  }

  if (loading) {
    return (
      <div
        className="flex h-[320px] items-center justify-center rounded-lg bg-muted/30 shadow-inner"
        aria-busy
      >
        <p className="text-sm text-muted-foreground">Loading chart…</p>
      </div>
    )
  }

  if (chartData.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center rounded-lg bg-muted/20 shadow-inner">
        <p className="text-sm text-muted-foreground">No data in this range.</p>
      </div>
    )
  }

  return (
    <div className={cn('w-full min-w-0', className)}>
      <div className="h-[min(420px,55vh)] w-full min-h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
              tickLine={false}
              axisLine={{ stroke: 'var(--color-border)' }}
              interval="preserveStartEnd"
              minTickGap={24}
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
              tickLine={false}
              axisLine={{ stroke: 'var(--color-border)' }}
              tickFormatter={(v: number) => formatInr(v)}
              width={72}
            />
            <Tooltip content={<TrendTooltip />} />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
            <Line
              type="monotone"
              dataKey="collected"
              name="Collected"
              stroke={collectedStroke}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="due"
              name="Due (scheduled)"
              stroke={dueStroke}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
