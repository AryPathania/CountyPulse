import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getResumes,
  getResume,
  getResumeWithBullets,
  createResume,
  updateResume,
  updateResumeContent,
  deleteResume,
  createResumeFromDraft,
  type Resume,
  type ResumeContent,
} from '@odie/db'

// Query keys for cache management
export const resumeKeys = {
  all: ['resumes'] as const,
  lists: () => [...resumeKeys.all, 'list'] as const,
  list: (userId: string) => [...resumeKeys.lists(), userId] as const,
  details: () => [...resumeKeys.all, 'detail'] as const,
  detail: (id: string) => [...resumeKeys.details(), id] as const,
  withBullets: (id: string) => [...resumeKeys.detail(id), 'bullets'] as const,
}

/**
 * Fetch all resumes for a user
 */
export function useResumes(userId: string | undefined) {
  return useQuery({
    queryKey: resumeKeys.list(userId ?? ''),
    queryFn: () => getResumes(userId!),
    enabled: !!userId,
  })
}

/**
 * Fetch a single resume by ID
 */
export function useResume(id: string | undefined) {
  return useQuery({
    queryKey: resumeKeys.detail(id ?? ''),
    queryFn: () => getResume(id!),
    enabled: !!id,
  })
}

/**
 * Fetch a resume with its associated bullets
 */
export function useResumeWithBullets(id: string | undefined) {
  return useQuery({
    queryKey: resumeKeys.withBullets(id ?? ''),
    queryFn: () => getResumeWithBullets(id!),
    enabled: !!id,
  })
}

/**
 * Mutation to create a new resume
 */
export function useCreateResume() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: { user_id: string; name: string; content?: ResumeContent }) =>
      createResume(data),
    onSuccess: (newResume: Resume) => {
      queryClient.invalidateQueries({ queryKey: resumeKeys.lists() })
      queryClient.setQueryData(resumeKeys.detail(newResume.id), newResume)
    },
  })
}

/**
 * Mutation to update a resume
 */
export function useUpdateResume() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      resumeId,
      updates,
    }: {
      resumeId: string
      updates: { name?: string; template_id?: string; content?: ResumeContent }
    }) => updateResume(resumeId, updates),
    onSuccess: (updatedResume: Resume) => {
      queryClient.invalidateQueries({ queryKey: resumeKeys.lists() })
      queryClient.setQueryData(resumeKeys.detail(updatedResume.id), updatedResume)
      queryClient.invalidateQueries({
        queryKey: resumeKeys.withBullets(updatedResume.id),
      })
    },
  })
}

/**
 * Mutation to update resume content (sections ordering)
 */
export function useUpdateResumeContent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ resumeId, content }: { resumeId: string; content: ResumeContent }) =>
      updateResumeContent(resumeId, content),
    onSuccess: (updatedResume: Resume) => {
      queryClient.setQueryData(resumeKeys.detail(updatedResume.id), updatedResume)
      queryClient.invalidateQueries({
        queryKey: resumeKeys.withBullets(updatedResume.id),
      })
    },
  })
}

/**
 * Mutation to delete a resume
 */
export function useDeleteResume() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (resumeId: string) => deleteResume(resumeId),
    onSuccess: (_result, resumeId) => {
      queryClient.invalidateQueries({ queryKey: resumeKeys.lists() })
      queryClient.removeQueries({ queryKey: resumeKeys.detail(resumeId) })
    },
  })
}

/**
 * Mutation to create a resume from a job draft
 */
export function useCreateResumeFromDraft() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      userId,
      name,
      bulletIds,
    }: {
      userId: string
      name: string
      bulletIds: string[]
    }) => createResumeFromDraft(userId, name, bulletIds),
    onSuccess: (newResume: Resume) => {
      queryClient.invalidateQueries({ queryKey: resumeKeys.lists() })
      queryClient.setQueryData(resumeKeys.detail(newResume.id), newResume)
    },
  })
}
