import { withMiddleware, jsonResponse, callChatCompletion, logRun } from '../_shared/middleware.ts'
import type { HandlerContext } from '../_shared/middleware.ts'
import { buildResumeParsePrompt, DEFAULT_RESUME_PARSE_CONFIG, RESUME_PARSE_PROMPT_ID } from '../_shared/prompts/resume-parse.ts'

interface ParseResumeRequest {
  text: string
  config?: { qualityBar?: 'strict' | 'moderate' | 'lenient' }
}

withMiddleware(async (req: Request, ctx: HandlerContext) => {
  const { text, config: requestConfig } = await req.json() as ParseResumeRequest
  console.log('[parse-resume] Parsing resume text, length:', text?.length)

  if (!text || typeof text !== 'string') {
    return jsonResponse({ error: 'Resume text is required' }, 400)
  }

  const config = { ...DEFAULT_RESUME_PARSE_CONFIG, ...requestConfig }

  const { parsed, usage, latencyMs } = await callChatCompletion({
    openaiKey: ctx.openaiKey,
    messages: [
      { role: 'system', content: buildResumeParsePrompt(config) },
      { role: 'user', content: text },
    ],
    temperature: 0.3,
    maxTokens: 4000,
  })

  await logRun(ctx.supabase, {
    user_id: ctx.user.id as string,
    type: 'parse-resume',
    prompt_id: RESUME_PARSE_PROMPT_ID,
    model: 'gpt-4o',
    input: { text_length: text.length, config },
    output: parsed,
    latency_ms: latencyMs,
    tokens_in: usage?.prompt_tokens ?? null,
    tokens_out: usage?.completion_tokens ?? null,
  })

  console.log('[parse-resume] Success, positions:', parsed.positions?.length)

  return jsonResponse(parsed)
})
