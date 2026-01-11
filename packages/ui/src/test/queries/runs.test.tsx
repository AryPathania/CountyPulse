import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '../../lib/queryClient'
import { useRecentRuns, useRunsByType, useLogRun, useRunLogger, runKeys } from '../../queries/runs'
import * as dbModule from '@odie/db'

// Mock @odie/db
vi.mock('@odie/db', async (importOriginal) => {
  const actual = await importOriginal<typeof dbModule>()
  return {
    ...actual,
    getRecentRuns: vi.fn(),
    getRunsByType: vi.fn(),
    logRun: vi.fn(),
    createRunLogger: vi.fn(),
  }
})

const mockRuns = [
  {
    id: 'run-1',
    user_id: 'user-1',
    type: 'interview',
    prompt_id: 'prompt-1',
    model: 'gpt-4',
    input: { message: 'Hello' },
    output: { response: 'Hi!' },
    success: true,
    latency_ms: 1500,
    tokens_in: 100,
    tokens_out: 50,
    created_at: '2024-01-15T10:30:00Z',
  },
  {
    id: 'run-2',
    user_id: 'user-1',
    type: 'embed',
    prompt_id: null,
    model: 'text-embedding-3-small',
    input: { text: 'Test' },
    output: { embedding: [] },
    success: true,
    latency_ms: 200,
    tokens_in: 10,
    tokens_out: null,
    created_at: '2024-01-15T10:25:00Z',
  },
]

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('runs queries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    queryClient.clear()
  })

  describe('runKeys', () => {
    it('should generate correct query keys', () => {
      expect(runKeys.all).toEqual(['runs'])
      expect(runKeys.lists()).toEqual(['runs', 'list'])
      expect(runKeys.list('user-123')).toEqual(['runs', 'list', 'user-123'])
      expect(runKeys.byType('user-123', 'interview')).toEqual([
        'runs',
        'list',
        'user-123',
        'interview',
      ])
    })
  })

  describe('useRecentRuns', () => {
    it('should fetch recent runs for a user', async () => {
      vi.mocked(dbModule.getRecentRuns).mockResolvedValue(mockRuns)

      const { result } = renderHook(() => useRecentRuns('user-1'), { wrapper })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(dbModule.getRecentRuns).toHaveBeenCalledWith('user-1', 50)
      expect(result.current.data).toEqual(mockRuns)
    })

    it('should use custom limit', async () => {
      vi.mocked(dbModule.getRecentRuns).mockResolvedValue(mockRuns)

      const { result } = renderHook(() => useRecentRuns('user-1', 100), {
        wrapper,
      })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(dbModule.getRecentRuns).toHaveBeenCalledWith('user-1', 100)
    })

    it('should not fetch when userId is undefined', () => {
      renderHook(() => useRecentRuns(undefined), { wrapper })

      expect(dbModule.getRecentRuns).not.toHaveBeenCalled()
    })

    it('should return loading state initially', () => {
      vi.mocked(dbModule.getRecentRuns).mockReturnValue(
        new Promise(() => {
          // Never resolves - keeps loading state
        })
      )

      const { result } = renderHook(() => useRecentRuns('user-1'), { wrapper })

      expect(result.current.isLoading).toBe(true)
      expect(result.current.data).toBeUndefined()
    })
  })

  describe('useRunsByType', () => {
    it('should fetch runs by type', async () => {
      const interviewRuns = mockRuns.filter((r) => r.type === 'interview')
      vi.mocked(dbModule.getRunsByType).mockResolvedValue(interviewRuns)

      const { result } = renderHook(
        () => useRunsByType('user-1', 'interview'),
        { wrapper }
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(dbModule.getRunsByType).toHaveBeenCalledWith(
        'user-1',
        'interview',
        100
      )
      expect(result.current.data).toEqual(interviewRuns)
    })

    it('should use custom limit', async () => {
      vi.mocked(dbModule.getRunsByType).mockResolvedValue(mockRuns)

      const { result } = renderHook(
        () => useRunsByType('user-1', 'embed', 50),
        { wrapper }
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(dbModule.getRunsByType).toHaveBeenCalledWith('user-1', 'embed', 50)
    })

    it('should not fetch when userId is undefined', () => {
      renderHook(() => useRunsByType(undefined, 'interview'), { wrapper })

      expect(dbModule.getRunsByType).not.toHaveBeenCalled()
    })

    it('should return loading state initially', () => {
      vi.mocked(dbModule.getRunsByType).mockReturnValue(
        new Promise(() => {
          // Never resolves - keeps loading state
        })
      )

      const { result } = renderHook(
        () => useRunsByType('user-1', 'interview'),
        { wrapper }
      )

      expect(result.current.isLoading).toBe(true)
      expect(result.current.data).toBeUndefined()
    })
  })

  describe('useLogRun', () => {
    it('should provide a mutation function', () => {
      const { result } = renderHook(() => useLogRun(), { wrapper })

      expect(result.current.mutate).toBeDefined()
      expect(result.current.mutateAsync).toBeDefined()
    })

    it('should call logRun when mutate is called', async () => {
      const mockRun = {
        user_id: 'user-1',
        type: 'export' as const,
        input: { resumeId: 'resume-1' },
        output: { action: 'print' },
        success: true,
        latency_ms: 0,
      }

      vi.mocked(dbModule.logRun).mockResolvedValue({
        id: 'new-run-id',
        ...mockRun,
        created_at: '2024-01-15T10:30:00Z',
        model: null,
        prompt_id: null,
        tokens_in: null,
        tokens_out: null,
      })

      const { result } = renderHook(() => useLogRun(), { wrapper })

      await result.current.mutateAsync(mockRun)

      expect(dbModule.logRun).toHaveBeenCalledWith(mockRun)
    })
  })

  describe('useRunLogger', () => {
    it('should return no-op functions when userId is undefined', () => {
      const { result } = renderHook(() => useRunLogger(undefined, 'export'), {
        wrapper,
      })

      expect(result.current.success).toBeDefined()
      expect(result.current.failure).toBeDefined()
    })

    it('should return null from no-op success when userId is undefined', async () => {
      const { result } = renderHook(() => useRunLogger(undefined, 'export'), {
        wrapper,
      })

      const successResult = await result.current.success()
      expect(successResult).toBeNull()
    })

    it('should return null from no-op failure when userId is undefined', async () => {
      const { result } = renderHook(() => useRunLogger(undefined, 'export'), {
        wrapper,
      })

      const failureResult = await result.current.failure()
      expect(failureResult).toBeNull()
    })

    it('should call createRunLogger when userId is provided', () => {
      const mockLogger = {
        success: vi.fn(),
        failure: vi.fn(),
      }
      vi.mocked(dbModule.createRunLogger).mockReturnValue(mockLogger)

      const { result } = renderHook(() => useRunLogger('user-1', 'draft', 'prompt-v1'), {
        wrapper,
      })

      expect(dbModule.createRunLogger).toHaveBeenCalledWith('user-1', 'draft', 'prompt-v1')
      expect(result.current).toBe(mockLogger)
    })
  })
})
