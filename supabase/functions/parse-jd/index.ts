import { withMiddleware, jsonResponse, callChatCompletion, logRun } from '../_shared/middleware.ts'
import type { HandlerContext } from '../_shared/middleware.ts'
import { buildJdParsePrompt, JD_PARSE_PROMPT_ID } from '../_shared/prompts/jd-parse.ts'

interface ParseJdRequest {
  text: string
}

withMiddleware(async (req: Request, ctx: HandlerContext) => {
  const { text } = await req.json() as ParseJdRequest
  console.log('[parse-jd] Parsing JD text, length:', text?.length)

  if (!text || typeof text !== 'string') {
    return jsonResponse({ error: 'JD text is required' }, 400)
  }

  const { parsed, usage, latencyMs } = await callChatCompletion({
    openaiKey: ctx.openaiKey,
    messages: [
      { role: 'system', content: buildJdParsePrompt() },
      { role: 'user', content: text },
    ],
    temperature: 0.2,
    maxTokens: 3000,
  })

  await logRun(ctx.supabase, {
    user_id: ctx.user.id as string,
    type: 'parse-jd',
    prompt_id: JD_PARSE_PROMPT_ID,
    model: 'gpt-4o',
    input: { text_length: text.length },
    output: parsed,
    latency_ms: latencyMs,
    tokens_in: usage?.prompt_tokens ?? null,
    tokens_out: usage?.completion_tokens ?? null,
  })

  console.log('[parse-jd] Success, requirements:', parsed.requirements?.length)

  return jsonResponse(parsed)
})
