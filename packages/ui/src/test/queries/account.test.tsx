import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useResetAccountData } from '../../queries/account'

const mockResetAccountData = vi.fn()

vi.mock('@odie/db', () => ({
  resetAccountData: (...args: unknown[]) => mockResetAccountData(...args),
}))

vi.mock('../../queries/bullets', () => ({
  bulletKeys: { all: ['bullets'] },
}))

vi.mock('../../queries/resumes', () => ({
  resumeKeys: { all: ['resumes'] },
}))

vi.mock('../../queries/runs', () => ({
  runKeys: { all: ['runs'] },
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('account queries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('useResetAccountData', () => {
    it('should call resetAccountData with userId', async () => {
      mockResetAccountData.mockResolvedValue(undefined)

      const { result } = renderHook(() => useResetAccountData(), {
        wrapper: createWrapper(),
      })

      result.current.mutate('user-123')

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockResetAccountData).toHaveBeenCalledWith('user-123')
    })

    it('should invalidate all query caches on success', async () => {
      mockResetAccountData.mockResolvedValue(undefined)

      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      })
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      )

      const { result } = renderHook(() => useResetAccountData(), { wrapper })

      result.current.mutate('user-123')

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      // Should invalidate all major data caches
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['bullets'] })
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['resumes'] })
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['runs'] })
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['job-drafts'] })
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['positions'] })
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['profiles'] })
    })

    it('should handle reset error', async () => {
      mockResetAccountData.mockRejectedValue(new Error('Reset failed'))

      const { result } = renderHook(() => useResetAccountData(), {
        wrapper: createWrapper(),
      })

      result.current.mutate('user-123')

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toBeInstanceOf(Error)
    })

    it('should not invalidate caches on error', async () => {
      mockResetAccountData.mockRejectedValue(new Error('Reset failed'))

      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      })
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      )

      const { result } = renderHook(() => useResetAccountData(), { wrapper })

      result.current.mutate('user-123')

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      // onSuccess should not have been called
      expect(invalidateSpy).not.toHaveBeenCalled()
    })
  })
})
