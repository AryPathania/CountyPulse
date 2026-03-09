import { supabase, createJobDraft, matchBulletsForJd, createRunLogger, matchBulletsPerRequirement, updateJobDraftRequirements } from '@odie/db'
import { toPgVector } from '@odie/shared'
import type { InterviewContext } from '@odie/shared'

export interface JdProcessingResult {
  draftId: string
  matchedBulletIds: string[]
}

export interface JdProcessingConfig {
  useMock?: boolean
}

/**
 * Mock bullet matches for testing
 */
const MOCK_BULLET_MATCHES = [
  { id: 'mock-bullet-1', current_text: 'Led team of 5 engineers', category: 'Leadership', similarity: 0.92 },
  { id: 'mock-bullet-2', current_text: 'Reduced latency by 40%', category: 'Backend', similarity: 0.88 },
  { id: 'mock-bullet-3', current_text: 'Built React dashboard', category: 'Frontend', similarity: 0.85 },
]

/**
 * Process a job description:
 * 1. Generate embedding for JD text
 * 2. Match bullets using vector similarity
 * 3. Create job_drafts record
 * 4. Log telemetry
 * 5. Return draft ID for navigation
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

  // Create run logger for telemetry
  const runLogger = createRunLogger(userId, 'draft')

  // Get auth session for edge function calls
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    await runLogger.failure({
      input: { jdTextLength: jdText.length },
      error: 'Not authenticated',
    })
    throw new Error('Not authenticated')
  }

  try {
    // Step 1: Generate embedding for JD
    const embedResponse = await supabase.functions.invoke('embed', {
      body: { texts: [jdText], type: 'jd' },
    })

    if (embedResponse.error) {
      await runLogger.failure({
        input: { jdTextLength: jdText.length },
        error: embedResponse.error.message || 'Failed to generate embedding',
      })
      throw new Error(embedResponse.error.message || 'Failed to generate embedding')
    }

    const embedding = embedResponse.data.embeddings[0]

    // Step 2: Match bullets using vector similarity
    const matches = await matchBulletsForJd(userId, embedding, 50, 0.3)
    const matchedBulletIds = matches.map((m) => m.id)

    // Step 3: Create job draft record
    const draft = await createJobDraft({
      user_id: userId,
      jd_text: jdText,
      jd_embedding: toPgVector(embedding),
      retrieved_bullet_ids: matchedBulletIds,
      selected_bullet_ids: matchedBulletIds.slice(0, 10), // Pre-select top 10
    })

    // Step 4: Log successful run
    await runLogger.success({
      input: {
        jdTextLength: jdText.length,
        jdTextPreview: jdText.slice(0, 200),
      },
      output: {
        draftId: draft.id,
        matchedBulletCount: matchedBulletIds.length,
        selectedBulletIds: matchedBulletIds.slice(0, 10),
      },
    })

    return {
      draftId: draft.id,
      matchedBulletIds,
    }
  } catch (error) {
    // Log failure if not already logged
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
 * Mock result for testing
 */
async function getMockResult(userId: string, jdText: string): Promise<JdProcessingResult> {
  // Create a mock draft
  const draft = await createJobDraft({
    user_id: userId,
    jd_text: jdText,
    retrieved_bullet_ids: MOCK_BULLET_MATCHES.map((m) => m.id),
    selected_bullet_ids: MOCK_BULLET_MATCHES.slice(0, 2).map((m) => m.id),
  })

  return {
    draftId: draft.id,
    matchedBulletIds: MOCK_BULLET_MATCHES.map((m) => m.id),
  }
}

export interface GapAnalysisResult {
  draftId: string
  jobTitle: string
  company: string | null
  covered: Array<{
    requirement: { description: string; category: string; importance: 'must_have' | 'nice_to_have' }
    matchedBullets: Array<{ id: string; text: string; similarity: number }>
  }>
  gaps: Array<{
    requirement: { description: string; category: string; importance: 'must_have' | 'nice_to_have' }
  }>
  totalRequirements: number
  coveredCount: number
  interviewContext: InterviewContext | null
}

interface ParsedRequirement {
  description: string
  category: string
  importance: string
}

/**
 * Process a JD with per-requirement gap analysis:
 * 1. Parse JD into requirements
 * 2. Embed each requirement
 * 3. Match bullets per requirement
 * 4. Classify covered vs gap
 * 5. Build gap interview context
 */
export async function analyzeJobDescriptionGaps(
  userId: string,
  jdText: string,
  draftId: string
): Promise<GapAnalysisResult> {
  console.log('[jd-gaps] Starting gap analysis')

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
  console.log('[jd-gaps] Parsed requirements:', requirements?.length)

  if (!requirements || requirements.length === 0) {
    throw new Error('No requirements extracted from job description')
  }

  // 2. Batch embed all requirements
  const typedRequirements = requirements as ParsedRequirement[]
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

  const matchResults = await matchBulletsPerRequirement(
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
        text: m.current_text,
        similarity: m.similarity,
      })),
    }))

  const gaps = matchResults
    .filter(r => !r.isCovered)
    .map(r => ({
      requirement: r.requirement,
    }))

  // 5. Store results on job_drafts
  const parsedRequirements = requirements
  const gapAnalysis = {
    jobTitle,
    company,
    covered: covered.map(c => ({
      requirement: c.requirement,
      matchedBulletIds: c.matchedBullets.map(b => b.id),
    })),
    gaps: gaps.map(g => g.requirement),
    totalRequirements: requirements.length,
    coveredCount: covered.length,
  }

  await updateJobDraftRequirements(draftId, parsedRequirements, gapAnalysis)

  // 6. Build gap interview context (only if there are gaps)
  let interviewContext: InterviewContext | null = null
  if (gaps.length > 0) {
    const existingBulletSummary = covered
      .flatMap(c => c.matchedBullets.map(b => b.text))
      .slice(0, 10)
      .join('; ')

    interviewContext = {
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

  console.log('[jd-gaps] Analysis complete:', covered.length, 'covered,', gaps.length, 'gaps')

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

