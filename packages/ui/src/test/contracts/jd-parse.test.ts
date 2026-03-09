import { describe, it, expect } from 'vitest'
import {
  JdRequirementSchema,
  JdParseOutputSchema,
  GapMatchedBulletSchema,
  CoveredRequirementSchema,
  GapRequirementSchema,
  GapAnalysisResultSchema,
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
})
