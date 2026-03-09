import { withMiddleware, jsonResponse, callChatCompletion, logRun } from '../_shared/middleware.ts'
import type { HandlerContext } from '../_shared/middleware.ts'
import { buildContextWindow } from '../_shared/prompts/context.ts'
import { buildInterviewPrompt, DEFAULT_INTERVIEW_CONFIG, INTERVIEW_PROMPT_ID } from '../_shared/prompts/interview.ts'

interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

interface InterviewRequest {
  messages: ChatMessage[]
  userId: string
  context?: { mode: string; [key: string]: unknown }
}

withMiddleware(async (req: Request, ctx: HandlerContext) => {
  const { messages, context } = await req.json() as InterviewRequest

  const config = {
    ...DEFAULT_INTERVIEW_CONFIG,
    ...(context ? { context } : {}),
  }

  const systemPrompt = buildInterviewPrompt(config)

  console.log('[interview] Context mode:', context?.mode || 'blank')

  const windowedMessages = await buildContextWindow(
    messages.map((m: ChatMessage) => ({ role: m.role, content: m.content })),
    config.maxMessagesInContext,
    ctx.openaiKey,
  )

  const { parsed, usage, latencyMs } = await callChatCompletion({
    openaiKey: ctx.openaiKey,
    messages: [
      { role: 'system', content: systemPrompt },
      ...windowedMessages,
    ],
    temperature: config.temperature,
    maxTokens: config.maxTokens,
  })

  await logRun(ctx.supabase, {
    user_id: ctx.user.id as string,
    type: 'interview',
    prompt_id: INTERVIEW_PROMPT_ID,
    model: 'gpt-4o',
    input: { messages: messages.slice(-5) },
    output: parsed,
    latency_ms: latencyMs,
    tokens_in: usage?.prompt_tokens ?? null,
    tokens_out: usage?.completion_tokens ?? null,
  })

  return jsonResponse(parsed)
})
