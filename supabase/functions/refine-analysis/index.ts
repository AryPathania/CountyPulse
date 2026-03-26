import { withMiddleware, jsonResponse, callReasoningModel, logRun } from '../_shared/middleware.ts'
import type { HandlerContext } from '../_shared/middleware.ts'
import { buildRefineAnalysisPrompt, buildRefineAnalysisUserMessage, REFINE_ANALYSIS_PROMPT_ID } from '../_shared/prompts/refine-analysis.ts'

interface RequirementInput {
  description: string
  category: string
  importance: string
  vectorStatus: 'covered' | 'gap'
  matchedBulletIds: string[]
}

interface RefineAnalysisRequest {
  jobTitle: string
  company: string | null
  requirements: RequirementInput[]
  skills: { hard: string[]; soft: string[] }
}

const MAX_BULLETS = 80
const BULLET_TRUNCATE_LENGTH = 200

withMiddleware(async (req: Request, ctx: HandlerContext) => {
  const body = await req.json() as RefineAnalysisRequest
  const { jobTitle, company, requirements, skills } = body

  console.log('[refine-analysis] Starting refinement for:', jobTitle, '| requirements:', requirements?.length)

  if (!requirements || requirements.length === 0) {
    return jsonResponse({ error: 'Requirements are required' }, 400)
  }

  if (!jobTitle) {
    return jsonResponse({ error: 'Job title is required' }, 400)
  }

  // Collect all vector-matched bullet IDs
  const matchedBulletIds = new Set(
    requirements.flatMap(r => r.matchedBulletIds)
  )

  // Fetch user's bullets server-side (explicit user_id filter — service role bypasses RLS)
  const { data: allBullets, error: bulletsError } = await ctx.supabase
    .from('bullets')
    .select('id, current_text, positions!inner(title, company, start_date)')
    .eq('user_id', ctx.user.id)
    .order('created_at', { ascending: false })

  if (bulletsError) {
    console.error('[refine-analysis] Failed to fetch bullets:', bulletsError.message)
    return jsonResponse({ error: 'Failed to fetch user bullets' }, 500)
  }

  // Fetch profile entries (explicit user_id filter)
  const { data: profileEntries, error: entriesError } = await ctx.supabase
    .from('profile_entries')
    .select('id, category, title, subtitle, text_items')
    .eq('user_id', ctx.user.id)

  if (entriesError) {
    console.error('[refine-analysis] Failed to fetch profile entries:', entriesError.message)
    return jsonResponse({ error: 'Failed to fetch profile entries' }, 500)
  }

  // Prioritize bullets: matched first, then by position start_date DESC (most recent)
  const matched: typeof allBullets = []
  const unmatched: typeof allBullets = []
  for (const b of allBullets ?? []) {
    if (matchedBulletIds.has(b.id)) {
      matched.push(b)
    } else {
      unmatched.push(b)
    }
  }

  // Sort unmatched by position recency
  unmatched.sort((a, b) => {
    const dateA = a.positions?.start_date ?? ''
    const dateB = b.positions?.start_date ?? ''
    return dateB.localeCompare(dateA)
  })

  const selectedBullets = [...matched, ...unmatched].slice(0, MAX_BULLETS)
  const bulletData = selectedBullets.map(b => ({
    id: b.id,
    text: (b.current_text ?? '').slice(0, BULLET_TRUNCATE_LENGTH),
  }))

  const entryData = (profileEntries ?? []).map(e => ({
    id: e.id,
    category: e.category,
    title: e.title,
    subtitle: e.subtitle ?? undefined,
  }))

  // Build the valid ID set for hallucination detection
  const validBulletIds = new Set(bulletData.map(b => b.id))
  const validEntryIds = new Set(entryData.map(e => e.id))

  // Build prompt + user message
  const systemPrompt = buildRefineAnalysisPrompt()
  const userMessage = buildRefineAnalysisUserMessage({
    jobTitle,
    company,
    requirements,
    bullets: bulletData,
    profileEntries: entryData,
    skills: skills ?? { hard: [], soft: [] },
  })

  console.log('[refine-analysis] Calling o4-mini | bullets:', bulletData.length, '| entries:', entryData.length)

  const { parsed, usage, latencyMs } = await callReasoningModel({
    openaiKey: ctx.openaiKey,
    model: 'o4-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    maxCompletionTokens: 16000,
  })

  // Validate returned IDs — discard hallucinated ones
  let hallucinatedCount = 0
  let totalIdCount = 0

  if (parsed.refinedRequirements) {
    for (const rr of parsed.refinedRequirements) {
      if (rr.evidenceBulletIds) {
        totalIdCount += rr.evidenceBulletIds.length
        rr.evidenceBulletIds = rr.evidenceBulletIds.filter((id: string) => {
          if (!validBulletIds.has(id)) { hallucinatedCount++; return false }
          return true
        })
      }
      if (rr.evidenceEntryIds) {
        totalIdCount += rr.evidenceEntryIds.length
        rr.evidenceEntryIds = rr.evidenceEntryIds.filter((id: string) => {
          if (!validEntryIds.has(id)) { hallucinatedCount++; return false }
          return true
        })
      }
    }
  }

  if (parsed.recommendedBulletIds) {
    totalIdCount += parsed.recommendedBulletIds.length
    parsed.recommendedBulletIds = parsed.recommendedBulletIds.filter((id: string) => {
      if (!validBulletIds.has(id)) { hallucinatedCount++; return false }
      return true
    })
  }

  // If >50% of IDs are hallucinated, signal fallback
  const hallucinationRate = totalIdCount > 0 ? hallucinatedCount / totalIdCount : 0
  if (hallucinationRate > 0.5) {
    console.error('[refine-analysis] Hallucination rate too high:', hallucinationRate, '| total:', totalIdCount, '| hallucinated:', hallucinatedCount)

    await logRun(ctx.supabase, {
      user_id: ctx.user.id as string,
      type: 'refine-analysis',
      prompt_id: REFINE_ANALYSIS_PROMPT_ID,
      model: 'o4-mini',
      input: { requirementCount: requirements.length, bulletCount: bulletData.length },
      output: { hallucinationRate, hallucinatedCount, totalIdCount },
      latency_ms: latencyMs,
      tokens_in: usage?.prompt_tokens ?? null,
      tokens_out: usage?.completion_tokens ?? null,
    })

    return jsonResponse({ fallback: true, reason: 'hallucination_rate_exceeded' })
  }

  // Log success
  await logRun(ctx.supabase, {
    user_id: ctx.user.id as string,
    type: 'refine-analysis',
    prompt_id: REFINE_ANALYSIS_PROMPT_ID,
    model: 'o4-mini',
    input: {
      requirementCount: requirements.length,
      bulletCount: bulletData.length,
      entryCount: entryData.length,
    },
    output: {
      coveredCount: parsed.refinedRequirements?.filter((r: { status: string }) => r.status === 'covered').length ?? 0,
      partialCount: parsed.refinedRequirements?.filter((r: { status: string }) => r.status === 'partially_covered').length ?? 0,
      gapCount: parsed.refinedRequirements?.filter((r: { status: string }) => r.status === 'gap').length ?? 0,
      recommendedBulletCount: parsed.recommendedBulletIds?.length ?? 0,
      hallucinatedCount,
    },
    latency_ms: latencyMs,
    tokens_in: usage?.prompt_tokens ?? null,
    tokens_out: usage?.completion_tokens ?? null,
  })

  console.log('[refine-analysis] Success | latency:', latencyMs, 'ms | hallucinated IDs removed:', hallucinatedCount)

  return jsonResponse({
    ...parsed,
    bulletTexts: Object.fromEntries(bulletData.map(b => [b.id, b.text])),
  })
})
