import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getBullets,
  getBullet,
  updateBullet,
  deleteBullet,
  type BulletWithPosition,
  type Bullet,
} from '@odie/db'

// Query keys for cache management
export const bulletKeys = {
  all: ['bullets'] as const,
  lists: () => [...bulletKeys.all, 'list'] as const,
  list: (userId: string) => [...bulletKeys.lists(), userId] as const,
  details: () => [...bulletKeys.all, 'detail'] as const,
  detail: (id: string) => [...bulletKeys.details(), id] as const,
}

/**
 * Fetch all bullets for a user
 */
export function useBullets(userId: string | undefined) {
  return useQuery({
    queryKey: bulletKeys.list(userId ?? ''),
    queryFn: () => getBullets(userId!),
    enabled: !!userId,
  })
}

/**
 * Fetch a single bullet by ID
 */
export function useBullet(id: string | undefined) {
  return useQuery({
    queryKey: bulletKeys.detail(id ?? ''),
    queryFn: () => getBullet(id!),
    enabled: !!id,
  })
}

export interface BulletUpdateInput {
  current_text?: string
  category?: string | null
  hard_skills?: string[] | null
  soft_skills?: string[] | null
}

/**
 * Mutation to update a bullet
 */
export function useUpdateBullet() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      bulletId,
      updates,
    }: {
      bulletId: string
      updates: BulletUpdateInput
    }) => updateBullet(bulletId, updates),
    onSuccess: (updatedBullet: Bullet) => {
      // Invalidate list queries to refetch with updated data
      queryClient.invalidateQueries({ queryKey: bulletKeys.lists() })
      // Update the detail cache
      queryClient.setQueryData<BulletWithPosition | null>(
        bulletKeys.detail(updatedBullet.id),
        (old) => (old ? { ...old, ...updatedBullet } : null)
      )
    },
  })
}

/**
 * Mutation to delete a bullet
 */
export function useDeleteBullet() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (bulletId: string) => deleteBullet(bulletId),
    onSuccess: (_result, bulletId) => {
      // Invalidate list queries
      queryClient.invalidateQueries({ queryKey: bulletKeys.lists() })
      // Remove from detail cache
      queryClient.removeQueries({ queryKey: bulletKeys.detail(bulletId) })
    },
  })
}
