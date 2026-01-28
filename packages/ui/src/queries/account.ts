import { useMutation, useQueryClient } from '@tanstack/react-query'
import { resetAccountData } from '@odie/db'
import { bulletKeys } from './bullets'
import { resumeKeys } from './resumes'
import { runKeys } from './runs'

/**
 * Mutation hook to reset all account data.
 * Invalidates all query caches on success.
 */
export function useResetAccountData() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (userId: string) => resetAccountData(userId),
    onSuccess: () => {
      // Invalidate all data caches
      queryClient.invalidateQueries({ queryKey: bulletKeys.all })
      queryClient.invalidateQueries({ queryKey: resumeKeys.all })
      queryClient.invalidateQueries({ queryKey: runKeys.all })
      // Also invalidate any job-drafts and positions if they exist
      queryClient.invalidateQueries({ queryKey: ['job-drafts'] })
      queryClient.invalidateQueries({ queryKey: ['positions'] })
      queryClient.invalidateQueries({ queryKey: ['profiles'] })
    },
  })
}
