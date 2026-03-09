import { describe, it, expect } from 'vitest'
import {
  BlankContextSchema,
  ResumeContextSchema,
  GapContextSchema,
  InterviewContextSchema,
  InterviewConfigSchema,
} from '@odie/shared'

describe('interview context contracts', () => {
  describe('BlankContextSchema', () => {
    it('accepts blank mode', () => {
      const result = BlankContextSchema.parse({ mode: 'blank' })
      expect(result.mode).toBe('blank')
    })

    it('rejects wrong mode literal', () => {
      const result = BlankContextSchema.safeParse({ mode: 'resume' })
      expect(result.success).toBe(false)
    })

    it('rejects missing mode', () => {
      const result = BlankContextSchema.safeParse({})
      expect(result.success).toBe(false)
    })
  })

  describe('ResumeContextSchema', () => {
    const validResume = {
      mode: 'resume' as const,
      strongBullets: [
        {
          text: 'Led team of 5 engineers to ship product on time',
          category: 'Leadership',
          hardSkills: ['Project Management'],
          softSkills: ['Leadership'],
        },
      ],
      weakBullets: [
        {
          originalText: 'Did some work',
          suggestedQuestion: 'What kind of work did you do?',
        },
      ],
      positions: [
        { company: 'Acme', title: 'SWE' },
      ],
      skills: {
        hard: ['TypeScript'],
        soft: ['Communication'],
      },
    }

    it('accepts a complete resume context', () => {
      const result = ResumeContextSchema.parse(validResume)
      expect(result.mode).toBe('resume')
      expect(result.strongBullets).toHaveLength(1)
      expect(result.weakBullets).toHaveLength(1)
    })

    it('defaults education to empty array when omitted', () => {
      const result = ResumeContextSchema.parse(validResume)
      expect(result.education).toEqual([])
    })

    it('accepts education entries', () => {
      const result = ResumeContextSchema.parse({
        ...validResume,
        education: [
          { institution: 'MIT', degree: 'BS', field: 'CS', graduationDate: '2020' },
        ],
      })
      expect(result.education).toHaveLength(1)
      expect(result.education[0].institution).toBe('MIT')
    })

    it('rejects wrong mode', () => {
      const result = ResumeContextSchema.safeParse({ ...validResume, mode: 'blank' })
      expect(result.success).toBe(false)
    })

    it('rejects missing strongBullets', () => {
      const { strongBullets: _s, ...rest } = validResume
      const result = ResumeContextSchema.safeParse(rest)
      expect(result.success).toBe(false)
    })

    it('rejects missing skills', () => {
      const { skills: _s, ...rest } = validResume
      const result = ResumeContextSchema.safeParse(rest)
      expect(result.success).toBe(false)
    })

    it('rejects strongBullets with too-short text', () => {
      const result = ResumeContextSchema.safeParse({
        ...validResume,
        strongBullets: [{ text: 'short', hardSkills: [], softSkills: [] }],
      })
      expect(result.success).toBe(false)
    })
  })

  describe('GapContextSchema', () => {
    const validGap = {
      mode: 'gaps' as const,
      gaps: [
        {
          requirement: 'Experience with Kubernetes',
          category: 'DevOps',
          importance: 'must_have' as const,
        },
      ],
      existingBulletSummary: 'Has 5 years of backend experience',
      jobTitle: 'Senior SWE',
      company: 'Google',
    }

    it('accepts a valid gap context', () => {
      const result = GapContextSchema.parse(validGap)
      expect(result.mode).toBe('gaps')
      expect(result.gaps).toHaveLength(1)
      expect(result.jobTitle).toBe('Senior SWE')
    })

    it('accepts null company', () => {
      const result = GapContextSchema.parse({ ...validGap, company: null })
      expect(result.company).toBeNull()
    })

    it('rejects wrong mode', () => {
      const result = GapContextSchema.safeParse({ ...validGap, mode: 'resume' })
      expect(result.success).toBe(false)
    })

    it('rejects missing gaps array', () => {
      const { gaps: _g, ...rest } = validGap
      const result = GapContextSchema.safeParse(rest)
      expect(result.success).toBe(false)
    })

    it('rejects missing existingBulletSummary', () => {
      const { existingBulletSummary: _e, ...rest } = validGap
      const result = GapContextSchema.safeParse(rest)
      expect(result.success).toBe(false)
    })

    it('rejects invalid gap importance value', () => {
      const result = GapContextSchema.safeParse({
        ...validGap,
        gaps: [{ requirement: 'Test', category: 'Test', importance: 'critical' }],
      })
      expect(result.success).toBe(false)
    })
  })

  describe('InterviewContextSchema (discriminated union)', () => {
    it('discriminates blank mode', () => {
      const result = InterviewContextSchema.parse({ mode: 'blank' })
      expect(result.mode).toBe('blank')
    })

    it('discriminates resume mode', () => {
      const result = InterviewContextSchema.parse({
        mode: 'resume',
        strongBullets: [{ text: 'Led a major project to completion on time', hardSkills: [], softSkills: [] }],
        weakBullets: [],
        positions: [{ company: 'Test', title: 'Eng' }],
        skills: { hard: [], soft: [] },
      })
      expect(result.mode).toBe('resume')
    })

    it('discriminates gaps mode', () => {
      const result = InterviewContextSchema.parse({
        mode: 'gaps',
        gaps: [{ requirement: 'K8s', category: 'DevOps', importance: 'must_have' }],
        existingBulletSummary: 'Backend dev',
        jobTitle: 'SRE',
      })
      expect(result.mode).toBe('gaps')
    })

    it('rejects unknown mode', () => {
      const result = InterviewContextSchema.safeParse({ mode: 'unknown' })
      expect(result.success).toBe(false)
    })

    it('rejects resume mode with missing required fields', () => {
      const result = InterviewContextSchema.safeParse({
        mode: 'resume',
        strongBullets: [],
        // missing weakBullets, positions, skills
      })
      expect(result.success).toBe(false)
    })
  })

  describe('InterviewConfigSchema', () => {
    it('applies all defaults for empty config', () => {
      const result = InterviewConfigSchema.parse({})
      expect(result.metricsEmphasis).toBe('high')
      expect(result.followUpDepth).toBe(3)
      expect(result.explorationStyle).toBe('exploratory')
      expect(result.minBulletsPerPosition).toBe(4)
      expect(result.maxMessagesInContext).toBe(20)
      expect(result.temperature).toBe(0.7)
      expect(result.maxTokens).toBe(2000)
      expect(result.context).toEqual({ mode: 'blank' })
    })

    it('accepts custom values', () => {
      const result = InterviewConfigSchema.parse({
        metricsEmphasis: 'low',
        followUpDepth: 5,
        explorationStyle: 'focused',
        minBulletsPerPosition: 2,
        maxMessagesInContext: 50,
        temperature: 1.0,
        maxTokens: 3000,
      })
      expect(result.metricsEmphasis).toBe('low')
      expect(result.followUpDepth).toBe(5)
    })

    it('accepts resume context in config', () => {
      const result = InterviewConfigSchema.parse({
        context: {
          mode: 'resume',
          strongBullets: [{ text: 'Built full-stack React application', hardSkills: [], softSkills: [] }],
          weakBullets: [],
          positions: [{ company: 'A', title: 'B' }],
          skills: { hard: [], soft: [] },
        },
      })
      expect(result.context.mode).toBe('resume')
    })

    it('rejects followUpDepth below min', () => {
      const result = InterviewConfigSchema.safeParse({ followUpDepth: 0 })
      expect(result.success).toBe(false)
    })

    it('rejects followUpDepth above max', () => {
      const result = InterviewConfigSchema.safeParse({ followUpDepth: 11 })
      expect(result.success).toBe(false)
    })

    it('rejects temperature below 0', () => {
      const result = InterviewConfigSchema.safeParse({ temperature: -0.1 })
      expect(result.success).toBe(false)
    })

    it('rejects temperature above 2', () => {
      const result = InterviewConfigSchema.safeParse({ temperature: 2.1 })
      expect(result.success).toBe(false)
    })
  })
})
