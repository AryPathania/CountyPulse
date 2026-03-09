import { withMiddleware, jsonResponse, fetchOpenAI, logRun } from '../_shared/middleware.ts'
import type { HandlerContext } from '../_shared/middleware.ts'

interface EmbedRequest {
  texts: string[]
  type: 'jd' | 'bullet'
}

withMiddleware(async (req: Request, ctx: HandlerContext) => {
  const { texts, type } = await req.json() as EmbedRequest

  if (!Array.isArray(texts) || texts.length === 0) {
    return jsonResponse({ error: 'texts must be a non-empty array of strings' }, 400)
  }

  const { data, latencyMs } = await fetchOpenAI(
    'https://api.openai.com/v1/embeddings',
    ctx.openaiKey,
    { model: 'text-embedding-3-small', input: texts.map(t => t.slice(0, 8000)), dimensions: 1536 },
  )

  const embeddings: number[][] = data.data.map((d: { embedding: number[] }) => d.embedding)

  await logRun(ctx.supabase, {
    user_id: ctx.user.id as string,
    type: 'embed',
    prompt_id: 'text-embedding-3-small',
    model: 'text-embedding-3-small',
    input: { texts_count: texts.length, first_text: texts[0].slice(0, 500), type },
    output: { count: embeddings.length, dimensions: embeddings[0]?.length },
    latency_ms: latencyMs,
    tokens_in: data.usage?.total_tokens ?? null,
    tokens_out: null,
  })

  return jsonResponse({ embeddings })
})
