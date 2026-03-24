import { describe, it, expect, vi, beforeEach } from 'vitest'
import { processJobDescription, analyzeJobDescriptionGaps, buildInterviewContextFromGaps, buildGapDataFromStored, findSkillMatch, hashRequirementDescription } from '../../services/jd-processing'

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

    function setupFunctionsInvoke(overrides?: {
      parseJd?: { data: unknown; error: unknown } | null
      embed?: { data: unknown; error: unknown } | null
      refineAnalysis?: { data: unknown; error: unknown } | null
    }) {
      const defaults = {
        parseJd: { data: { jobTitle: 'Senior Engineer', company: 'Acme Corp', requirements: mockRequirements }, error: null },
        embed: { data: { embeddings: mockEmbeddings }, error: null },
        // Default: refine-analysis returns error (same fallback behavior as before, but intentional)
        refineAnalysis: { data: null, error: { message: 'not mocked' } },
      }

      const responses = { ...defaults, ...overrides }

      mockFunctionsInvoke.mockImplementation((name: string) => {
        if (name === 'parse-jd') return responses.parseJd
        if (name === 'embed') return responses.embed
        if (name === 'refine-analysis') return responses.refineAnalysis
        throw new Error(`Unexpected function invoke: ${name}`)
      })
    }

    it('calls parse-jd edge function with the JD text', async () => {
      setupAuthenticatedSession()
      setupFunctionsInvoke()
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
      setupFunctionsInvoke()
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
      setupFunctionsInvoke()
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
      setupFunctionsInvoke()

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
      setupFunctionsInvoke()

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
          partiallyCovered: [],
          totalRequirements: 3,
          coveredCount: 1,
          analyzedAt: expect.any(String),
          refineFailed: true,
          triageDecisions: {},
          ignoredRequirements: [],
        },
        'Senior Engineer',
        'Acme Corp'
      )
    })

    it('updates draft bullets with all matched bullet IDs', async () => {
      setupAuthenticatedSession()
      setupFunctionsInvoke()

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
      setupFunctionsInvoke({
        parseJd: { data: { jobTitle: 'Senior Engineer', company: 'Acme Corp', requirements: twoReqs }, error: null },
        embed: { data: { embeddings: [mockEmbeddings[0], mockEmbeddings[1]] }, error: null },
      })

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
      setupFunctionsInvoke()

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
      setupFunctionsInvoke({ parseJd: { data: { jobTitle: 'Engineer', company: null, requirements: [] }, error: null } })

      await expect(
        analyzeJobDescriptionGaps('user-1', 'JD', 'draft-1')
      ).rejects.toThrow('No requirements extracted from job description')
    })

    it('throws with error message when embed fails', async () => {
      setupAuthenticatedSession()
      setupFunctionsInvoke({ embed: { data: null, error: { message: 'Embedding service unavailable' } } })

      await expect(
        analyzeJobDescriptionGaps('user-1', 'JD', 'draft-1')
      ).rejects.toThrow('Embedding service unavailable')
    })

    it('adds skillMatch to gaps when user skills match requirement text', async () => {
      setupAuthenticatedSession()
      setupFunctionsInvoke()

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
      setupFunctionsInvoke()

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

    describe('refine-analysis integration', () => {
      it('reclassifies requirements based on refine-analysis response', async () => {
        setupAuthenticatedSession()
        setupFunctionsInvoke({
          refineAnalysis: {
            data: {
              refinedRequirements: [
                { requirementIndex: 0, status: 'covered', reasoning: 'Has React experience', evidenceBulletIds: ['b1'], evidenceEntryIds: [] },
                { requirementIndex: 1, status: 'partially_covered', reasoning: 'Led small team but not at scale', evidenceBulletIds: ['b2'], evidenceEntryIds: [] },
                { requirementIndex: 2, status: 'gap', reasoning: 'No cloud experience found', evidenceBulletIds: [], evidenceEntryIds: [] },
              ],
              recommendedBulletIds: [],
              fitSummary: 'Strong frontend candidate with leadership potential',
            },
            error: null,
          },
        })

        mockMatchItemsPerRequirement.mockResolvedValue(
          mockRequirements.map(() => ({
            requirement: mockRequirements[0],
            matches: [
              { id: 'b1', content_text: 'Built React app', category: 'Frontend', similarity: 0.85 },
              { id: 'b2', content_text: 'Led team of 3', category: 'Leadership', similarity: 0.7 },
            ],
            isCovered: true,
          }))
        )
        mockUpdateJobDraftRequirements.mockResolvedValue({})
        mockUpdateJobDraftBullets.mockResolvedValue({})

        const result = await analyzeJobDescriptionGaps('user-1', 'JD text', 'draft-1')

        expect(result.covered).toHaveLength(1)
        expect(result.covered[0].requirement.description).toBe('Experience with React')
        expect(result.partiallyCovered).toHaveLength(1)
        expect(result.partiallyCovered[0].reasoning).toBe('Led small team but not at scale')
        expect(result.gaps).toHaveLength(1)
        expect(result.gaps[0].requirement.description).toBe('AWS experience')
        expect(result.fitSummary).toBe('Strong frontend candidate with leadership potential')
        expect(result.refined).toBeTruthy()
        expect(result.refineFailed).toBeFalsy()
      })

      it('falls back to mechanical results on hallucination signal', async () => {
        setupAuthenticatedSession()
        setupFunctionsInvoke({
          refineAnalysis: {
            data: { fallback: true, reason: 'hallucination_rate_exceeded' },
            error: null,
          },
        })

        mockMatchItemsPerRequirement.mockResolvedValue([
          {
            requirement: mockRequirements[0],
            matches: [{ id: 'b1', content_text: 'Built React app', category: 'Frontend', similarity: 0.85 }],
            isCovered: true,
          },
          {
            requirement: mockRequirements[1],
            matches: [],
            isCovered: false,
          },
          {
            requirement: mockRequirements[2],
            matches: [],
            isCovered: false,
          },
        ])
        mockUpdateJobDraftRequirements.mockResolvedValue({})
        mockUpdateJobDraftBullets.mockResolvedValue({})

        const result = await analyzeJobDescriptionGaps('user-1', 'JD text', 'draft-1', {
          hard: ['Leadership'],
          soft: [],
        })

        expect(result.refineFailed).toBe(true)
        expect(result.covered).toHaveLength(1)
        expect(result.gaps).toHaveLength(2)
        expect(result.gaps[0].skillMatch).toBe('Leadership')
        expect(result.partiallyCovered).toHaveLength(0)
      })

      it('falls back gracefully on refine-analysis network failure', async () => {
        setupAuthenticatedSession()
        setupFunctionsInvoke({
          refineAnalysis: { data: null, error: { message: 'Function crashed' } },
        })

        mockMatchItemsPerRequirement.mockResolvedValue([
          {
            requirement: mockRequirements[0],
            matches: [{ id: 'b1', content_text: 'Built React app', category: 'Frontend', similarity: 0.85 }],
            isCovered: true,
          },
          {
            requirement: mockRequirements[1],
            matches: [],
            isCovered: false,
          },
          {
            requirement: mockRequirements[2],
            matches: [],
            isCovered: false,
          },
        ])
        mockUpdateJobDraftRequirements.mockResolvedValue({})
        mockUpdateJobDraftBullets.mockResolvedValue({})

        const result = await analyzeJobDescriptionGaps('user-1', 'JD text', 'draft-1')

        expect(result.refineFailed).toBe(true)
        expect(result.covered).toHaveLength(1)
        expect(result.gaps).toHaveLength(2)
        expect(result.partiallyCovered).toHaveLength(0)
      })

      it('expands allMatchedBulletIds with recommendedBulletIds', async () => {
        setupAuthenticatedSession()
        setupFunctionsInvoke({
          refineAnalysis: {
            data: {
              refinedRequirements: [
                { requirementIndex: 0, status: 'covered', reasoning: 'Has React', evidenceBulletIds: ['b1'], evidenceEntryIds: [] },
                { requirementIndex: 1, status: 'covered', reasoning: 'Has leadership', evidenceBulletIds: ['b1'], evidenceEntryIds: [] },
                { requirementIndex: 2, status: 'covered', reasoning: 'Has AWS', evidenceBulletIds: ['b1'], evidenceEntryIds: [] },
              ],
              recommendedBulletIds: ['extra-1', 'extra-2'],
              fitSummary: 'Great fit',
            },
            error: null,
          },
        })

        mockMatchItemsPerRequirement.mockResolvedValue(
          mockRequirements.map(r => ({
            requirement: r,
            matches: [{ id: 'b1', content_text: 'text', category: 'Cat', similarity: 0.9 }],
            isCovered: true,
          }))
        )
        mockUpdateJobDraftRequirements.mockResolvedValue({})
        mockUpdateJobDraftBullets.mockResolvedValue({})

        await analyzeJobDescriptionGaps('user-1', 'JD text', 'draft-1')

        const calledIds = mockUpdateJobDraftBullets.mock.calls[0][1] as string[]
        expect(calledIds).toContain('b1')
        expect(calledIds).toContain('extra-1')
        expect(calledIds).toContain('extra-2')
        expect(new Set(calledIds).size).toBe(calledIds.length)
      })

      it('maps evidence bullets correctly including unknown IDs', async () => {
        setupAuthenticatedSession()
        setupFunctionsInvoke({
          refineAnalysis: {
            data: {
              refinedRequirements: [
                { requirementIndex: 0, status: 'covered', reasoning: 'Has React', evidenceBulletIds: ['b1', 'unknown-id'], evidenceEntryIds: [] },
                { requirementIndex: 1, status: 'gap', reasoning: 'No leadership', evidenceBulletIds: [], evidenceEntryIds: [] },
                { requirementIndex: 2, status: 'gap', reasoning: 'No AWS', evidenceBulletIds: [], evidenceEntryIds: [] },
              ],
              recommendedBulletIds: [],
              fitSummary: 'Partial fit',
            },
            error: null,
          },
        })

        mockMatchItemsPerRequirement.mockResolvedValue([
          {
            requirement: mockRequirements[0],
            matches: [{ id: 'b1', content_text: 'React work', category: 'Frontend', similarity: 0.9 }],
            isCovered: true,
          },
          {
            requirement: mockRequirements[1],
            matches: [],
            isCovered: false,
          },
          {
            requirement: mockRequirements[2],
            matches: [],
            isCovered: false,
          },
        ])
        mockUpdateJobDraftRequirements.mockResolvedValue({})
        mockUpdateJobDraftBullets.mockResolvedValue({})

        const result = await analyzeJobDescriptionGaps('user-1', 'JD text', 'draft-1')

        expect(result.covered[0].matchedBullets).toContainEqual({ id: 'b1', text: 'React work', similarity: 0.9 })
        expect(result.covered[0].matchedBullets).toContainEqual({ id: 'unknown-id', text: '', similarity: 0 })
      })

      it('includes reasoning and evidence in partiallyCovered items', async () => {
        setupAuthenticatedSession()
        setupFunctionsInvoke({
          refineAnalysis: {
            data: {
              refinedRequirements: [
                { requirementIndex: 0, status: 'covered', reasoning: 'Has React', evidenceBulletIds: ['b1'], evidenceEntryIds: [] },
                { requirementIndex: 1, status: 'partially_covered', reasoning: 'Has some team experience but not at senior level', evidenceBulletIds: ['b2'], evidenceEntryIds: [] },
                { requirementIndex: 2, status: 'gap', reasoning: 'No AWS', evidenceBulletIds: [], evidenceEntryIds: [] },
              ],
              recommendedBulletIds: [],
              fitSummary: 'Decent fit',
            },
            error: null,
          },
        })

        mockMatchItemsPerRequirement.mockResolvedValue([
          {
            requirement: mockRequirements[0],
            matches: [{ id: 'b1', content_text: 'Built React app', category: 'Frontend', similarity: 0.85 }],
            isCovered: true,
          },
          {
            requirement: mockRequirements[1],
            matches: [{ id: 'b2', content_text: 'Mentored junior dev', category: 'Leadership', similarity: 0.65 }],
            isCovered: false,
          },
          {
            requirement: mockRequirements[2],
            matches: [],
            isCovered: false,
          },
        ])
        mockUpdateJobDraftRequirements.mockResolvedValue({})
        mockUpdateJobDraftBullets.mockResolvedValue({})

        const result = await analyzeJobDescriptionGaps('user-1', 'JD text', 'draft-1')

        expect(result.partiallyCovered).toHaveLength(1)
        expect(result.partiallyCovered[0].requirement.description).toBe('Team leadership')
        expect(result.partiallyCovered[0].reasoning).toBe('Has some team experience but not at senior level')
        expect(result.partiallyCovered[0].evidenceBullets).toContainEqual({ id: 'b2', text: 'Mentored junior dev', similarity: 0.65 })
      })

      it('silently skips out-of-bounds requirementIndex', async () => {
        setupAuthenticatedSession()
        setupFunctionsInvoke({
          refineAnalysis: {
            data: {
              refinedRequirements: [
                { requirementIndex: 0, status: 'covered', reasoning: 'Has React', evidenceBulletIds: ['b1'], evidenceEntryIds: [] },
                { requirementIndex: 99, status: 'gap', reasoning: 'Invalid index', evidenceBulletIds: [], evidenceEntryIds: [] },
                { requirementIndex: 2, status: 'gap', reasoning: 'No AWS', evidenceBulletIds: [], evidenceEntryIds: [] },
              ],
              recommendedBulletIds: [],
              fitSummary: 'Assessment',
            },
            error: null,
          },
        })

        mockMatchItemsPerRequirement.mockResolvedValue(
          mockRequirements.map(r => ({
            requirement: r,
            matches: [{ id: 'b1', content_text: 'text', category: 'Cat', similarity: 0.9 }],
            isCovered: true,
          }))
        )
        mockUpdateJobDraftRequirements.mockResolvedValue({})
        mockUpdateJobDraftBullets.mockResolvedValue({})

        const result = await analyzeJobDescriptionGaps('user-1', 'JD text', 'draft-1')

        expect(result.covered).toHaveLength(1)
        expect(result.gaps).toHaveLength(1)
        expect(result.covered.length + result.gaps.length + result.partiallyCovered.length).toBe(2)
      })
    })

    it('calls onProgress with each stage in order', async () => {
      setupAuthenticatedSession()
      setupFunctionsInvoke()
      mockMatchItemsPerRequirement.mockResolvedValue(
        mockRequirements.map(r => ({
          requirement: { description: r.description, category: r.category, importance: r.importance },
          matches: [{ id: 'b1', content_text: 'bullet text', category: 'Test', similarity: 0.8 }],
          isCovered: true,
        }))
      )
      mockUpdateJobDraftRequirements.mockResolvedValue({})
      mockUpdateJobDraftBullets.mockResolvedValue({})

      const onProgress = vi.fn()
      await analyzeJobDescriptionGaps('user-1', 'JD text', 'draft-1', undefined, onProgress)

      const stages = onProgress.mock.calls.map((c: unknown[]) => c[0])
      expect(stages).toEqual(['parsing', 'embedding', 'matching', 'refining', 'storing'])
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

    it('only includes gaps marked "interview" when triageDecisions provided', () => {
      const gaps = [
        { requirement: { description: 'AWS', category: 'Cloud', importance: 'must_have' as const } },
        { requirement: { description: 'Docker', category: 'DevOps', importance: 'nice_to_have' as const } },
        { requirement: { description: 'Go', category: 'Backend', importance: 'must_have' as const } },
      ]
      const covered = [
        {
          requirement: { description: 'React', category: 'Frontend', importance: 'must_have' as const },
          matchedBullets: [{ id: 'b1', text: 'Built React app', similarity: 0.9 }],
        },
      ]

      const triageDecisions: Record<string, 'included' | 'interview' | 'ignored'> = {
        [hashRequirementDescription('AWS')]: 'interview',
        [hashRequirementDescription('Docker')]: 'ignored',
        [hashRequirementDescription('Go')]: 'included',
      }

      const result = buildInterviewContextFromGaps(gaps, covered, 'Engineer', 'Acme', triageDecisions)

      expect(result).not.toBeNull()
      expect(result!.gaps).toHaveLength(1)
      expect(result!.gaps[0].requirement).toBe('AWS')
    })

    it('returns null when all triaged items are ignored or included', () => {
      const gaps = [
        { requirement: { description: 'AWS', category: 'Cloud', importance: 'must_have' as const } },
      ]

      const triageDecisions: Record<string, 'included' | 'interview' | 'ignored'> = {
        [hashRequirementDescription('AWS')]: 'ignored',
      }

      const result = buildInterviewContextFromGaps(gaps, [], 'Engineer', null, triageDecisions)
      expect(result).toBeNull()
    })

    it('includes partiallyCovered items marked "interview"', () => {
      const gaps = [
        { requirement: { description: 'AWS', category: 'Cloud', importance: 'must_have' as const } },
      ]
      const partiallyCovered = [
        {
          requirement: { description: 'Docker', category: 'DevOps', importance: 'nice_to_have' as const },
          reasoning: 'Some exposure',
          evidenceBullets: [{ id: 'b2', text: 'Used Docker in CI', similarity: 0.6 }],
        },
      ]

      const triageDecisions: Record<string, 'included' | 'interview' | 'ignored'> = {
        [hashRequirementDescription('AWS')]: 'ignored',
        [hashRequirementDescription('Docker')]: 'interview',
      }

      const result = buildInterviewContextFromGaps(gaps, [], 'Engineer', 'Acme', triageDecisions, partiallyCovered)

      expect(result).not.toBeNull()
      expect(result!.gaps).toHaveLength(1)
      expect(result!.gaps[0].requirement).toBe('Docker')
    })

    it('falls back to all gaps when triageDecisions is empty object', () => {
      const gaps = [
        { requirement: { description: 'AWS', category: 'Cloud', importance: 'must_have' as const } },
        { requirement: { description: 'Go', category: 'Backend', importance: 'must_have' as const } },
      ]

      const result = buildInterviewContextFromGaps(gaps, [], 'Engineer', null, {})

      expect(result).not.toBeNull()
      expect(result!.gaps).toHaveLength(2)
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

    it('handles stored data with refined, partiallyCovered, triageDecisions, fitSummary', () => {
      const stored = {
        jobTitle: 'Staff Engineer',
        company: 'Stripe' as string | null,
        covered: [
          {
            requirement: { description: 'React', category: 'Frontend', importance: 'must_have' as const },
            matchedBullets: [{ id: 'b1', text: 'Built React app', similarity: 0.9 }],
          },
        ],
        gaps: [
          { description: 'Go', category: 'Backend', importance: 'must_have' as const },
        ],
        partiallyCovered: [
          {
            requirement: { description: 'AWS', category: 'Cloud', importance: 'nice_to_have' as const },
            reasoning: 'Some S3 usage',
            evidenceBullets: [{ id: 'b2', text: 'Used S3 for storage', similarity: 0.55 }],
          },
        ],
        totalRequirements: 3,
        coveredCount: 1,
        analyzedAt: '2024-06-01T00:00:00Z',
        refined: {
          refinedRequirements: [
            { requirementIndex: 0, status: 'covered' as const, reasoning: 'Strong match', evidenceBulletIds: ['b1'], evidenceEntryIds: [] },
          ],
          recommendedBulletIds: ['b1'],
          fitSummary: 'Good fit overall.',
        },
        triageDecisions: {
          [hashRequirementDescription('Go')]: 'interview' as const,
          [hashRequirementDescription('AWS')]: 'included' as const,
        },
        ignoredRequirements: [],
        fitSummary: 'Good fit overall.',
      }

      const result = buildGapDataFromStored('draft-2', stored)

      expect(result.draftId).toBe('draft-2')
      expect(result.partiallyCovered).toHaveLength(1)
      expect(result.partiallyCovered[0].reasoning).toBe('Some S3 usage')
      expect(result.refined).toBeDefined()
      expect(result.refined!.fitSummary).toBe('Good fit overall.')
      expect(result.triageDecisions[hashRequirementDescription('Go')]).toBe('interview')
      expect(result.fitSummary).toBe('Good fit overall.')
      expect(result.ignoredRequirements).toEqual([])
      // Interview context should only include 'Go' (marked interview)
      expect(result.interviewContext).not.toBeNull()
      expect(result.interviewContext!.gaps).toHaveLength(1)
      expect(result.interviewContext!.gaps[0].requirement).toBe('Go')
    })

    it('handles stored data WITHOUT new fields (backward compatibility)', () => {
      const stored = {
        jobTitle: 'Engineer',
        company: null as string | null,
        covered: [],
        gaps: [
          { description: 'Kubernetes', category: 'DevOps', importance: 'must_have' as const },
        ],
        totalRequirements: 1,
        coveredCount: 0,
        analyzedAt: '2024-01-01T00:00:00Z',
      }

      const result = buildGapDataFromStored('draft-old', stored)

      expect(result.partiallyCovered).toEqual([])
      expect(result.triageDecisions).toEqual({})
      expect(result.ignoredRequirements).toEqual([])
      expect(result.fitSummary).toBeUndefined()
      expect(result.refineFailed).toBeUndefined()
      expect(result.refined).toBeUndefined()
      // Without triage decisions, falls back to including all gaps
      expect(result.interviewContext).not.toBeNull()
      expect(result.interviewContext!.gaps).toHaveLength(1)
    })

    it('passes refineFailed through from stored data', () => {
      const stored = {
        jobTitle: 'Engineer',
        company: null as string | null,
        covered: [],
        gaps: [],
        totalRequirements: 0,
        coveredCount: 0,
        analyzedAt: '2024-01-01T00:00:00Z',
        refineFailed: true,
      }

      const result = buildGapDataFromStored('draft-x', stored)
      expect(result.refineFailed).toBe(true)
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

  describe('hashRequirementDescription', () => {
    it('returns a deterministic hash for the same input', () => {
      const hash1 = hashRequirementDescription('Experience with React')
      const hash2 = hashRequirementDescription('Experience with React')
      expect(hash1).toBe(hash2)
    })

    it('returns different hashes for different inputs', () => {
      const hash1 = hashRequirementDescription('Experience with React')
      const hash2 = hashRequirementDescription('Experience with Angular')
      expect(hash1).not.toBe(hash2)
    })

    it('returns a non-empty string', () => {
      const hash = hashRequirementDescription('Test')
      expect(hash).toBeTruthy()
      expect(typeof hash).toBe('string')
    })

    it('handles empty string', () => {
      const hash = hashRequirementDescription('')
      expect(typeof hash).toBe('string')
    })

    it('returns base-36 encoded string', () => {
      const hash = hashRequirementDescription('Kubernetes experience')
      // base-36 uses digits 0-9 and letters a-z, possibly with a leading minus
      expect(hash).toMatch(/^-?[0-9a-z]+$/)
    })
  })
})
