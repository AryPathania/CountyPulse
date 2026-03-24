import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getJobDraftWithBullets,
  getJobDrafts,
  deleteJobDraft,
} from '@odie/db'
import { analyzeJobDescriptionGaps, type GapAnalysisStage } from '../services/jd-processing'

// Query keys for cache management
export const jobDraftKeys = {
  all: ['jobDrafts'] as const,
  lists: () => [...jobDraftKeys.all, 'list'] as const,
  list: (userId: string) => [...jobDraftKeys.lists(), userId] as const,
  details: () => [...jobDraftKeys.all, 'detail'] as const,
  detail: (id: string) => [...jobDraftKeys.details(), id] as const,
  withBullets: (id: string) => [...jobDraftKeys.detail(id), 'bullets'] as const,
}

/**
 * Fetch a single job draft with its matched bullets
 */
export function useJobDraftWithBullets(id: string | undefined) {
  return useQuery({
    queryKey: jobDraftKeys.withBullets(id ?? ''),
    queryFn: () => getJobDraftWithBullets(id!),
    enabled: !!id && id !== 'draft',
  })
}

/**
 * Fetch all job drafts for a user
 */
export function useJobDrafts(userId: string | undefined) {
  return useQuery({
    queryKey: jobDraftKeys.list(userId ?? ''),
    queryFn: () => getJobDrafts(userId!),
    enabled: !!userId,
  })
}

/**
 * Mutation to delete a job draft
 */
export function useDeleteJobDraft() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (draftId: string) => deleteJobDraft(draftId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: jobDraftKeys.lists() })
    },
  })
}

/**
 * Mutation to run gap analysis on a job draft
 */
export function useRunGapAnalysis() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ userId, jdText, draftId, skills, onProgress }: { userId: string; jdText: string; draftId: string; skills?: { hard: string[]; soft: string[] }; onProgress?: (stage: GapAnalysisStage) => void }) => {
      return analyzeJobDescriptionGaps(userId, jdText, draftId, skills, onProgress)
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: jobDraftKeys.withBullets(variables.draftId) })
      queryClient.invalidateQueries({ queryKey: jobDraftKeys.lists() })
    },
  })
}
