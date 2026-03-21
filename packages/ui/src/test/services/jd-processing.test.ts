import { describe, it, expect, vi, beforeEach } from 'vitest'
import { processJobDescription, analyzeJobDescriptionGaps, buildInterviewContextFromGaps, buildGapDataFromStored, findSkillMatch } from '../../services/jd-processing'

// Mock @odie/db
const mockGetSession = vi.fn()
const mockFunctionsInvoke = vi.fn()
const mockCreateJobDraft = vi.fn()
const mockMatchItemsPerRequirement = vi.fn()
const mockUpdateJobDraftRequirements = vi.fn()
const mockUpdateJobDraftBullets = vi.fn()
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
  createJobDraft: (...args: unknown[]) => mockCreateJobDraft(...args),
  createRunLogger: (...args: unknown[]) => mockCreateRunLogger(...args),
  matchItemsPerRequirement: (...args: unknown[]) => mockMatchItemsPerRequirement(...args),
  updateJobDraftRequirements: (...args: unknown[]) => mockUpdateJobDraftRequirements(...args),
  updateJobDraftBullets: (...args: unknown[]) => mockUpdateJobDraftBullets(...args),
}))

describe('jd-processing service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('processJobDescription', () => {
    it('should create a draft and return draft ID', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: { access_token: 'test-token' } },
      })

      mockCreateJobDraft.mockResolvedValue({
        id: 'draft-123',
        user_id: 'user-123',
        jd_text: 'Test JD',
      })

      const result = await processJobDescription('user-123', 'Test job description')

      expect(result).toEqual({
        draftId: 'draft-123',
      })

      // Verify draft was created with only user_id and jd_text
      expect(mockCreateJobDraft).toHaveBeenCalledWith({
        user_id: 'user-123',
        jd_text: 'Test job description',
      })

      // Verify no embed or matching calls
      expect(mockFunctionsInvoke).not.toHaveBeenCalled()

      // Verify success telemetry was logged
      expect(mockCreateRunLogger).toHaveBeenCalledWith('user-123', 'draft')
      expect(mockRunLoggerSuccess).toHaveBeenCalledWith({
        input: {
          jdTextLength: 20,
          jdTextPreview: 'Test job description',
        },
        output: {
          draftId: 'draft-123',
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

    it('should log failure telemetry when createJobDraft throws', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: { access_token: 'test-token' } },
      })

      mockCreateJobDraft.mockRejectedValue(new Error('DB insert failed'))

      await expect(processJobDescription('user-123', 'Test JD')).rejects.toThrow(
        'DB insert failed'
      )

      expect(mockRunLoggerFailure).toHaveBeenCalledWith({
        input: { jdTextLength: 7 },
        error: 'DB insert failed',
      })
    })

    it('should use mock mode when configured', async () => {
      mockCreateJobDraft.mockResolvedValue({
        id: 'mock-draft-123',
        user_id: 'user-123',
        jd_text: 'Test JD',
      })

      const result = await processJobDescription('user-123', 'Test JD', { useMock: true })

      expect(result).toEqual({ draftId: 'mock-draft-123' })

      // Should not call embed function in mock mode
      expect(mockFunctionsInvoke).not.toHaveBeenCalled()

      // Mock draft should be created with bare fields only
      expect(mockCreateJobDraft).toHaveBeenCalledWith({
        user_id: 'user-123',
        jd_text: 'Test JD',
      })
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
      mockMatchItemsPerRequirement.mockResolvedValue(
        mockRequirements.map(r => ({
          requirement: { description: r.description, category: r.category, importance: r.importance },
          matches: [{ id: 'b1', content_text: 'bullet text', category: 'Test', similarity: 0.8 }],
          isCovered: true,
        }))
      )
      mockUpdateJobDraftRequirements.mockResolvedValue({})
      mockUpdateJobDraftBullets.mockResolvedValue({})

      await analyzeJobDescriptionGaps('user-1', 'Looking for a React dev', 'draft-1')

      expect(mockFunctionsInvoke).toHaveBeenCalledWith('parse-jd', {
        body: { text: 'Looking for a React dev' },
      })
    })

    it('calls embed with requirement descriptions (not job title/company)', async () => {
      setupAuthenticatedSession()
      setupParseJdResponse()
      setupEmbedResponse()
      mockMatchItemsPerRequirement.mockResolvedValue(
        mockRequirements.map(r => ({
          requirement: { description: r.description, category: r.category, importance: r.importance },
          matches: [],
          isCovered: false,
        }))
      )
      mockUpdateJobDraftRequirements.mockResolvedValue({})
      mockUpdateJobDraftBullets.mockResolvedValue({})

      await analyzeJobDescriptionGaps('user-1', 'Some JD', 'draft-1')

      expect(mockFunctionsInvoke).toHaveBeenCalledWith('embed', {
        body: {
          texts: ['Experience with React', 'Team leadership', 'AWS experience'],
          type: 'jd',
        },
      })
    })

    it('uses threshold 0.4 and top-5 when calling matchItemsPerRequirement', async () => {
      setupAuthenticatedSession()
      setupParseJdResponse()
      setupEmbedResponse()
      mockMatchItemsPerRequirement.mockResolvedValue(
        mockRequirements.map(r => ({
          requirement: { description: r.description, category: r.category, importance: r.importance },
          matches: [],
          isCovered: false,
        }))
      )
      mockUpdateJobDraftRequirements.mockResolvedValue({})
      mockUpdateJobDraftBullets.mockResolvedValue({})

      await analyzeJobDescriptionGaps('user-1', 'Some JD', 'draft-1')

      expect(mockMatchItemsPerRequirement).toHaveBeenCalledWith(
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

      mockMatchItemsPerRequirement.mockResolvedValue([
        {
          requirement: { description: 'Experience with React', category: 'Frontend', importance: 'must_have' },
          matches: [{ id: 'b1', content_text: 'Built React app', category: 'Frontend', similarity: 0.85 }],
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
      mockUpdateJobDraftBullets.mockResolvedValue({})

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

    it('persists to DB via updateJobDraftRequirements with full bullet data', async () => {
      setupAuthenticatedSession()
      setupParseJdResponse()
      setupEmbedResponse()

      mockMatchItemsPerRequirement.mockResolvedValue([
        {
          requirement: { description: 'Experience with React', category: 'Frontend', importance: 'must_have' },
          matches: [{ id: 'b1', content_text: 'Built React app', category: 'Frontend', similarity: 0.85 }],
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
      mockUpdateJobDraftBullets.mockResolvedValue({})

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
              matchedBullets: [{ id: 'b1', text: 'Built React app', similarity: 0.85 }],
            },
          ],
          gaps: [
            { description: 'Team leadership', category: 'Leadership', importance: 'must_have' },
            { description: 'AWS experience', category: 'Cloud', importance: 'nice_to_have' },
          ],
          totalRequirements: 3,
          coveredCount: 1,
          analyzedAt: expect.any(String),
        },
        'Senior Engineer',
        'Acme Corp'
      )
    })

    it('updates draft bullets with all matched bullet IDs', async () => {
      setupAuthenticatedSession()
      setupParseJdResponse()
      setupEmbedResponse()

      mockMatchItemsPerRequirement.mockResolvedValue([
        {
          requirement: { description: 'Experience with React', category: 'Frontend', importance: 'must_have' },
          matches: [
            { id: 'b1', content_text: 'Built React app', category: 'Frontend', similarity: 0.85 },
            { id: 'b2', content_text: 'React hooks expert', category: 'Frontend', similarity: 0.75 },
          ],
          isCovered: true,
        },
        {
          requirement: { description: 'Team leadership', category: 'Leadership', importance: 'must_have' },
          matches: [{ id: 'b1', content_text: 'Built React app', category: 'Frontend', similarity: 0.45 }],
          isCovered: true,
        },
        {
          requirement: { description: 'AWS experience', category: 'Cloud', importance: 'nice_to_have' },
          matches: [],
          isCovered: false,
        },
      ])
      mockUpdateJobDraftRequirements.mockResolvedValue({})
      mockUpdateJobDraftBullets.mockResolvedValue({})

      await analyzeJobDescriptionGaps('user-1', 'JD text', 'draft-1')

      // Should deduplicate b1 which appears in two covered requirements
      expect(mockUpdateJobDraftBullets).toHaveBeenCalledWith(
        'draft-1',
        expect.arrayContaining(['b1', 'b2'])
      )
      // Verify deduplication (b1 should appear only once)
      const calledIds = mockUpdateJobDraftBullets.mock.calls[0][1]
      expect(calledIds).toHaveLength(2)
      expect(new Set(calledIds).size).toBe(calledIds.length)
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
        content_text: `Bullet text ${i}`,
        category: 'Frontend',
        similarity: 0.9 - i * 0.01,
      }))

      mockMatchItemsPerRequirement.mockResolvedValue([
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
      mockUpdateJobDraftBullets.mockResolvedValue({})

      const result = await analyzeJobDescriptionGaps('user-1', 'JD', 'draft-1')

      expect(result.interviewContext).not.toBeNull()
      expect(result.interviewContext!.mode).toBe('gaps')

      // Should include exactly the first 10 bullet texts joined by '; '
      const expectedSummary = twelveBullets.slice(0, 10).map(b => b.content_text).join('; ')
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

      mockMatchItemsPerRequirement.mockResolvedValue(
        mockRequirements.map(r => ({
          requirement: { description: r.description, category: r.category, importance: r.importance },
          matches: [{ id: 'b1', content_text: 'Some bullet', category: 'Test', similarity: 0.8 }],
          isCovered: true,
        }))
      )
      mockUpdateJobDraftRequirements.mockResolvedValue({})
      mockUpdateJobDraftBullets.mockResolvedValue({})

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

    it('adds skillMatch to gaps when user skills match requirement text', async () => {
      setupAuthenticatedSession()
      setupParseJdResponse()
      setupEmbedResponse()

      mockMatchItemsPerRequirement.mockResolvedValue([
        {
          requirement: { description: 'Experience with React', category: 'Frontend', importance: 'must_have' },
          matches: [{ id: 'b1', content_text: 'Built React app', category: 'Frontend', similarity: 0.85 }],
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
      mockUpdateJobDraftBullets.mockResolvedValue({})

      const result = await analyzeJobDescriptionGaps('user-1', 'JD text', 'draft-1', {
        hard: ['AWS', 'Docker'],
        soft: ['Leadership'],
      })

      expect(result.gaps).toHaveLength(2)
      // 'Team leadership' matches soft skill 'Leadership'
      expect(result.gaps[0].skillMatch).toBe('Leadership')
      // 'AWS experience' matches hard skill 'AWS'
      expect(result.gaps[1].skillMatch).toBe('AWS')
    })

    it('does not add skillMatch when no skills provided', async () => {
      setupAuthenticatedSession()
      setupParseJdResponse()
      setupEmbedResponse()

      mockMatchItemsPerRequirement.mockResolvedValue([
        {
          requirement: { description: 'Experience with React', category: 'Frontend', importance: 'must_have' },
          matches: [],
          isCovered: false,
        },
      ])
      mockUpdateJobDraftRequirements.mockResolvedValue({})
      mockUpdateJobDraftBullets.mockResolvedValue({})

      const result = await analyzeJobDescriptionGaps('user-1', 'JD text', 'draft-1')

      expect(result.gaps[0].skillMatch).toBeUndefined()
    })
  })

  describe('buildInterviewContextFromGaps', () => {
    it('returns null when there are no gaps', () => {
      const result = buildInterviewContextFromGaps([], [], 'Engineer', 'Acme')
      expect(result).toBeNull()
    })

    it('builds interview context with gaps and bullet summary', () => {
      const gaps = [
        { requirement: { description: 'AWS', category: 'Cloud', importance: 'must_have' as const } },
      ]
      const covered = [
        {
          requirement: { description: 'React', category: 'Frontend', importance: 'must_have' as const },
          matchedBullets: [{ id: 'b1', text: 'Built React app', similarity: 0.9 }],
        },
      ]

      const result = buildInterviewContextFromGaps(gaps, covered, 'Engineer', 'Acme')

      expect(result).toEqual({
        mode: 'gaps',
        gaps: [{ requirement: 'AWS', category: 'Cloud', importance: 'must_have' }],
        existingBulletSummary: 'Built React app',
        jobTitle: 'Engineer',
        company: 'Acme',
      })
    })

    it('uses fallback summary when no covered bullets exist', () => {
      const gaps = [
        { requirement: { description: 'Go', category: 'Backend', importance: 'must_have' as const } },
      ]

      const result = buildInterviewContextFromGaps(gaps, [], 'Engineer', null)

      expect(result!.existingBulletSummary).toBe('No existing bullets matched.')
      expect(result!.company).toBeNull()
    })

    it('limits bullet summary to first 10 texts', () => {
      const gaps = [
        { requirement: { description: 'Go', category: 'Backend', importance: 'must_have' as const } },
      ]
      const covered = [
        {
          requirement: { description: 'React', category: 'Frontend', importance: 'must_have' as const },
          matchedBullets: Array.from({ length: 15 }, (_, i) => ({
            id: `b${i}`,
            text: `Bullet ${i}`,
            similarity: 0.9,
          })),
        },
      ]

      const result = buildInterviewContextFromGaps(gaps, covered, 'Engineer', 'Acme')

      const texts = result!.existingBulletSummary.split('; ')
      expect(texts).toHaveLength(10)
    })
  })

  describe('buildGapDataFromStored', () => {
    it('reconstructs GapAnalysisServiceResult from stored data', () => {
      const stored = {
        jobTitle: 'Engineer',
        company: 'Acme' as string | null,
        covered: [
          {
            requirement: { description: 'React', category: 'Frontend', importance: 'must_have' as const },
            matchedBullets: [{ id: 'b1', text: 'Built React app', similarity: 0.9 }],
          },
        ],
        gaps: [
          { description: 'AWS', category: 'Cloud', importance: 'must_have' as const },
        ],
        totalRequirements: 2,
        coveredCount: 1,
        analyzedAt: '2024-01-15T00:00:00Z',
      }

      const result = buildGapDataFromStored('draft-1', stored)

      expect(result.draftId).toBe('draft-1')
      expect(result.jobTitle).toBe('Engineer')
      expect(result.company).toBe('Acme')
      expect(result.covered).toEqual(stored.covered)
      expect(result.gaps).toEqual([
        { requirement: { description: 'AWS', category: 'Cloud', importance: 'must_have' } },
      ])
      expect(result.totalRequirements).toBe(2)
      expect(result.coveredCount).toBe(1)
      expect(result.analyzedAt).toBe('2024-01-15T00:00:00Z')
      expect(result.interviewContext).not.toBeNull()
      expect(result.interviewContext!.mode).toBe('gaps')
    })

    it('returns null interviewContext when no gaps', () => {
      const stored = {
        jobTitle: 'Engineer',
        company: null,
        covered: [
          {
            requirement: { description: 'React', category: 'Frontend', importance: 'must_have' as const },
            matchedBullets: [{ id: 'b1', text: 'Built React app', similarity: 0.9 }],
          },
        ],
        gaps: [] as Array<{ description: string; category: string; importance: 'must_have' | 'nice_to_have' }>,
        totalRequirements: 1,
        coveredCount: 1,
        analyzedAt: '2024-01-15T00:00:00Z',
      }

      const result = buildGapDataFromStored('draft-1', stored)

      expect(result.interviewContext).toBeNull()
      expect(result.gaps).toHaveLength(0)
    })

    it('preserves skillMatch from stored gap data', () => {
      const stored = {
        jobTitle: 'Engineer',
        company: 'Acme' as string | null,
        covered: [],
        gaps: [
          { description: 'AWS experience', category: 'Cloud', importance: 'must_have' as const, skillMatch: 'AWS' },
          { description: 'Team leadership', category: 'Leadership', importance: 'must_have' as const },
        ],
        totalRequirements: 2,
        coveredCount: 0,
        analyzedAt: '2024-01-15T00:00:00Z',
      }

      const result = buildGapDataFromStored('draft-1', stored)

      expect(result.gaps[0].skillMatch).toBe('AWS')
      expect(result.gaps[1].skillMatch).toBeUndefined()
    })
  })

  describe('findSkillMatch', () => {
    it('returns matching hard skill (case-insensitive)', () => {
      const result = findSkillMatch('Experience with React and TypeScript', {
        hard: ['react', 'Node.js'],
        soft: [],
      })
      expect(result).toBe('react')
    })

    it('returns matching soft skill', () => {
      const result = findSkillMatch('Team leadership and communication', {
        hard: [],
        soft: ['Leadership', 'Communication'],
      })
      expect(result).toBe('Leadership')
    })

    it('returns undefined when no skills match', () => {
      const result = findSkillMatch('Experience with Go and Kubernetes', {
        hard: ['React', 'Node.js'],
        soft: ['Communication'],
      })
      expect(result).toBeUndefined()
    })

    it('returns undefined when skills is undefined', () => {
      const result = findSkillMatch('Experience with React')
      expect(result).toBeUndefined()
    })

    it('returns first matching skill when multiple match', () => {
      const result = findSkillMatch('React and TypeScript required', {
        hard: ['TypeScript', 'React'],
        soft: [],
      })
      // Returns first in the array order
      expect(result).toBe('TypeScript')
    })

    it('handles empty skill arrays', () => {
      const result = findSkillMatch('React experience', {
        hard: [],
        soft: [],
      })
      expect(result).toBeUndefined()
    })

    it('is case-insensitive for both skill and requirement', () => {
      const result = findSkillMatch('DOCKER containerization', {
        hard: ['docker'],
        soft: [],
      })
      expect(result).toBe('docker')
    })
  })
})
