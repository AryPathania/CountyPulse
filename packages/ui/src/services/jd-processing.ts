import { supabase, createJobDraft, createRunLogger, matchItemsPerRequirement, updateJobDraftRequirements, updateJobDraftBullets } from '@odie/db'
import type { InterviewContext, JdRequirement } from '@odie/shared'

export interface JdProcessingResult {
  draftId: string
}

export interface JdProcessingConfig {
  useMock?: boolean
}

/**
 * Process a job description:
 * 1. Create job_drafts record with the JD text
 * 2. Log telemetry
 * 3. Return draft ID for navigation
 *
 * Embedding + matching is deferred to gap analysis.
 */
export async function processJobDescription(
  userId: string,
  jdText: string,
  config: JdProcessingConfig = {}
): Promise<JdProcessingResult> {
  const { useMock = false } = config

  if (useMock) {
    return getMockResult(userId, jdText)
  }

  const runLogger = createRunLogger(userId, 'draft')

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    await runLogger.failure({
      input: { jdTextLength: jdText.length },
      error: 'Not authenticated',
    })
    throw new Error('Not authenticated')
  }

  try {
    const draft = await createJobDraft({
      user_id: userId,
      jd_text: jdText,
    })

    await runLogger.success({
      input: {
        jdTextLength: jdText.length,
        jdTextPreview: jdText.slice(0, 200),
      },
      output: {
        draftId: draft.id,
      },
    })

    return { draftId: draft.id }
  } catch (error) {
    await runLogger.failure({
      input: { jdTextLength: jdText.length },
      error: error instanceof Error ? error.message : 'Unknown error',
    }).catch(() => {
      // Ignore logging errors to not mask the original error
    })
    throw error
  }
}

/**
 * Mock result for testing — creates a bare draft with no bullets.
 */
async function getMockResult(userId: string, jdText: string): Promise<JdProcessingResult> {
  const draft = await createJobDraft({
    user_id: userId,
    jd_text: jdText,
  })

  return { draftId: draft.id }
}

export interface RequirementInfo {
  description: string
  category: string
  importance: 'must_have' | 'nice_to_have'
}

export interface MatchedBullet {
  id: string
  text: string
  similarity: number
}

export interface CoveredRequirement {
  requirement: RequirementInfo
  matchedBullets: MatchedBullet[]
}

export interface UserSkills {
  hard: string[]
  soft: string[]
}

export interface GapItem {
  requirement: RequirementInfo
  skillMatch?: string
}

export interface GapAnalysisServiceResult {
  draftId: string
  jobTitle: string
  company: string | null
  covered: CoveredRequirement[]
  gaps: GapItem[]
  totalRequirements: number
  coveredCount: number
  interviewContext: InterviewContext | null
}

/**
 * Check if any user skill (case-insensitive) appears in the requirement text.
 * Returns the first matching skill name, or undefined if none match.
 * Pure function — no side effects.
 */
export function findSkillMatch(
  requirementText: string,
  skills?: UserSkills
): string | undefined {
  if (!skills) return undefined
  const lower = requirementText.toLowerCase()
  const allSkills = [...skills.hard, ...skills.soft]
  for (const skill of allSkills) {
    if (skill && lower.includes(skill.toLowerCase())) {
      return skill
    }
  }
  return undefined
}

/**
 * Build an interview context from gap analysis results.
 * Pure function — used both after fresh analysis and when loading cached results.
 */
export function buildInterviewContextFromGaps(
  gaps: GapAnalysisServiceResult['gaps'],
  covered: GapAnalysisServiceResult['covered'],
  jobTitle: string,
  company: string | null
): InterviewContext | null {
  if (gaps.length === 0) return null

  const existingBulletSummary = covered
    .flatMap(c => c.matchedBullets.map(b => b.text))
    .slice(0, 10)
    .join('; ')

  return {
    mode: 'gaps',
    gaps: gaps.map(g => ({
      requirement: g.requirement.description,
      category: g.requirement.category,
      importance: g.requirement.importance,
    })),
    existingBulletSummary: existingBulletSummary || 'No existing bullets matched.',
    jobTitle,
    company,
  }
}

/**
 * Reconstruct GapAnalysisServiceResult from stored gap_analysis JSON column.
 * Used by DraftResumePage when loading a cached analysis.
 */
export function buildGapDataFromStored(
  draftId: string,
  storedGapAnalysis: {
    jobTitle: string
    company: string | null
    covered: CoveredRequirement[]
    gaps: Array<RequirementInfo & { skillMatch?: string }>
    totalRequirements: number
    coveredCount: number
    analyzedAt: string
  }
): GapAnalysisServiceResult & { analyzedAt: string } {
  const gaps = storedGapAnalysis.gaps.map(g => {
    const { skillMatch, ...requirement } = g
    return { requirement, ...(skillMatch ? { skillMatch } : {}) }
  })
  const interviewContext = buildInterviewContextFromGaps(
    gaps,
    storedGapAnalysis.covered,
    storedGapAnalysis.jobTitle,
    storedGapAnalysis.company
  )

  return {
    draftId,
    jobTitle: storedGapAnalysis.jobTitle,
    company: storedGapAnalysis.company,
    covered: storedGapAnalysis.covered,
    gaps,
    totalRequirements: storedGapAnalysis.totalRequirements,
    coveredCount: storedGapAnalysis.coveredCount,
    interviewContext,
    analyzedAt: storedGapAnalysis.analyzedAt,
  }
}

/**
 * Process a JD with per-requirement gap analysis:
 * 1. Parse JD into requirements
 * 2. Embed each requirement
 * 3. Match bullets per requirement
 * 4. Classify covered vs gap
 * 5. Store results + update draft bullets
 * 6. Build gap interview context
 */
export async function analyzeJobDescriptionGaps(
  userId: string,
  jdText: string,
  draftId: string,
  skills?: UserSkills
): Promise<GapAnalysisServiceResult> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')

  // 1. Parse JD into requirements
  const parseResponse = await supabase.functions.invoke('parse-jd', {
    body: { text: jdText },
  })

  if (parseResponse.error) {
    throw new Error(parseResponse.error.message || 'JD parsing failed')
  }

  const { jobTitle, company, requirements } = parseResponse.data

  if (!requirements || requirements.length === 0) {
    throw new Error('No requirements extracted from job description')
  }

  // 2. Batch embed all requirements
  const typedRequirements = requirements as JdRequirement[]
  const requirementTexts = typedRequirements.map(r => r.description)
  const embedResponse = await supabase.functions.invoke('embed', {
    body: { texts: requirementTexts, type: 'jd' },
  })

  if (embedResponse.error) {
    throw new Error(embedResponse.error.message || 'Failed to embed requirements')
  }

  const embeddings: number[][] = embedResponse.data.embeddings

  // 3. Per-requirement matching
  const requirementsWithEmbeddings = typedRequirements.map((req, i) => ({
    description: req.description,
    category: req.category,
    importance: req.importance,
    embedding: embeddings[i],
  }))

  const matchResults = await matchItemsPerRequirement(
    userId,
    requirementsWithEmbeddings,
    5, // top 5 matches per requirement
    0.4  // lower threshold for gap detection
  )

  // 4. Classify covered vs gap
  const covered = matchResults
    .filter(r => r.isCovered)
    .map(r => ({
      requirement: r.requirement,
      matchedBullets: r.matches.map(m => ({
        id: m.id,
        text: m.content_text,
        similarity: m.similarity,
      })),
    }))

  const gaps = matchResults
    .filter(r => !r.isCovered)
    .map(r => {
      const skillMatch = findSkillMatch(r.requirement.description, skills)
      return {
        requirement: r.requirement,
        ...(skillMatch ? { skillMatch } : {}),
      }
    })

  // 5. Store results on job_drafts (with full bullet data, not just IDs)
  const gapAnalysis = {
    jobTitle,
    company,
    covered: covered.map(c => ({
      requirement: c.requirement,
      matchedBullets: c.matchedBullets,
    })),
    gaps: gaps.map(g => ({ ...g.requirement, ...(g.skillMatch ? { skillMatch: g.skillMatch } : {}) })),
    totalRequirements: requirements.length,
    coveredCount: covered.length,
    analyzedAt: new Date().toISOString(),
  }

  await updateJobDraftRequirements(draftId, requirements, gapAnalysis, jobTitle, company)

  // Update draft with all matched bullet IDs
  const allMatchedBulletIds = [...new Set(
    covered.flatMap(c => c.matchedBullets.map(b => b.id))
  )]
  await updateJobDraftBullets(draftId, allMatchedBulletIds)

  // 6. Build gap interview context
  const interviewContext = buildInterviewContextFromGaps(gaps, covered, jobTitle, company)

  return {
    draftId,
    jobTitle,
    company,
    covered,
    gaps,
    totalRequirements: requirements.length,
    coveredCount: covered.length,
    interviewContext,
  }
}
