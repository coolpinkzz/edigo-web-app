import { apiClient } from './client'

export type ReminderRunSummary = {
  runId: string
  scanned: number
  smsSent: number
  skippedPaid: number
  skippedDedupe: number
  skippedNoPhone: number
  errors: number
}

export type RunRemindersResponse = {
  ok: true
  summary: ReminderRunSummary
}

/**
 * POST /reminders/run — staff JWT; runs SMS reminders (installments + lump-sum) for this tenant.
 */
export async function runReminders(): Promise<RunRemindersResponse> {
  const { data } = await apiClient.post<RunRemindersResponse>('/reminders/run')
  return data
}

export type SendInstallmentReminderResponse =
  | { ok: true; message: string }
  | { ok: false; message: string; code?: string }

/**
 * POST /reminders/installment/:installmentId — staff JWT; SMS for one installment.
 */
export async function sendInstallmentReminder(
  installmentId: string,
): Promise<SendInstallmentReminderResponse> {
  const { data } = await apiClient.post<SendInstallmentReminderResponse>(
    `/reminders/installment/${installmentId}`,
  )
  return data
}

/**
 * POST /reminders/fee/:feeId — staff JWT; SMS for one lump-sum (non-installment) fee.
 */
export async function sendFeeReminder(
  feeId: string,
): Promise<SendInstallmentReminderResponse> {
  const { data } = await apiClient.post<SendInstallmentReminderResponse>(
    `/reminders/fee/${feeId}`,
  )
  return data
}

/** Row key for `useSendOverdueReminder` — installment vs lump-sum. */
export function overdueReminderMutationKey(row: {
  installmentId: string
  feeId: string
}): string {
  return row.installmentId ? `i:${row.installmentId}` : `f:${row.feeId}`
}

export async function sendOverdueRowReminder(
  row: { installmentId: string; feeId: string },
): Promise<SendInstallmentReminderResponse> {
  if (row.installmentId) {
    return sendInstallmentReminder(row.installmentId)
  }
  return sendFeeReminder(row.feeId)
}
