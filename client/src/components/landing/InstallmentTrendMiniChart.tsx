import { useId } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

/** Static demo data for landing-page previews (lakhs INR). */
const DEMO_DATA = [
  { label: 'Apr', collected: 4.2 },
  { label: 'May', collected: 5.1 },
  { label: 'Jun', collected: 4.8 },
  { label: 'Jul', collected: 6.2 },
  { label: 'Aug', collected: 5.9 },
  { label: 'Sep', collected: 7.1 },
  { label: 'Oct', collected: 6.8 },
  { label: 'Nov', collected: 8.4 },
]

const gridStroke = 'rgba(148, 163, 184, 0.12)'
const axisTick = '#94a3b8'
const lineColor = '#48b8a8'

type TooltipProps = {
  active?: boolean
  payload?: { value?: number }[]
  label?: string
}

function TrendTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null
  const value = payload[0]?.value
  return (
    <div className="rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-xs shadow-xl backdrop-blur-sm dark:border-white/15 dark:bg-slate-900/95">
      <p className="text-[11px] text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-0.5 font-semibold tabular-nums text-slate-900 dark:text-white">
        ₹{typeof value === 'number' ? value.toFixed(1) : '—'}L{' '}
        <span className="font-normal text-slate-500 dark:text-slate-400">collected</span>
      </p>
    </div>
  )
}

type InstallmentTrendMiniChartProps = {
  className?: string
  /** Outer chart height in px (ResponsiveContainer needs a defined parent height). */
  height?: number
}

export function InstallmentTrendMiniChart({
  className,
  height = 128,
}: InstallmentTrendMiniChartProps) {
  const rawId = useId()
  const gradientId = `installment-fill-${rawId.replace(/:/g, '')}`

  return (
    <div
      className={className}
      style={{ height }}
      role="img"
      aria-label="Sample installment collection trend chart"
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={DEMO_DATA}
          margin={{ top: 6, right: 4, left: -8, bottom: 0 }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={lineColor} stopOpacity={0.35} />
              <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={gridStroke}
            vertical={false}
          />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: axisTick }}
            tickLine={false}
            axisLine={{ stroke: gridStroke }}
            interval="preserveStartEnd"
            minTickGap={8}
          />
          <YAxis
            tick={{ fontSize: 10, fill: axisTick }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => `${v}L`}
            width={36}
            domain={['dataMin - 0.5', 'dataMax + 0.5']}
          />
          <Tooltip
            content={<TrendTooltip />}
            cursor={{ stroke: 'rgba(148, 163, 184, 0.25)', strokeWidth: 1 }}
          />
          <Area
            type="monotone"
            dataKey="collected"
            name="Collected"
            stroke={lineColor}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            fillOpacity={1}
            dot={false}
            activeDot={{ r: 4, fill: lineColor, stroke: '#0f172a', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
