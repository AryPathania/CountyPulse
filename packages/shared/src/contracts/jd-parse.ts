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

/** Human-readable labels for JD requirement categories */
export const JD_CATEGORY_LABELS: Record<string, string> = {
  technical_skill: 'Technical',
  soft_skill: 'Soft Skill',
  experience_type: 'Experience',
  domain_knowledge: 'Domain',
  education: 'Education',
  certification: 'Certification',
  leadership: 'Leadership',
}

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

// ---------------------------------------------------------------------------
// Refine-analysis intelligence layer
// ---------------------------------------------------------------------------

// Per-requirement verdict from the refine-analysis LLM
export const RefinedRequirementSchema = z.object({
  requirementIndex: z.number(),
  status: z.enum(['covered', 'partially_covered', 'gap']),
  reasoning: z.string(),
  evidenceBulletIds: z.array(z.string()).default([]),
  evidenceEntryIds: z.array(z.string()).default([]),
})

export type RefinedRequirement = z.infer<typeof RefinedRequirementSchema>

// Full output from the refine-analysis edge function
export const RefineAnalysisOutputSchema = z.object({
  refinedRequirements: z.array(RefinedRequirementSchema),
  recommendedBulletIds: z.array(z.string()),
  fitSummary: z.string(),
})

export type RefineAnalysisOutput = z.infer<typeof RefineAnalysisOutputSchema>

// ---------------------------------------------------------------------------
// User triage decisions
// ---------------------------------------------------------------------------

// User's decision on a gap or partially-covered requirement
export const TriageDecisionSchema = z.enum(['included', 'interview', 'ignored'])

export type TriageDecision = z.infer<typeof TriageDecisionSchema>

// ---------------------------------------------------------------------------
// Stored gap analysis (JSONB in job_drafts.gap_analysis)
// ---------------------------------------------------------------------------

// Extends GapAnalysisResultSchema with optional refined fields for persistence
export const GapAnalysisStoredSchema = GapAnalysisResultSchema.extend({
  analyzedAt: z.string(),
  refined: RefineAnalysisOutputSchema.optional(),
  triageDecisions: z.record(z.string(), TriageDecisionSchema).default({}),
  ignoredRequirements: z.array(z.string()).default([]),
})

export type GapAnalysisStored = z.infer<typeof GapAnalysisStoredSchema>
