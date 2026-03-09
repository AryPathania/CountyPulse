import { describe, it, expect } from 'vitest'
import {
  ResumeEducationSchema,
  ResumeBulletClassificationSchema,
  ParsedResumeBulletSchema,
  ParsedResumePositionSchema,
  ResumeParseOutputSchema,
  ResumeParseConfigSchema,
} from '@odie/shared'

describe('resume-parse contracts', () => {
  describe('ResumeEducationSchema', () => {
    it('accepts a full education entry', () => {
      const result = ResumeEducationSchema.parse({
        institution: 'MIT',
        degree: 'BS',
        field: 'Computer Science',
        graduationDate: '2020-05',
      })
      expect(result.institution).toBe('MIT')
      expect(result.degree).toBe('BS')
    })

    it('accepts institution-only (optional fields null)', () => {
      const result = ResumeEducationSchema.parse({
        institution: 'Stanford',
      })
      expect(result.institution).toBe('Stanford')
      expect(result.degree).toBeUndefined()
    })

    it('rejects missing institution', () => {
      const result = ResumeEducationSchema.safeParse({ degree: 'BS' })
      expect(result.success).toBe(false)
    })
  })

  describe('ResumeBulletClassificationSchema', () => {
    it('rejects unknown classification', () => {
      const result = ResumeBulletClassificationSchema.safeParse('unknown')
      expect(result.success).toBe(false)
    })
  })

  describe('ParsedResumeBulletSchema', () => {
    it('accepts a strong bullet with all fields', () => {
      const result = ParsedResumeBulletSchema.parse({
        originalText: 'Led team of 5 engineers to deliver project on time',
        classification: 'strong',
        category: 'Leadership',
        hardSkills: ['Project Management'],
        softSkills: ['Leadership'],
      })
      expect(result.originalText).toBe('Led team of 5 engineers to deliver project on time')
      expect(result.classification).toBe('strong')
    })

    it('accepts a fixable bullet with fixedText', () => {
      const result = ParsedResumeBulletSchema.parse({
        originalText: 'Worked on backend stuff',
        classification: 'fixable',
        fixedText: 'Architected backend microservices reducing latency by 30%',
        hardSkills: ['Microservices'],
        softSkills: [],
      })
      expect(result.fixedText).toBe('Architected backend microservices reducing latency by 30%')
    })

    it('accepts a weak bullet with suggestedQuestion', () => {
      const result = ParsedResumeBulletSchema.parse({
        originalText: 'Did some coding',
        classification: 'weak',
        suggestedQuestion: 'Can you describe a specific project you coded?',
        hardSkills: [],
        softSkills: [],
      })
      expect(result.suggestedQuestion).toBe('Can you describe a specific project you coded?')
    })

    it('defaults hardSkills and softSkills to empty arrays', () => {
      const result = ParsedResumeBulletSchema.parse({
        originalText: 'Test bullet',
        classification: 'strong',
      })
      expect(result.hardSkills).toEqual([])
      expect(result.softSkills).toEqual([])
    })

    it('rejects missing originalText', () => {
      const result = ParsedResumeBulletSchema.safeParse({
        classification: 'strong',
      })
      expect(result.success).toBe(false)
    })

    it('rejects invalid classification', () => {
      const result = ParsedResumeBulletSchema.safeParse({
        originalText: 'Test',
        classification: 'excellent',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('ParsedResumePositionSchema', () => {
    it('accepts a full position with bullets', () => {
      const result = ParsedResumePositionSchema.parse({
        company: 'Acme Corp',
        title: 'Software Engineer',
        location: 'San Francisco',
        startDate: '2020-01',
        endDate: '2023-06',
        bullets: [
          {
            originalText: 'Built APIs',
            classification: 'strong',
            hardSkills: ['REST'],
            softSkills: [],
          },
        ],
      })
      expect(result.company).toBe('Acme Corp')
      expect(result.bullets).toHaveLength(1)
    })

    it('accepts a position with empty bullets array', () => {
      const result = ParsedResumePositionSchema.parse({
        company: 'Startup',
        title: 'Intern',
        bullets: [],
      })
      expect(result.bullets).toEqual([])
    })

    it('rejects missing company', () => {
      const result = ParsedResumePositionSchema.safeParse({
        title: 'Engineer',
        bullets: [],
      })
      expect(result.success).toBe(false)
    })

    it('rejects missing title', () => {
      const result = ParsedResumePositionSchema.safeParse({
        company: 'Acme',
        bullets: [],
      })
      expect(result.success).toBe(false)
    })
  })

  describe('ResumeParseOutputSchema', () => {
    const validOutput = {
      positions: [
        {
          company: 'TechCo',
          title: 'SWE',
          bullets: [
            {
              originalText: 'Built features',
              classification: 'strong' as const,
              hardSkills: ['React'],
              softSkills: [],
            },
          ],
        },
      ],
      skills: { hard: ['TypeScript'], soft: ['Communication'] },
      education: [{ institution: 'MIT' }],
      summary: 'Experienced engineer',
    }

    it('accepts a complete parse output', () => {
      const result = ResumeParseOutputSchema.parse(validOutput)
      expect(result.positions).toHaveLength(1)
      expect(result.skills.hard).toContain('TypeScript')
      expect(result.education).toHaveLength(1)
    })

    it('defaults education to empty array when omitted', () => {
      const { education: _edu, ...withoutEducation } = validOutput
      const result = ResumeParseOutputSchema.parse(withoutEducation)
      expect(result.education).toEqual([])
    })

    it('rejects missing positions', () => {
      const result = ResumeParseOutputSchema.safeParse({
        skills: { hard: [], soft: [] },
      })
      expect(result.success).toBe(false)
    })

    it('rejects missing skills', () => {
      const result = ResumeParseOutputSchema.safeParse({
        positions: [],
      })
      expect(result.success).toBe(false)
    })

    it('rejects skills without hard or soft arrays', () => {
      const result = ResumeParseOutputSchema.safeParse({
        positions: [],
        skills: { hard: [] },
      })
      expect(result.success).toBe(false)
    })
  })

  describe('ResumeParseConfigSchema', () => {
    it('defaults to strict when empty', () => {
      const result = ResumeParseConfigSchema.parse({})
      expect(result.qualityBar).toBe('strict')
    })

    it('rejects invalid quality bar', () => {
      const result = ResumeParseConfigSchema.safeParse({ qualityBar: 'ultra' })
      expect(result.success).toBe(false)
    })
  })
})
