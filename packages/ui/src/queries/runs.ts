import { useQuery, useMutation } from '@tanstack/react-query'
import { getRecentRuns, getRunsByType, logRun, createRunLogger, type RunType, type Run, type NewRun } from '@odie/db'

// Query keys for cache management
export const runKeys = {
  all: ['runs'] as const,
  lists: () => [...runKeys.all, 'list'] as const,
  list: (userId: string) => [...runKeys.lists(), userId] as const,
  byType: (userId: string, type: RunType) => [...runKeys.list(userId), type] as const,
}

/**
 * Fetch recent runs for a user
 */
export function useRecentRuns(userId: string | undefined, limit: number = 50) {
  return useQuery({
    queryKey: [...runKeys.list(userId ?? ''), limit] as const,
    queryFn: () => getRecentRuns(userId!, limit),
    enabled: !!userId,
  })
}

/**
 * Fetch runs by type for a user
 */
export function useRunsByType(
  userId: string | undefined,
  type: RunType,
  limit: number = 100
) {
  return useQuery({
    queryKey: runKeys.byType(userId ?? '', type),
    queryFn: () => getRunsByType(userId!, type, limit),
    enabled: !!userId,
  })
}

/**
 * Mutation hook for logging a run
 */
export function useLogRun() {
  return useMutation({
    mutationFn: (run: NewRun) => logRun(run),
  })
}

/**
 * Create a run logger utility for tracking timing and success/failure
 */
export function useRunLogger(userId: string | undefined, type: RunType, promptId?: string) {
  if (!userId) {
    // Return no-op functions when user is not logged in
    return {
      async success() { return null },
      async failure() { return null },
    }
  }
  return createRunLogger(userId, type, promptId)
}

// Re-export types and utilities
export type { Run, RunType, NewRun }
export { createRunLogger }
