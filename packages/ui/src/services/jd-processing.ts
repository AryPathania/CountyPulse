import { supabase, createJobDraft, matchBulletsForJd } from '@odie/db'

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
 * 4. Return draft ID for navigation
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

  // Get auth session for edge function calls
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    throw new Error('Not authenticated')
  }

  // Step 1: Generate embedding for JD
  const embedResponse = await supabase.functions.invoke('embed', {
    body: { text: jdText, type: 'jd' },
  })

  if (embedResponse.error) {
    throw new Error(embedResponse.error.message || 'Failed to generate embedding')
  }

  const { embedding } = embedResponse.data

  // Step 2: Match bullets using vector similarity
  const matches = await matchBulletsForJd(userId, embedding, 50, 0.3)
  const matchedBulletIds = matches.map((m) => m.id)

  // Step 3: Create job draft record
  // Convert embedding array to pgvector format string
  const embeddingString = `[${embedding.join(',')}]`

  const draft = await createJobDraft({
    user_id: userId,
    jd_text: jdText,
    jd_embedding: embeddingString,
    retrieved_bullet_ids: matchedBulletIds,
    selected_bullet_ids: matchedBulletIds.slice(0, 10), // Pre-select top 10
  })

  return {
    draftId: draft.id,
    matchedBulletIds,
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

/**
 * Extract job title and company from JD text (simple heuristic)
 */
export function extractJobMetadata(jdText: string): { jobTitle?: string; company?: string } {
  const lines = jdText.split('\n').filter((l) => l.trim())

  // Simple heuristic: first non-empty line might be title
  const jobTitle = lines[0]?.trim().slice(0, 100)

  // Look for company name patterns
  let company: string | undefined
  for (const line of lines.slice(0, 5)) {
    const companyMatch = line.match(/(?:at|@|for)\s+([A-Z][A-Za-z0-9\s&]+)/i)
    if (companyMatch) {
      company = companyMatch[1].trim()
      break
    }
  }

  return { jobTitle, company }
}
