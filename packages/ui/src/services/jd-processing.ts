import { supabase, createJobDraft, matchBulletsForJd, createRunLogger } from '@odie/db'
import { toPgVector } from '@odie/shared'

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
      body: { text: jdText, type: 'jd' },
    })

    if (embedResponse.error) {
      await runLogger.failure({
        input: { jdTextLength: jdText.length },
        error: embedResponse.error.message || 'Failed to generate embedding',
      })
      throw new Error(embedResponse.error.message || 'Failed to generate embedding')
    }

    const { embedding } = embedResponse.data

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

