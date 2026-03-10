import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  jobDraftKeys,
  useJobDraftWithBullets,
  useJobDrafts,
  useRunGapAnalysis,
} from '../../queries/job-drafts'

const mockGetJobDraftWithBullets = vi.fn()
const mockGetJobDrafts = vi.fn()
const mockAnalyzeJobDescriptionGaps = vi.fn()

vi.mock('@odie/db', () => ({
  getJobDraftWithBullets: (...args: unknown[]) => mockGetJobDraftWithBullets(...args),
  getJobDrafts: (...args: unknown[]) => mockGetJobDrafts(...args),
}))

vi.mock('../../services/jd-processing', () => ({
  analyzeJobDescriptionGaps: (...args: unknown[]) => mockAnalyzeJobDescriptionGaps(...args),
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return {
    queryClient,
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  }
}

describe('job-drafts queries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('jobDraftKeys', () => {
    it('produces correct all key', () => {
      expect(jobDraftKeys.all).toEqual(['jobDrafts'])
    })

    it('produces correct lists key', () => {
      expect(jobDraftKeys.lists()).toEqual(['jobDrafts', 'list'])
    })

    it('produces correct list key with userId', () => {
      expect(jobDraftKeys.list('user-123')).toEqual(['jobDrafts', 'list', 'user-123'])
    })

    it('produces correct details key', () => {
      expect(jobDraftKeys.details()).toEqual(['jobDrafts', 'detail'])
    })

    it('produces correct detail key with id', () => {
      expect(jobDraftKeys.detail('draft-456')).toEqual(['jobDrafts', 'detail', 'draft-456'])
    })

    it('produces correct withBullets key', () => {
      expect(jobDraftKeys.withBullets('draft-789')).toEqual([
        'jobDrafts',
        'detail',
        'draft-789',
        'bullets',
      ])
    })
  })

  describe('useJobDraftWithBullets', () => {
    it('fetches when id is provided', async () => {
      const mockDraft = { id: 'draft-1', jd_text: 'Test JD', bullets: [] }
      mockGetJobDraftWithBullets.mockResolvedValue(mockDraft)

      const { wrapper } = createWrapper()
      const { result } = renderHook(() => useJobDraftWithBullets('draft-1'), { wrapper })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockGetJobDraftWithBullets).toHaveBeenCalledWith('draft-1')
      expect(result.current.data).toEqual(mockDraft)
    })

    it('does not fetch when id is undefined', () => {
      const { wrapper } = createWrapper()
      const { result } = renderHook(() => useJobDraftWithBullets(undefined), { wrapper })

      expect(result.current.fetchStatus).toBe('idle')
      expect(mockGetJobDraftWithBullets).not.toHaveBeenCalled()
    })

    it('does not fetch when id is "draft"', () => {
      const { wrapper } = createWrapper()
      const { result } = renderHook(() => useJobDraftWithBullets('draft'), { wrapper })

      expect(result.current.fetchStatus).toBe('idle')
      expect(mockGetJobDraftWithBullets).not.toHaveBeenCalled()
    })

    it('handles fetch error', async () => {
      mockGetJobDraftWithBullets.mockRejectedValue(new Error('Not found'))

      const { wrapper } = createWrapper()
      const { result } = renderHook(() => useJobDraftWithBullets('draft-bad'), { wrapper })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toBeInstanceOf(Error)
    })
  })

  describe('useJobDrafts', () => {
    it('fetches when userId is provided', async () => {
      const mockDrafts = [
        { id: 'draft-1', jd_text: 'JD 1' },
        { id: 'draft-2', jd_text: 'JD 2' },
      ]
      mockGetJobDrafts.mockResolvedValue(mockDrafts)

      const { wrapper } = createWrapper()
      const { result } = renderHook(() => useJobDrafts('user-123'), { wrapper })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockGetJobDrafts).toHaveBeenCalledWith('user-123')
      expect(result.current.data).toEqual(mockDrafts)
    })

    it('does not fetch when userId is undefined', () => {
      const { wrapper } = createWrapper()
      const { result } = renderHook(() => useJobDrafts(undefined), { wrapper })

      expect(result.current.fetchStatus).toBe('idle')
      expect(mockGetJobDrafts).not.toHaveBeenCalled()
    })

    it('handles fetch error', async () => {
      mockGetJobDrafts.mockRejectedValue(new Error('DB error'))

      const { wrapper } = createWrapper()
      const { result } = renderHook(() => useJobDrafts('user-bad'), { wrapper })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toBeInstanceOf(Error)
    })
  })

  describe('useRunGapAnalysis', () => {
    it('calls analyzeJobDescriptionGaps with correct arguments', async () => {
      const mockResult = {
        draftId: 'draft-1',
        jobTitle: 'Engineer',
        company: 'Acme',
        covered: [],
        gaps: [],
        totalRequirements: 5,
        coveredCount: 3,
        interviewContext: null,
      }
      mockAnalyzeJobDescriptionGaps.mockResolvedValue(mockResult)

      const { wrapper } = createWrapper()
      const { result } = renderHook(() => useRunGapAnalysis(), { wrapper })

      await act(async () => {
        result.current.mutate({
          userId: 'user-123',
          jdText: 'Looking for a senior engineer...',
          draftId: 'draft-1',
        })
      })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockAnalyzeJobDescriptionGaps).toHaveBeenCalledWith(
        'user-123',
        'Looking for a senior engineer...',
        'draft-1'
      )
    })

    it('invalidates queries on success', async () => {
      mockAnalyzeJobDescriptionGaps.mockResolvedValue({
        draftId: 'draft-1',
        jobTitle: 'Engineer',
        company: null,
        covered: [],
        gaps: [],
        totalRequirements: 0,
        coveredCount: 0,
        interviewContext: null,
      })

      const { queryClient, wrapper } = createWrapper()
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

      const { result } = renderHook(() => useRunGapAnalysis(), { wrapper })

      await act(async () => {
        result.current.mutate({
          userId: 'user-123',
          jdText: 'Some JD',
          draftId: 'draft-1',
        })
      })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['jobDrafts', 'detail', 'draft-1', 'bullets'],
      })
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['jobDrafts', 'list'],
      })
    })

    it('does not invalidate queries on error', async () => {
      mockAnalyzeJobDescriptionGaps.mockRejectedValue(new Error('Analysis failed'))

      const { queryClient, wrapper } = createWrapper()
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

      const { result } = renderHook(() => useRunGapAnalysis(), { wrapper })

      await act(async () => {
        result.current.mutate({
          userId: 'user-123',
          jdText: 'Bad JD',
          draftId: 'draft-fail',
        })
      })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(invalidateSpy).not.toHaveBeenCalled()
    })

    it('handles mutation error', async () => {
      mockAnalyzeJobDescriptionGaps.mockRejectedValue(new Error('Network error'))

      const { wrapper } = createWrapper()
      const { result } = renderHook(() => useRunGapAnalysis(), { wrapper })

      await act(async () => {
        result.current.mutate({
          userId: 'user-123',
          jdText: 'Some JD',
          draftId: 'draft-1',
        })
      })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toBeInstanceOf(Error)
      expect((result.current.error as Error).message).toBe('Network error')
    })
  })
})
