import { describe, it, expect, vi, beforeEach } from 'vitest'
import { processJobDescription, analyzeJobDescriptionGaps } from '../../services/jd-processing'

// Mock @odie/db
const mockGetSession = vi.fn()
const mockFunctionsInvoke = vi.fn()
const mockMatchBulletsForJd = vi.fn()
const mockCreateJobDraft = vi.fn()
const mockMatchBulletsPerRequirement = vi.fn()
const mockUpdateJobDraftRequirements = vi.fn()
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
  matchBulletsPerRequirement: (...args: unknown[]) => mockMatchBulletsPerRequirement(...args),
  updateJobDraftRequirements: (...args: unknown[]) => mockUpdateJobDraftRequirements(...args),
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
        data: { embeddings: [new Array(1536).fill(0.1)] },
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
        body: { texts: ['Test job description'], type: 'jd' },
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
        data: { embeddings: [new Array(1536).fill(0.1)] },
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

  describe('analyzeJobDescriptionGaps', () => {
    const mockRequirements = [
      { description: 'Experience with React', category: 'Frontend', importance: 'must_have' },
      { description: 'Team leadership', category: 'Leadership', importance: 'must_have' },
      { description: 'AWS experience', category: 'Cloud', importance: 'nice_to_have' },
    ]

    const mockEmbeddings = [
      new Array(1536).fill(0.1),
      new Array(1536).fill(0.2),
      new Array(1536).fill(0.3),
    ]

    function setupAuthenticatedSession() {
      mockGetSession.mockResolvedValue({
        data: { session: { access_token: 'test-token' } },
      })
    }

    function setupParseJdResponse(overrides?: { jobTitle?: string; company?: string | null; requirements?: typeof mockRequirements }) {
      const defaults = {
        jobTitle: 'Senior Engineer',
        company: 'Acme Corp',
        requirements: mockRequirements,
      }
      const data = { ...defaults, ...overrides }
      // parse-jd is the first invoke call
      mockFunctionsInvoke.mockResolvedValueOnce({ data, error: null })
    }

    function setupEmbedResponse(embeddings = mockEmbeddings) {
      // embed is the second invoke call
      mockFunctionsInvoke.mockResolvedValueOnce({
        data: { embeddings },
        error: null,
      })
    }

    it('calls parse-jd edge function with the JD text', async () => {
      setupAuthenticatedSession()
      setupParseJdResponse()
      setupEmbedResponse()
      mockMatchBulletsPerRequirement.mockResolvedValue(
        mockRequirements.map(r => ({
          requirement: { description: r.description, category: r.category, importance: r.importance },
          matches: [{ id: 'b1', current_text: 'bullet text', category: 'Test', similarity: 0.8 }],
          isCovered: true,
        }))
      )
      mockUpdateJobDraftRequirements.mockResolvedValue({})

      await analyzeJobDescriptionGaps('user-1', 'Looking for a React dev', 'draft-1')

      expect(mockFunctionsInvoke).toHaveBeenCalledWith('parse-jd', {
        body: { text: 'Looking for a React dev' },
      })
    })

    it('calls embed with requirement descriptions (not job title/company)', async () => {
      setupAuthenticatedSession()
      setupParseJdResponse()
      setupEmbedResponse()
      mockMatchBulletsPerRequirement.mockResolvedValue(
        mockRequirements.map(r => ({
          requirement: { description: r.description, category: r.category, importance: r.importance },
          matches: [],
          isCovered: false,
        }))
      )
      mockUpdateJobDraftRequirements.mockResolvedValue({})

      await analyzeJobDescriptionGaps('user-1', 'Some JD', 'draft-1')

      expect(mockFunctionsInvoke).toHaveBeenCalledWith('embed', {
        body: {
          texts: ['Experience with React', 'Team leadership', 'AWS experience'],
          type: 'jd',
        },
      })
    })

    it('uses threshold 0.4 and top-5 when calling matchBulletsPerRequirement', async () => {
      setupAuthenticatedSession()
      setupParseJdResponse()
      setupEmbedResponse()
      mockMatchBulletsPerRequirement.mockResolvedValue(
        mockRequirements.map(r => ({
          requirement: { description: r.description, category: r.category, importance: r.importance },
          matches: [],
          isCovered: false,
        }))
      )
      mockUpdateJobDraftRequirements.mockResolvedValue({})

      await analyzeJobDescriptionGaps('user-1', 'Some JD', 'draft-1')

      expect(mockMatchBulletsPerRequirement).toHaveBeenCalledWith(
        'user-1',
        expect.arrayContaining([
          expect.objectContaining({
            description: 'Experience with React',
            embedding: mockEmbeddings[0],
          }),
        ]),
        5,
        0.4
      )
    })

    it('splits results into covered and gaps based on isCovered', async () => {
      setupAuthenticatedSession()
      setupParseJdResponse()
      setupEmbedResponse()

      mockMatchBulletsPerRequirement.mockResolvedValue([
        {
          requirement: { description: 'Experience with React', category: 'Frontend', importance: 'must_have' },
          matches: [{ id: 'b1', current_text: 'Built React app', category: 'Frontend', similarity: 0.85 }],
          isCovered: true,
        },
        {
          requirement: { description: 'Team leadership', category: 'Leadership', importance: 'must_have' },
          matches: [],
          isCovered: false,
        },
        {
          requirement: { description: 'AWS experience', category: 'Cloud', importance: 'nice_to_have' },
          matches: [],
          isCovered: false,
        },
      ])
      mockUpdateJobDraftRequirements.mockResolvedValue({})

      const result = await analyzeJobDescriptionGaps('user-1', 'JD text', 'draft-1')

      expect(result.covered).toHaveLength(1)
      expect(result.covered[0].requirement.description).toBe('Experience with React')
      expect(result.covered[0].matchedBullets).toEqual([
        { id: 'b1', text: 'Built React app', similarity: 0.85 },
      ])

      expect(result.gaps).toHaveLength(2)
      expect(result.gaps[0].requirement.description).toBe('Team leadership')
      expect(result.gaps[1].requirement.description).toBe('AWS experience')
      expect(result.coveredCount).toBe(1)
      expect(result.totalRequirements).toBe(3)
    })

    it('persists to DB via updateJobDraftRequirements before returning', async () => {
      setupAuthenticatedSession()
      setupParseJdResponse()
      setupEmbedResponse()

      mockMatchBulletsPerRequirement.mockResolvedValue([
        {
          requirement: { description: 'Experience with React', category: 'Frontend', importance: 'must_have' },
          matches: [{ id: 'b1', current_text: 'Built React app', category: 'Frontend', similarity: 0.85 }],
          isCovered: true,
        },
        {
          requirement: { description: 'Team leadership', category: 'Leadership', importance: 'must_have' },
          matches: [],
          isCovered: false,
        },
        {
          requirement: { description: 'AWS experience', category: 'Cloud', importance: 'nice_to_have' },
          matches: [],
          isCovered: false,
        },
      ])
      mockUpdateJobDraftRequirements.mockResolvedValue({})

      await analyzeJobDescriptionGaps('user-1', 'JD text', 'draft-1')

      expect(mockUpdateJobDraftRequirements).toHaveBeenCalledWith(
        'draft-1',
        mockRequirements,
        {
          jobTitle: 'Senior Engineer',
          company: 'Acme Corp',
          covered: [
            {
              requirement: { description: 'Experience with React', category: 'Frontend', importance: 'must_have' },
              matchedBulletIds: ['b1'],
            },
          ],
          gaps: [
            { description: 'Team leadership', category: 'Leadership', importance: 'must_have' },
            { description: 'AWS experience', category: 'Cloud', importance: 'nice_to_have' },
          ],
          totalRequirements: 3,
          coveredCount: 1,
        }
      )
    })

    it('builds gap interview context with mode gaps and first 10 bullet summaries', async () => {
      setupAuthenticatedSession()

      // Only 2 requirements but the covered one has 12 matched bullets
      const twoReqs = [
        { description: 'React', category: 'Frontend', importance: 'must_have' as const },
        { description: 'Go', category: 'Backend', importance: 'must_have' as const },
      ]
      setupParseJdResponse({ requirements: twoReqs })
      setupEmbedResponse([mockEmbeddings[0], mockEmbeddings[1]])

      const twelveBullets = Array.from({ length: 12 }, (_, i) => ({
        id: `b${i}`,
        current_text: `Bullet text ${i}`,
        category: 'Frontend',
        similarity: 0.9 - i * 0.01,
      }))

      mockMatchBulletsPerRequirement.mockResolvedValue([
        {
          requirement: { description: 'React', category: 'Frontend', importance: 'must_have' },
          matches: twelveBullets,
          isCovered: true,
        },
        {
          requirement: { description: 'Go', category: 'Backend', importance: 'must_have' },
          matches: [],
          isCovered: false,
        },
      ])
      mockUpdateJobDraftRequirements.mockResolvedValue({})

      const result = await analyzeJobDescriptionGaps('user-1', 'JD', 'draft-1')

      expect(result.interviewContext).not.toBeNull()
      expect(result.interviewContext!.mode).toBe('gaps')

      // Should include exactly the first 10 bullet texts joined by '; '
      const expectedSummary = twelveBullets.slice(0, 10).map(b => b.current_text).join('; ')
      expect(result.interviewContext!.existingBulletSummary).toBe(expectedSummary)

      // gaps should contain the uncovered requirement
      expect(result.interviewContext!.gaps).toEqual([
        { requirement: 'Go', category: 'Backend', importance: 'must_have' },
      ])
      expect(result.interviewContext!.jobTitle).toBe('Senior Engineer')
      expect(result.interviewContext!.company).toBe('Acme Corp')
    })

    it('returns null interviewContext when all requirements are covered', async () => {
      setupAuthenticatedSession()
      setupParseJdResponse()
      setupEmbedResponse()

      mockMatchBulletsPerRequirement.mockResolvedValue(
        mockRequirements.map(r => ({
          requirement: { description: r.description, category: r.category, importance: r.importance },
          matches: [{ id: 'b1', current_text: 'Some bullet', category: 'Test', similarity: 0.8 }],
          isCovered: true,
        }))
      )
      mockUpdateJobDraftRequirements.mockResolvedValue({})

      const result = await analyzeJobDescriptionGaps('user-1', 'JD', 'draft-1')

      expect(result.interviewContext).toBeNull()
      expect(result.gaps).toHaveLength(0)
      expect(result.coveredCount).toBe(3)
    })

    it('throws "Not authenticated" when session is null', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: null },
      })

      await expect(
        analyzeJobDescriptionGaps('user-1', 'JD', 'draft-1')
      ).rejects.toThrow('Not authenticated')
    })

    it('throws when parse-jd returns empty requirements array', async () => {
      setupAuthenticatedSession()
      setupParseJdResponse({ requirements: [] })

      await expect(
        analyzeJobDescriptionGaps('user-1', 'JD', 'draft-1')
      ).rejects.toThrow('No requirements extracted from job description')
    })

    it('throws with error message when embed fails', async () => {
      setupAuthenticatedSession()
      setupParseJdResponse()
      // embed returns error
      mockFunctionsInvoke.mockResolvedValueOnce({
        data: null,
        error: { message: 'Embedding service unavailable' },
      })

      await expect(
        analyzeJobDescriptionGaps('user-1', 'JD', 'draft-1')
      ).rejects.toThrow('Embedding service unavailable')
    })
  })

})
