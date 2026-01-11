import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useBullets, useBullet, useUpdateBullet, useDeleteBullet, bulletKeys } from '../../queries/bullets'

// Mock @odie/db functions
const mockGetBullets = vi.fn()
const mockGetBullet = vi.fn()
const mockUpdateBullet = vi.fn()
const mockDeleteBullet = vi.fn()

vi.mock('@odie/db', () => ({
  getBullets: (...args: unknown[]) => mockGetBullets(...args),
  getBullet: (...args: unknown[]) => mockGetBullet(...args),
  updateBullet: (...args: unknown[]) => mockUpdateBullet(...args),
  deleteBullet: (...args: unknown[]) => mockDeleteBullet(...args),
}))

// Test data
const mockBulletsList = [
  {
    id: 'bullet-1',
    user_id: 'user-123',
    current_text: 'Led team of 5 engineers',
    category: 'Leadership',
    position: { company: 'Tech Corp', title: 'Lead' },
  },
  {
    id: 'bullet-2',
    user_id: 'user-123',
    current_text: 'Reduced latency by 40%',
    category: 'Backend',
    position: { company: 'Tech Corp', title: 'Lead' },
  },
]

const mockSingleBullet = {
  id: 'bullet-1',
  user_id: 'user-123',
  current_text: 'Led team of 5 engineers',
  category: 'Leadership',
  position: { company: 'Tech Corp', title: 'Lead' },
}

// Wrapper component for hooks
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('bullets queries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('bulletKeys', () => {
    it('should generate correct query keys', () => {
      expect(bulletKeys.all).toEqual(['bullets'])
      expect(bulletKeys.lists()).toEqual(['bullets', 'list'])
      expect(bulletKeys.list('user-123')).toEqual(['bullets', 'list', 'user-123'])
      expect(bulletKeys.details()).toEqual(['bullets', 'detail'])
      expect(bulletKeys.detail('bullet-1')).toEqual(['bullets', 'detail', 'bullet-1'])
    })
  })

  describe('useBullets', () => {
    it('should fetch bullets for a user', async () => {
      mockGetBullets.mockResolvedValue(mockBulletsList)

      const { result } = renderHook(() => useBullets('user-123'), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockBulletsList)
      expect(mockGetBullets).toHaveBeenCalledWith('user-123')
    })

    it('should not fetch when userId is undefined', () => {
      const { result } = renderHook(() => useBullets(undefined), {
        wrapper: createWrapper(),
      })

      expect(result.current.isFetching).toBe(false)
      expect(mockGetBullets).not.toHaveBeenCalled()
    })

    it('should handle fetch error', async () => {
      mockGetBullets.mockRejectedValue(new Error('Failed to fetch'))

      const { result } = renderHook(() => useBullets('user-123'), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toBeInstanceOf(Error)
    })
  })

  describe('useBullet', () => {
    it('should fetch a single bullet by ID', async () => {
      mockGetBullet.mockResolvedValue(mockSingleBullet)

      const { result } = renderHook(() => useBullet('bullet-1'), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockSingleBullet)
      expect(mockGetBullet).toHaveBeenCalledWith('bullet-1')
    })

    it('should not fetch when id is undefined', () => {
      const { result } = renderHook(() => useBullet(undefined), {
        wrapper: createWrapper(),
      })

      expect(result.current.isFetching).toBe(false)
      expect(mockGetBullet).not.toHaveBeenCalled()
    })
  })

  describe('useUpdateBullet', () => {
    it('should update a bullet and invalidate queries', async () => {
      const updatedBullet = {
        ...mockSingleBullet,
        current_text: 'Updated text',
      }
      mockUpdateBullet.mockResolvedValue(updatedBullet)

      const queryClient = new QueryClient()
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
      const setQueryDataSpy = vi.spyOn(queryClient, 'setQueryData')

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      )

      const { result } = renderHook(() => useUpdateBullet(), { wrapper })

      result.current.mutate({
        bulletId: 'bullet-1',
        updates: { current_text: 'Updated text' },
      })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockUpdateBullet).toHaveBeenCalledWith('bullet-1', {
        current_text: 'Updated text',
      })

      // Should invalidate list queries
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: bulletKeys.lists(),
      })

      // Should update detail cache
      expect(setQueryDataSpy).toHaveBeenCalled()
    })

    it('should handle update error', async () => {
      mockUpdateBullet.mockRejectedValue(new Error('Update failed'))

      const { result } = renderHook(() => useUpdateBullet(), {
        wrapper: createWrapper(),
      })

      result.current.mutate({
        bulletId: 'bullet-1',
        updates: { current_text: 'Updated text' },
      })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })
    })
  })

  describe('useDeleteBullet', () => {
    it('should delete a bullet and invalidate queries', async () => {
      mockDeleteBullet.mockResolvedValue(undefined)

      const queryClient = new QueryClient()
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
      const removeQueriesSpy = vi.spyOn(queryClient, 'removeQueries')

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      )

      const { result } = renderHook(() => useDeleteBullet(), { wrapper })

      result.current.mutate('bullet-1')

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockDeleteBullet).toHaveBeenCalledWith('bullet-1')

      // Should invalidate list queries
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: bulletKeys.lists(),
      })

      // Should remove from detail cache
      expect(removeQueriesSpy).toHaveBeenCalledWith({
        queryKey: bulletKeys.detail('bullet-1'),
      })
    })

    it('should handle delete error', async () => {
      mockDeleteBullet.mockRejectedValue(new Error('Delete failed'))

      const { result } = renderHook(() => useDeleteBullet(), {
        wrapper: createWrapper(),
      })

      result.current.mutate('bullet-1')

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })
    })
  })
})
