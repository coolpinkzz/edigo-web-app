/** Mirrors GET /dashboard/overview response. */
export interface DashboardOverviewDto {
  period: { from: string; to: string }
  comparePeriod?: { from: string; to: string }
  collected: {
    amount: number
    onlineAmount: number
    manualAmount: number
    previousAmount?: number
    /** Percent change vs previous period when `compare` was requested. */
    changePercent?: number | null
  }
  pending: {
    amount: number
  }
  students: {
    total: number
    active: number
    paidInPeriod: number
  }
}

export type DashboardTrendGranularity = 'daily' | 'weekly' | 'monthly'

/** GET /dashboard/revenue-trend */
export interface RevenueTrendPointDto {
  periodStart: string
  label: string
  collected: number
  due: number
}

export interface RevenueTrendDto {
  granularity: DashboardTrendGranularity
  period: { from: string; to: string }
  points: RevenueTrendPointDto[]
}

/** GET /dashboard/class-performance */
export interface ClassPerformanceRowDto {
  className: string
  /** Present for ACADEMY tenants (course catalog id). */
  courseId?: string
  totalAmount: number
  paidAmount: number
  percentCollected: number
}

export interface ClassPerformanceDto {
  rows: ClassPerformanceRowDto[]
}

/** GET /dashboard/settlements */
export interface DashboardSettlementsSummaryDto {
  totalCollectedInr: number
  totalSettledInr: number
  inTransitInr: number
}

export interface DashboardSettlementRowDto {
  settlementId: string
  amount: number
  fees: number
  tax: number
  settledAt: string | null
  status: string
}

export interface DashboardSettlementsDto {
  summary: DashboardSettlementsSummaryDto
  items: DashboardSettlementRowDto[]
  total: number
  page: number
  limit: number
}
