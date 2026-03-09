import { z } from 'zod'

/**
 * Resume parsing pipeline contracts.
 *
 * These Zod schemas define the structured output the LLM must return
 * when parsing an uploaded resume. Each bullet is classified as strong,
 * fixable, or weak so the downstream interview and bullet-library flows
 * know how to handle it.
 */

// --- Education ---

export const ResumeEducationSchema = z.object({
  institution: z.string(),
  degree: z.string().nullish(),
  field: z.string().nullish(),
  graduationDate: z.string().nullish(),
})

export type ResumeEducation = z.infer<typeof ResumeEducationSchema>

// --- Bullet classification ---

export const ResumeBulletClassificationSchema = z.enum([
  'strong',
  'fixable',
  'weak',
])

export type ResumeBulletClassification = z.infer<
  typeof ResumeBulletClassificationSchema
>

// --- Parsed bullet ---

export const ParsedResumeBulletSchema = z.object({
  /** Original text extracted from the resume */
  originalText: z.string(),
  /** Quality classification */
  classification: ResumeBulletClassificationSchema,
  /** Improved text — populated when classification is 'fixable' */
  fixedText: z.string().nullish(),
  /** Follow-up question — populated when classification is 'weak' */
  suggestedQuestion: z.string().nullish(),
  /** Functional category (e.g. "Leadership", "Backend") */
  category: z.string().nullish(),
  /** Technical / hard skills mentioned */
  hardSkills: z.array(z.string()).default([]),
  /** Interpersonal / soft skills mentioned */
  softSkills: z.array(z.string()).default([]),
})

export type ParsedResumeBullet = z.infer<typeof ParsedResumeBulletSchema>

// --- Position ---

export const ParsedResumePositionSchema = z.object({
  company: z.string(),
  title: z.string(),
  location: z.string().nullish(),
  startDate: z.string().nullish(),
  endDate: z.string().nullish(),
  bullets: z.array(ParsedResumeBulletSchema),
})

export type ParsedResumePosition = z.infer<typeof ParsedResumePositionSchema>

// --- Top-level parse output ---

export const ResumeParseOutputSchema = z.object({
  positions: z.array(ParsedResumePositionSchema),
  skills: z.object({
    hard: z.array(z.string()),
    soft: z.array(z.string()),
  }),
  education: z.array(ResumeEducationSchema).default([]),
  summary: z.string().nullish(),
})

export type ResumeParseOutput = z.infer<typeof ResumeParseOutputSchema>

// --- Config ---

export const ResumeParseConfigSchema = z.object({
  qualityBar: z.enum(['strict', 'moderate', 'lenient']).default('strict'),
})

export type ResumeParseConfig = z.infer<typeof ResumeParseConfigSchema>
