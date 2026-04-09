import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  overdueReminderMutationKey,
  sendOverdueRowReminder,
} from '../api/reminder.api'
import { feesOverdueQueryKey } from '../constants/query-keys'

export function useSendOverdueReminder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: sendOverdueRowReminder,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: feesOverdueQueryKey })
    },
  })
}

export { overdueReminderMutationKey }
