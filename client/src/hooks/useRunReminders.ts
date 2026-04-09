import { useMutation } from '@tanstack/react-query'
import { runReminders } from '../api/reminder.api'

export function useRunReminders() {
  return useMutation({
    mutationFn: runReminders,
  })
}
