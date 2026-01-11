import { describe, it, expect, vi, beforeEach } from 'vitest'
import { processJobDescription, extractJobMetadata } from '../../services/jd-processing'

// Mock @odie/db
const mockGetSession = vi.fn()
const mockFunctionsInvoke = vi.fn()
const mockMatchBulletsForJd = vi.fn()
const mockCreateJobDraft = vi.fn()
const mockRunLoggerSuccess = vi.fn().mockResolvedValue({})
const mockRunLoggerFailure = vi.fn().mockResolvedValue({})
const mockCreateRunLogger = vi.fn(() => ({
  success: mockRunLoggerSuccess,
  failure: mockRunLoggerFailure,
}))

vi.mock('@odie/db', () => ({
  supabase: {
    auth: {
      getSession: () => mockGetSession(),
    },
    functions: {
      invoke: (...args: unknown[]) => mockFunctionsInvoke(...args),
    },
  },
  matchBulletsForJd: (...args: unknown[]) => mockMatchBulletsForJd(...args),
  createJobDraft: (...args: unknown[]) => mockCreateJobDraft(...args),
  createRunLogger: (...args: unknown[]) => mockCreateRunLogger(...args),
}))

describe('jd-processing service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('processJobDescription', () => {
    it('should process JD and return draft ID with matched bullets', async () => {
      // Setup mocks for authenticated flow
      mockGetSession.mockResolvedValue({
        data: { session: { access_token: 'test-token' } },
      })

      mockFunctionsInvoke.mockResolvedValue({
        data: { embedding: new Array(1536).fill(0.1) },
        error: null,
      })

      mockMatchBulletsForJd.mockResolvedValue([
        { id: 'bullet-1', current_text: 'Test bullet 1', category: 'Leadership', similarity: 0.9 },
        { id: 'bullet-2', current_text: 'Test bullet 2', category: 'Backend', similarity: 0.8 },
      ])

      mockCreateJobDraft.mockResolvedValue({
        id: 'draft-123',
        user_id: 'user-123',
        jd_text: 'Test JD',
      })

      const result = await processJobDescription('user-123', 'Test job description')

      expect(result).toEqual({
        draftId: 'draft-123',
        matchedBulletIds: ['bullet-1', 'bullet-2'],
      })

      // Verify embed function was called
      expect(mockFunctionsInvoke).toHaveBeenCalledWith('embed', {
        body: { text: 'Test job description', type: 'jd' },
      })

      // Verify bullet matching was called
      expect(mockMatchBulletsForJd).toHaveBeenCalledWith(
        'user-123',
        expect.any(Array),
        50,
        0.3
      )

      // Verify draft was created with correct data
      expect(mockCreateJobDraft).toHaveBeenCalledWith({
        user_id: 'user-123',
        jd_text: 'Test job description',
        jd_embedding: expect.stringMatching(/^\[[\d.,]+\]$/),
        retrieved_bullet_ids: ['bullet-1', 'bullet-2'],
        selected_bullet_ids: ['bullet-1', 'bullet-2'],
      })

      // Verify success telemetry was logged
      expect(mockCreateRunLogger).toHaveBeenCalledWith('user-123', 'draft')
      expect(mockRunLoggerSuccess).toHaveBeenCalledWith({
        input: {
          jdTextLength: 20,
          jdTextPreview: 'Test job description',
        },
        output: {
          draftId: 'draft-123',
          matchedBulletCount: 2,
          selectedBulletIds: ['bullet-1', 'bullet-2'],
        },
      })
    })

    it('should throw error when not authenticated', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: null },
      })

      await expect(processJobDescription('user-123', 'Test JD')).rejects.toThrow(
        'Not authenticated'
      )

      // Should log failure telemetry
      expect(mockRunLoggerFailure).toHaveBeenCalledWith({
        input: { jdTextLength: 7 },
        error: 'Not authenticated',
      })
    })

    it('should throw error when embed function fails', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: { access_token: 'test-token' } },
      })

      mockFunctionsInvoke.mockResolvedValue({
        data: null,
        error: { message: 'Embedding failed' },
      })

      await expect(processJobDescription('user-123', 'Test JD')).rejects.toThrow(
        'Embedding failed'
      )

      // Should log failure telemetry
      expect(mockRunLoggerFailure).toHaveBeenCalledWith({
        input: { jdTextLength: 7 },
        error: 'Embedding failed',
      })
    })

    it('should use mock mode when configured', async () => {
      mockCreateJobDraft.mockResolvedValue({
        id: 'mock-draft-123',
        user_id: 'user-123',
        jd_text: 'Test JD',
      })

      const result = await processJobDescription('user-123', 'Test JD', { useMock: true })

      expect(result.draftId).toBe('mock-draft-123')
      expect(result.matchedBulletIds).toEqual([
        'mock-bullet-1',
        'mock-bullet-2',
        'mock-bullet-3',
      ])

      // Should not call embed function in mock mode
      expect(mockFunctionsInvoke).not.toHaveBeenCalled()
      expect(mockMatchBulletsForJd).not.toHaveBeenCalled()
    })

    it('should pre-select top 10 bullets', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: { access_token: 'test-token' } },
      })

      mockFunctionsInvoke.mockResolvedValue({
        data: { embedding: new Array(1536).fill(0.1) },
        error: null,
      })

      // Return 15 bullets to test slicing
      const manyBullets = Array.from({ length: 15 }, (_, i) => ({
        id: `bullet-${i}`,
        current_text: `Bullet ${i}`,
        category: 'Test',
        similarity: 0.9 - i * 0.01,
      }))

      mockMatchBulletsForJd.mockResolvedValue(manyBullets)

      mockCreateJobDraft.mockResolvedValue({
        id: 'draft-123',
        user_id: 'user-123',
      })

      await processJobDescription('user-123', 'Test JD')

      // Verify only top 10 are pre-selected
      expect(mockCreateJobDraft).toHaveBeenCalledWith(
        expect.objectContaining({
          selected_bullet_ids: manyBullets.slice(0, 10).map((b) => b.id),
        })
      )
    })
  })

  describe('extractJobMetadata', () => {
    it('should extract job title from first line', () => {
      const jdText = `Senior Software Engineer
      We are looking for a senior engineer to join our team.`

      const result = extractJobMetadata(jdText)

      expect(result.jobTitle).toBe('Senior Software Engineer')
    })

    it('should extract company name with "at" pattern', () => {
      const jdText = `Software Engineer
      Join us at Google.`

      const result = extractJobMetadata(jdText)

      expect(result.company).toBe('Google')
    })

    it('should extract company name with "@" pattern', () => {
      const jdText = `Software Engineer
      Position @ Microsoft`

      const result = extractJobMetadata(jdText)

      expect(result.company).toBe('Microsoft')
    })

    it('should extract company name with "for" pattern', () => {
      const jdText = `Software Engineer
      We are hiring for Amazon Web Services`

      const result = extractJobMetadata(jdText)

      expect(result.company).toBe('Amazon Web Services')
    })

    it('should truncate long job titles', () => {
      const longTitle = 'A'.repeat(150)
      const jdText = `${longTitle}
      Some description here.`

      const result = extractJobMetadata(jdText)

      expect(result.jobTitle?.length).toBe(100)
    })

    it('should handle empty JD text', () => {
      const result = extractJobMetadata('')

      expect(result.jobTitle).toBeUndefined()
      expect(result.company).toBeUndefined()
    })

    it('should handle JD without company pattern', () => {
      const jdText = `Software Engineer
      We need an experienced developer.
      Must have 5 years of experience.`

      const result = extractJobMetadata(jdText)

      expect(result.jobTitle).toBe('Software Engineer')
      expect(result.company).toBeUndefined()
    })
  })
})
