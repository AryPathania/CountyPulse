import { z } from 'zod'

/**
 * Job description parsing and gap analysis contracts.
 * Used by the JD parse pipeline to extract structured requirements
 * and by gap analysis to compare requirements against existing bullets.
 */

// A single requirement extracted from a job description
export const JdRequirementSchema = z.object({
  description: z.string(),
  category: z.string(),
  importance: z.enum(['must_have', 'nice_to_have']),
})

export type JdRequirement = z.infer<typeof JdRequirementSchema>

// Structured output from parsing a raw job description
export const JdParseOutputSchema = z.object({
  jobTitle: z.string(),
  company: z.string().nullish(),
  requirements: z.array(JdRequirementSchema),
})

export type JdParseOutput = z.infer<typeof JdParseOutputSchema>

// A bullet matched to a requirement via embedding similarity
export const GapMatchedBulletSchema = z.object({
  bulletId: z.string(),
  bulletText: z.string(),
  similarity: z.number(),
})

export type GapMatchedBullet = z.infer<typeof GapMatchedBulletSchema>

// A requirement that is covered by one or more existing bullets
export const CoveredRequirementSchema = z.object({
  requirement: JdRequirementSchema,
  matchedBullets: z.array(GapMatchedBulletSchema),
})

export type CoveredRequirement = z.infer<typeof CoveredRequirementSchema>

// A requirement that has no matching bullets (a gap)
export const GapRequirementSchema = z.object({
  requirement: JdRequirementSchema,
  suggestedQuestion: z.string().nullish(),
  skillMatch: z.string().nullish(),
})

export type GapRequirement = z.infer<typeof GapRequirementSchema>

// Full gap analysis result comparing JD requirements against user bullets
export const GapAnalysisResultSchema = z.object({
  jobTitle: z.string(),
  company: z.string().nullish(),
  covered: z.array(CoveredRequirementSchema),
  gaps: z.array(GapRequirementSchema),
  totalRequirements: z.number(),
  coveredCount: z.number(),
})

export type GapAnalysisResult = z.infer<typeof GapAnalysisResultSchema>
