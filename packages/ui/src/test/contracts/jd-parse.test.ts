import { describe, it, expect } from 'vitest'
import {
  JdRequirementSchema,
  JdParseOutputSchema,
  GapMatchedBulletSchema,
  CoveredRequirementSchema,
  GapRequirementSchema,
  GapAnalysisResultSchema,
  RefinedRequirementSchema,
  RefineAnalysisOutputSchema,
  TriageDecisionSchema,
  GapAnalysisStoredSchema,
  JD_CATEGORY_LABELS,
} from '@odie/shared'

describe('jd-parse contracts', () => {
  describe('JdRequirementSchema', () => {
    it('accepts a must_have requirement', () => {
      const result = JdRequirementSchema.parse({
        description: '5+ years of React experience',
        category: 'Frontend',
        importance: 'must_have',
      })
      expect(result.importance).toBe('must_have')
      expect(result.category).toBe('Frontend')
    })

    it('accepts a nice_to_have requirement', () => {
      const result = JdRequirementSchema.parse({
        description: 'Experience with GraphQL',
        category: 'Backend',
        importance: 'nice_to_have',
      })
      expect(result.importance).toBe('nice_to_have')
    })

    it('rejects missing description', () => {
      const result = JdRequirementSchema.safeParse({
        category: 'Frontend',
        importance: 'must_have',
      })
      expect(result.success).toBe(false)
    })

    it('rejects invalid importance value', () => {
      const result = JdRequirementSchema.safeParse({
        description: 'Test',
        category: 'Test',
        importance: 'critical',
      })
      expect(result.success).toBe(false)
    })

    it('rejects missing category', () => {
      const result = JdRequirementSchema.safeParse({
        description: 'Test',
        importance: 'must_have',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('JdParseOutputSchema', () => {
    it('accepts a valid JD parse output', () => {
      const result = JdParseOutputSchema.parse({
        jobTitle: 'Senior Software Engineer',
        company: 'Google',
        requirements: [
          { description: 'React proficiency', category: 'Frontend', importance: 'must_have' },
        ],
      })
      expect(result.jobTitle).toBe('Senior Software Engineer')
      expect(result.company).toBe('Google')
      expect(result.requirements).toHaveLength(1)
    })

    it('accepts null company', () => {
      const result = JdParseOutputSchema.parse({
        jobTitle: 'Engineer',
        company: null,
        requirements: [],
      })
      expect(result.company).toBeNull()
    })

    it('accepts omitted company (nullish)', () => {
      const result = JdParseOutputSchema.parse({
        jobTitle: 'Engineer',
        requirements: [],
      })
      expect(result.company).toBeUndefined()
    })

    it('rejects missing jobTitle', () => {
      const result = JdParseOutputSchema.safeParse({
        requirements: [],
      })
      expect(result.success).toBe(false)
    })

    it('rejects missing requirements', () => {
      const result = JdParseOutputSchema.safeParse({
        jobTitle: 'Engineer',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('GapMatchedBulletSchema', () => {
    it('accepts a valid matched bullet', () => {
      const result = GapMatchedBulletSchema.parse({
        bulletId: 'bullet-1',
        bulletText: 'Led team of 5 engineers',
        similarity: 0.92,
      })
      expect(result.similarity).toBe(0.92)
    })

    it('rejects missing bulletId', () => {
      const result = GapMatchedBulletSchema.safeParse({
        bulletText: 'Test',
        similarity: 0.5,
      })
      expect(result.success).toBe(false)
    })

    it('rejects non-numeric similarity', () => {
      const result = GapMatchedBulletSchema.safeParse({
        bulletId: '1',
        bulletText: 'Test',
        similarity: 'high',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('CoveredRequirementSchema', () => {
    it('accepts a covered requirement with matched bullets', () => {
      const result = CoveredRequirementSchema.parse({
        requirement: {
          description: 'React experience',
          category: 'Frontend',
          importance: 'must_have',
        },
        matchedBullets: [
          { bulletId: 'b-1', bulletText: 'Built React apps', similarity: 0.85 },
        ],
      })
      expect(result.matchedBullets).toHaveLength(1)
    })

    it('accepts empty matched bullets array', () => {
      const result = CoveredRequirementSchema.parse({
        requirement: {
          description: 'Test',
          category: 'Test',
          importance: 'nice_to_have',
        },
        matchedBullets: [],
      })
      expect(result.matchedBullets).toEqual([])
    })
  })

  describe('GapRequirementSchema', () => {
    it('accepts a gap with suggested question', () => {
      const result = GapRequirementSchema.parse({
        requirement: {
          description: 'Kubernetes experience',
          category: 'DevOps',
          importance: 'must_have',
        },
        suggestedQuestion: 'Have you worked with container orchestration?',
      })
      expect(result.suggestedQuestion).toBe('Have you worked with container orchestration?')
    })

    it('accepts a gap without suggested question', () => {
      const result = GapRequirementSchema.parse({
        requirement: {
          description: 'Kubernetes',
          category: 'DevOps',
          importance: 'nice_to_have',
        },
      })
      expect(result.suggestedQuestion).toBeUndefined()
    })
  })

  describe('GapAnalysisResultSchema', () => {
    it('accepts a valid gap analysis result', () => {
      const result = GapAnalysisResultSchema.parse({
        jobTitle: 'Senior SWE',
        company: 'Meta',
        covered: [
          {
            requirement: { description: 'React', category: 'Frontend', importance: 'must_have' },
            matchedBullets: [
              { bulletId: 'b-1', bulletText: 'Built React app', similarity: 0.9 },
            ],
          },
        ],
        gaps: [
          {
            requirement: { description: 'Go', category: 'Backend', importance: 'nice_to_have' },
          },
        ],
        totalRequirements: 2,
        coveredCount: 1,
      })
      expect(result.totalRequirements).toBe(2)
      expect(result.coveredCount).toBe(1)
      expect(result.covered).toHaveLength(1)
      expect(result.gaps).toHaveLength(1)
    })

    it('accepts null company', () => {
      const result = GapAnalysisResultSchema.parse({
        jobTitle: 'Engineer',
        company: null,
        covered: [],
        gaps: [],
        totalRequirements: 0,
        coveredCount: 0,
      })
      expect(result.company).toBeNull()
    })

    it('rejects missing totalRequirements', () => {
      const result = GapAnalysisResultSchema.safeParse({
        jobTitle: 'Engineer',
        covered: [],
        gaps: [],
        coveredCount: 0,
      })
      expect(result.success).toBe(false)
    })

    it('rejects missing coveredCount', () => {
      const result = GapAnalysisResultSchema.safeParse({
        jobTitle: 'Engineer',
        covered: [],
        gaps: [],
        totalRequirements: 0,
      })
      expect(result.success).toBe(false)
    })
  })

  describe('RefinedRequirementSchema', () => {
    it('accepts valid refined requirement with all fields', () => {
      const result = RefinedRequirementSchema.parse({
        requirementIndex: 0,
        status: 'covered',
        reasoning: 'Candidate has extensive React experience',
        evidenceBulletIds: ['b-1', 'b-2'],
        evidenceEntryIds: ['e-1'],
      })
      expect(result.status).toBe('covered')
      expect(result.requirementIndex).toBe(0)
      expect(result.evidenceBulletIds).toEqual(['b-1', 'b-2'])
      expect(result.evidenceEntryIds).toEqual(['e-1'])
    })

    it('accepts partially_covered status', () => {
      const result = RefinedRequirementSchema.parse({
        requirementIndex: 1,
        status: 'partially_covered',
        reasoning: 'Some experience but not deep',
        evidenceBulletIds: ['b-3'],
        evidenceEntryIds: [],
      })
      expect(result.status).toBe('partially_covered')
    })

    it('accepts gap status', () => {
      const result = RefinedRequirementSchema.parse({
        requirementIndex: 2,
        status: 'gap',
        reasoning: 'No evidence found',
      })
      expect(result.status).toBe('gap')
    })

    it('rejects invalid status value', () => {
      const result = RefinedRequirementSchema.safeParse({
        requirementIndex: 0,
        status: 'unknown',
        reasoning: 'test',
      })
      expect(result.success).toBe(false)
    })

    it('defaults evidenceBulletIds to empty array when omitted', () => {
      const result = RefinedRequirementSchema.parse({
        requirementIndex: 0,
        status: 'gap',
        reasoning: 'No match',
      })
      expect(result.evidenceBulletIds).toEqual([])
    })

    it('defaults evidenceEntryIds to empty array when omitted', () => {
      const result = RefinedRequirementSchema.parse({
        requirementIndex: 0,
        status: 'covered',
        reasoning: 'Matched',
      })
      expect(result.evidenceEntryIds).toEqual([])
    })

    it('rejects missing requirementIndex', () => {
      const result = RefinedRequirementSchema.safeParse({
        status: 'covered',
        reasoning: 'test',
      })
      expect(result.success).toBe(false)
    })

    it('rejects missing reasoning', () => {
      const result = RefinedRequirementSchema.safeParse({
        requirementIndex: 0,
        status: 'covered',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('RefineAnalysisOutputSchema', () => {
    it('accepts valid full output', () => {
      const result = RefineAnalysisOutputSchema.parse({
        refinedRequirements: [
          { requirementIndex: 0, status: 'covered', reasoning: 'Strong match', evidenceBulletIds: ['b-1'], evidenceEntryIds: [] },
          { requirementIndex: 1, status: 'gap', reasoning: 'No evidence' },
        ],
        recommendedBulletIds: ['b-1', 'b-5'],
        fitSummary: 'Good fit for the role overall.',
      })
      expect(result.refinedRequirements).toHaveLength(2)
      expect(result.recommendedBulletIds).toEqual(['b-1', 'b-5'])
      expect(result.fitSummary).toBe('Good fit for the role overall.')
    })

    it('rejects missing refinedRequirements', () => {
      const result = RefineAnalysisOutputSchema.safeParse({
        recommendedBulletIds: [],
        fitSummary: 'ok',
      })
      expect(result.success).toBe(false)
    })

    it('rejects missing recommendedBulletIds', () => {
      const result = RefineAnalysisOutputSchema.safeParse({
        refinedRequirements: [],
        fitSummary: 'ok',
      })
      expect(result.success).toBe(false)
    })

    it('rejects missing fitSummary', () => {
      const result = RefineAnalysisOutputSchema.safeParse({
        refinedRequirements: [],
        recommendedBulletIds: [],
      })
      expect(result.success).toBe(false)
    })

    it('accepts empty arrays for requirements and bullet IDs', () => {
      const result = RefineAnalysisOutputSchema.parse({
        refinedRequirements: [],
        recommendedBulletIds: [],
        fitSummary: 'No data.',
      })
      expect(result.refinedRequirements).toEqual([])
      expect(result.recommendedBulletIds).toEqual([])
    })
  })

  describe('TriageDecisionSchema', () => {
    it('accepts "included"', () => {
      const result = TriageDecisionSchema.parse('included')
      expect(result).toBe('included')
    })

    it('accepts "interview"', () => {
      const result = TriageDecisionSchema.parse('interview')
      expect(result).toBe('interview')
    })

    it('accepts "ignored"', () => {
      const result = TriageDecisionSchema.parse('ignored')
      expect(result).toBe('ignored')
    })

    it('rejects invalid value', () => {
      const result = TriageDecisionSchema.safeParse('deferred')
      expect(result.success).toBe(false)
    })

    it('rejects non-string value', () => {
      const result = TriageDecisionSchema.safeParse(42)
      expect(result.success).toBe(false)
    })
  })

  describe('GapAnalysisStoredSchema', () => {
    const baseStored = {
      jobTitle: 'Senior SWE',
      company: 'Meta',
      covered: [],
      gaps: [],
      totalRequirements: 5,
      coveredCount: 3,
      analyzedAt: '2024-06-01T12:00:00Z',
    }

    it('accepts a valid stored gap analysis with analyzedAt', () => {
      const result = GapAnalysisStoredSchema.parse(baseStored)
      expect(result.analyzedAt).toBe('2024-06-01T12:00:00Z')
      expect(result.triageDecisions).toEqual({})
      expect(result.ignoredRequirements).toEqual([])
    })

    it('defaults triageDecisions to empty object when omitted', () => {
      const result = GapAnalysisStoredSchema.parse(baseStored)
      expect(result.triageDecisions).toEqual({})
    })

    it('defaults ignoredRequirements to empty array when omitted', () => {
      const result = GapAnalysisStoredSchema.parse(baseStored)
      expect(result.ignoredRequirements).toEqual([])
    })

    it('accepts optional refined field', () => {
      const result = GapAnalysisStoredSchema.parse({
        ...baseStored,
        refined: {
          refinedRequirements: [
            { requirementIndex: 0, status: 'covered', reasoning: 'Good match' },
          ],
          recommendedBulletIds: ['b-1'],
          fitSummary: 'Strong candidate.',
        },
      })
      expect(result.refined).toBeDefined()
      expect(result.refined!.fitSummary).toBe('Strong candidate.')
    })

    it('accepts stored data without refined field', () => {
      const result = GapAnalysisStoredSchema.parse(baseStored)
      expect(result.refined).toBeUndefined()
    })

    it('accepts triageDecisions with valid values', () => {
      const result = GapAnalysisStoredSchema.parse({
        ...baseStored,
        triageDecisions: {
          'hash-1': 'included',
          'hash-2': 'interview',
          'hash-3': 'ignored',
        },
      })
      expect(result.triageDecisions['hash-1']).toBe('included')
      expect(result.triageDecisions['hash-2']).toBe('interview')
    })

    it('rejects triageDecisions with invalid decision value', () => {
      const result = GapAnalysisStoredSchema.safeParse({
        ...baseStored,
        triageDecisions: { 'hash-1': 'deferred' },
      })
      expect(result.success).toBe(false)
    })

    it('rejects missing analyzedAt', () => {
      const { analyzedAt: _, ...withoutAnalyzedAt } = baseStored
      const result = GapAnalysisStoredSchema.safeParse(withoutAnalyzedAt)
      expect(result.success).toBe(false)
    })

    it('accepts ignoredRequirements with string array', () => {
      const result = GapAnalysisStoredSchema.parse({
        ...baseStored,
        ignoredRequirements: ['hash-a', 'hash-b'],
      })
      expect(result.ignoredRequirements).toEqual(['hash-a', 'hash-b'])
    })
  })

  describe('JD_CATEGORY_LABELS', () => {
    it('maps known categories to human-readable labels', () => {
      expect(JD_CATEGORY_LABELS['technical_skill']).toBe('Technical')
      expect(JD_CATEGORY_LABELS['soft_skill']).toBe('Soft Skill')
      expect(JD_CATEGORY_LABELS['experience_type']).toBe('Experience')
      expect(JD_CATEGORY_LABELS['domain_knowledge']).toBe('Domain')
      expect(JD_CATEGORY_LABELS['education']).toBe('Education')
      expect(JD_CATEGORY_LABELS['certification']).toBe('Certification')
      expect(JD_CATEGORY_LABELS['leadership']).toBe('Leadership')
    })

    it('returns undefined for unknown categories (fallback to raw string in UI)', () => {
      expect(JD_CATEGORY_LABELS['unknown_category']).toBeUndefined()
    })
  })
})
