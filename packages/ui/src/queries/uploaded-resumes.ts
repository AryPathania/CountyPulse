import { useQuery } from '@tanstack/react-query'
import { getUploadedResumes } from '@odie/db'

// Query keys for cache management
export const uploadedResumeKeys = {
  all: ['uploadedResumes'] as const,
  lists: () => [...uploadedResumeKeys.all, 'list'] as const,
  list: (userId: string) => [...uploadedResumeKeys.lists(), userId] as const,
}

/**
 * Fetch all uploaded resumes for a user
 */
export function useUploadedResumes(userId: string | undefined) {
  return useQuery({
    queryKey: uploadedResumeKeys.list(userId ?? ''),
    queryFn: () => getUploadedResumes(userId!),
    enabled: !!userId,
  })
}
