import { supabase, createJobDraft, createRunLogger, matchItemsPerRequirement, updateJobDraftRequirements, updateJobDraftBullets } from '@odie/db'
import type { InterviewContext, JdRequirement, RefineAnalysisOutput, TriageDecision } from '@odie/shared'

export type GapAnalysisStage = 'parsing' | 'embedding' | 'matching' | 'refining' | 'storing'

export const STAGE_MESSAGES: Record<GapAnalysisStage, string> = {
  parsing: 'Parsing job description...',
  embedding: 'Extracting requirements...',
  matching: 'Matching your experience...',
  refining: 'Double-checking results...',
  storing: 'Almost ready...',
}

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

export interface PartialCoveredItem {
  requirement: RequirementInfo
  reasoning: string
  evidenceBullets: MatchedBullet[]
}

export interface GapAnalysisServiceResult {
  draftId: string
  jobTitle: string
  company: string | null
  covered: CoveredRequirement[]
  partiallyCovered: PartialCoveredItem[]
  gaps: GapItem[]
  totalRequirements: number
  coveredCount: number
  interviewContext: InterviewContext | null
  refined?: RefineAnalysisOutput
  triageDecisions: Record<string, TriageDecision>
  ignoredRequirements: string[]
  fitSummary?: string
  refineFailed?: boolean
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
 * When triageDecisions are provided, only includes items marked 'interview'.
 */
export function buildInterviewContextFromGaps(
  gaps: GapAnalysisServiceResult['gaps'],
  covered: GapAnalysisServiceResult['covered'],
  jobTitle: string,
  company: string | null,
  triageDecisions?: Record<string, TriageDecision>,
  partiallyCovered?: PartialCoveredItem[]
): InterviewContext | null {
  // Collect all items that should go to interview
  const interviewGaps: Array<{ requirement: RequirementInfo }> = []

  if (triageDecisions && Object.keys(triageDecisions).length > 0) {
    // Only include items explicitly marked for interview
    for (const g of gaps) {
      const key = hashRequirementDescription(g.requirement.description)
      if (triageDecisions[key] === 'interview') {
        interviewGaps.push(g)
      }
    }
    for (const p of partiallyCovered ?? []) {
      const key = hashRequirementDescription(p.requirement.description)
      if (triageDecisions[key] === 'interview') {
        interviewGaps.push(p)
      }
    }
  } else {
    // No triage decisions yet — include all gaps (backward compat)
    interviewGaps.push(...gaps)
  }

  if (interviewGaps.length === 0) return null

  const existingBulletSummary = covered
    .flatMap(c => c.matchedBullets.map(b => b.text))
    .slice(0, 10)
    .join('; ')

  return {
    mode: 'gaps',
    gaps: interviewGaps.map(g => ({
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
 * Simple hash of a requirement description for keying triage decisions.
 * Uses a basic string hash — stable across reruns for the same description.
 */
export function hashRequirementDescription(description: string): string {
  let hash = 0
  for (let i = 0; i < description.length; i++) {
    const char = description.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0 // Convert to 32-bit integer
  }
  return hash.toString(36)
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
    refined?: RefineAnalysisOutput
    partiallyCovered?: PartialCoveredItem[]
    triageDecisions?: Record<string, TriageDecision>
    ignoredRequirements?: string[]
    fitSummary?: string
    refineFailed?: boolean
  }
): GapAnalysisServiceResult & { analyzedAt: string } {
  const gaps = storedGapAnalysis.gaps.map(g => {
    const { skillMatch, ...requirement } = g
    return { requirement, ...(skillMatch ? { skillMatch } : {}) }
  })
  const triageDecisions = storedGapAnalysis.triageDecisions ?? {}
  const partiallyCovered = storedGapAnalysis.partiallyCovered ?? []
  const interviewContext = buildInterviewContextFromGaps(
    gaps,
    storedGapAnalysis.covered,
    storedGapAnalysis.jobTitle,
    storedGapAnalysis.company,
    triageDecisions,
    partiallyCovered
  )

  return {
    draftId,
    jobTitle: storedGapAnalysis.jobTitle,
    company: storedGapAnalysis.company,
    covered: storedGapAnalysis.covered,
    partiallyCovered,
    gaps,
    totalRequirements: storedGapAnalysis.totalRequirements,
    coveredCount: storedGapAnalysis.coveredCount,
    interviewContext,
    refined: storedGapAnalysis.refined,
    triageDecisions,
    ignoredRequirements: storedGapAnalysis.ignoredRequirements ?? [],
    fitSummary: storedGapAnalysis.fitSummary,
    refineFailed: storedGapAnalysis.refineFailed,
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
  skills?: UserSkills,
  onProgress?: (stage: GapAnalysisStage) => void
): Promise<GapAnalysisServiceResult> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')

  // 1. Parse JD into requirements
  onProgress?.('parsing')
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
  onProgress?.('embedding')
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
  onProgress?.('matching')
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

  // 4. Classify covered vs gap (mechanical / vector-based)
  const mechanicalCovered = matchResults
    .filter(r => r.isCovered)
    .map(r => ({
      requirement: r.requirement,
      matchedBullets: r.matches.map(m => ({
        id: m.id,
        text: m.content_text,
        similarity: m.similarity,
      })),
    }))

  const mechanicalGaps = matchResults
    .filter(r => !r.isCovered)
    .map(r => ({
      requirement: r.requirement,
    }))

  // 5. Call refine-analysis LLM for smarter classification
  onProgress?.('refining')
  let covered = mechanicalCovered
  let gaps: GapItem[] = mechanicalGaps
  let partiallyCovered: PartialCoveredItem[] = []
  let refined: RefineAnalysisOutput | undefined
  let fitSummary: string | undefined
  let refineFailed = false

  try {
    const refineResponse = await supabase.functions.invoke('refine-analysis', {
      body: {
        jobTitle,
        company,
        requirements: typedRequirements.map((req, i) => ({
          description: req.description,
          category: req.category,
          importance: req.importance,
          vectorStatus: matchResults[i].isCovered ? 'covered' : 'gap',
          matchedBulletIds: matchResults[i].matches.map(m => m.id),
        })),
        skills: skills ?? { hard: [], soft: [] },
      },
    })

    if (refineResponse.error) {
      throw new Error(refineResponse.error.message || 'Refine analysis failed')
    }

    const refineData = refineResponse.data

    // Check for fallback signal (hallucination rate exceeded)
    if (refineData.fallback) {
      console.warn('[gap-analysis] Refine-analysis returned fallback:', refineData.reason)
      refineFailed = true
      // Use mechanical results with findSkillMatch for fallback
      gaps = mechanicalGaps.map(g => {
        const skillMatch = findSkillMatch(g.requirement.description, skills)
        return { ...g, ...(skillMatch ? { skillMatch } : {}) }
      })
    } else {
      const bulletTexts: Record<string, string> = refineData.bulletTexts ?? {}
      refined = refineData as RefineAnalysisOutput
      fitSummary = refined.fitSummary

      // Rebuild covered/partial/gaps from refined results
      const newCovered: CoveredRequirement[] = []
      const newPartial: PartialCoveredItem[] = []
      const newGaps: GapItem[] = []

      for (const rr of refined.refinedRequirements) {
        const req = typedRequirements[rr.requirementIndex]
        if (!req) continue

        if (rr.status === 'covered') {
          // Find matched bullets from mechanical results + evidence bullets
          const mechanicalMatch = matchResults[rr.requirementIndex]
          const bulletIds = new Set([
            ...(rr.evidenceBulletIds ?? []),
            ...(mechanicalMatch?.matches.map(m => m.id) ?? []),
          ])
          const matchedBullets = mechanicalMatch?.matches
            .filter(m => bulletIds.has(m.id))
            .map(m => ({ id: m.id, text: m.content_text, similarity: m.similarity })) ?? []
          // Add evidence bullets not in mechanical matches
          for (const bid of rr.evidenceBulletIds ?? []) {
            if (!matchedBullets.some(b => b.id === bid)) {
              matchedBullets.push({ id: bid, text: bulletTexts[bid] ?? '', similarity: 0 })
            }
          }
          newCovered.push({ requirement: req, matchedBullets })
        } else if (rr.status === 'partially_covered') {
          const evidenceBullets = (rr.evidenceBulletIds ?? []).map(bid => {
            const match = matchResults[rr.requirementIndex]?.matches.find(m => m.id === bid)
            return { id: bid, text: match?.content_text ?? bulletTexts[bid] ?? '', similarity: match?.similarity ?? 0 }
          })
          newPartial.push({ requirement: req, reasoning: rr.reasoning, evidenceBullets })
        } else {
          newGaps.push({ requirement: req })
        }
      }

      covered = newCovered
      partiallyCovered = newPartial
      gaps = newGaps

      // Expand matched bullet IDs with recommended ones
      if (refined.recommendedBulletIds?.length) {
        // These will be added to allMatchedBulletIds below
      }
    }
  } catch (err) {
    console.error('[gap-analysis] Refine-analysis failed, using mechanical results:', err)
    refineFailed = true
    // Fallback: use mechanical results with findSkillMatch
    gaps = mechanicalGaps.map(g => {
      const skillMatch = findSkillMatch(g.requirement.description, skills)
      return { ...g, ...(skillMatch ? { skillMatch } : {}) }
    })
  }

  // 6. Store results on job_drafts
  onProgress?.('storing')
  const gapAnalysis = {
    jobTitle,
    company,
    covered: covered.map(c => ({
      requirement: c.requirement,
      matchedBullets: c.matchedBullets,
    })),
    gaps: gaps.map(g => ({ ...g.requirement, ...(g.skillMatch ? { skillMatch: g.skillMatch } : {}) })),
    partiallyCovered: partiallyCovered.map(p => ({
      requirement: p.requirement,
      reasoning: p.reasoning,
      evidenceBullets: p.evidenceBullets,
    })),
    totalRequirements: requirements.length,
    coveredCount: covered.length,
    analyzedAt: new Date().toISOString(),
    ...(refined ? { refined } : {}),
    ...(fitSummary ? { fitSummary } : {}),
    ...(refineFailed ? { refineFailed } : {}),
    triageDecisions: {},
    ignoredRequirements: [],
  }

  await updateJobDraftRequirements(draftId, requirements, gapAnalysis, jobTitle, company)

  // Update draft with all matched bullet IDs (covered + partial evidence + recommended)
  const allMatchedBulletIds = [...new Set([
    ...covered.flatMap(c => c.matchedBullets.map(b => b.id)),
    ...partiallyCovered.flatMap(p => p.evidenceBullets.map(b => b.id)),
    ...(refined?.recommendedBulletIds ?? []),
  ])]
  await updateJobDraftBullets(draftId, allMatchedBulletIds)

  // 7. Build gap interview context
  const interviewContext = buildInterviewContextFromGaps(gaps, covered, jobTitle, company)

  return {
    draftId,
    jobTitle,
    company,
    covered,
    partiallyCovered,
    gaps,
    totalRequirements: requirements.length,
    coveredCount: covered.length,
    interviewContext,
    refined,
    triageDecisions: {},
    ignoredRequirements: [],
    fitSummary,
    refineFailed,
  }
}
