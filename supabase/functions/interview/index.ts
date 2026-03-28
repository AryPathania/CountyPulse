import { withMiddleware, jsonResponse, callChatCompletion, streamChatCompletion, logRun } from '../_shared/middleware.ts'
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
  stream?: boolean
}

/**
 * Hardcoded JSON schema for OpenAI Structured Outputs.
 * Field order is intentional: `response` is first so its tokens stream
 * out before any other field, enabling early sentence extraction.
 * Must stay in sync with InterviewStepResponseSchema in @odie/shared.
 */
const INTERVIEW_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    response: {
      type: 'string',
      description: 'Conversational message to the user, must end with a question',
    },
    extractedPosition: {
      anyOf: [
        {
          type: 'object',
          properties: {
            company: { type: 'string' },
            title: { type: 'string' },
            location: { type: ['string', 'null'] },
            startDate: { type: ['string', 'null'] },
            endDate: { type: ['string', 'null'] },
          },
          required: ['company', 'title', 'location', 'startDate', 'endDate'],
          additionalProperties: false,
        },
        { type: 'null' },
      ],
    },
    extractedBullets: {
      anyOf: [
        {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              text: { type: 'string' },
              category: { type: ['string', 'null'] },
              hardSkills: { type: 'array', items: { type: 'string' } },
              softSkills: { type: 'array', items: { type: 'string' } },
              metrics: {
                anyOf: [
                  {
                    type: 'object',
                    properties: {
                      value: { type: ['string', 'null'] },
                      type: { type: ['string', 'null'] },
                    },
                    required: ['value', 'type'],
                    additionalProperties: false,
                  },
                  { type: 'null' },
                ],
              },
              assumptions: { type: ['string', 'null'] },
            },
            required: ['text', 'category', 'hardSkills', 'softSkills', 'metrics', 'assumptions'],
            additionalProperties: false,
          },
        },
        { type: 'null' },
      ],
    },
    extractedEntries: {
      anyOf: [
        {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              category: { type: 'string', enum: ['education', 'certification', 'award', 'project', 'volunteer'] },
              title: { type: 'string' },
              subtitle: { type: ['string', 'null'] },
              startDate: { type: ['string', 'null'] },
              endDate: { type: ['string', 'null'] },
              location: { type: ['string', 'null'] },
            },
            required: ['category', 'title', 'subtitle', 'startDate', 'endDate', 'location'],
            additionalProperties: false,
          },
        },
        { type: 'null' },
      ],
    },
    shouldContinue: {
      type: 'boolean',
    },
  },
  required: ['response', 'extractedPosition', 'extractedBullets', 'extractedEntries', 'shouldContinue'],
  additionalProperties: false,
}

/**
 * Detects a sentence boundary in accumulated text.
 * Returns true when the text ends with sentence-terminating punctuation
 * (.!?) optionally followed by whitespace, and the text is at least
 * MIN_SENTENCE_CHARS characters long (reduces false positives on
 * abbreviations like "Dr." or "U.S.").
 */
const MIN_SENTENCE_CHARS = 30

function isSentenceBoundary(text: string): boolean {
  if (text.length < MIN_SENTENCE_CHARS) return false
  return /[.!?](\s*)$/.test(text)
}

/**
 * Builds an SSE Response that streams the interview LLM output.
 *
 * Protocol:
 *   data: {"type":"text_delta","text":"<word or punctuation chunk>"}
 *   data: {"type":"sentence","text":"<complete sentence>"}
 *   data: {"type":"done","data":{<full parsed InterviewStepResponse>}}
 *   data: {"type":"error","message":"<msg>"}   ← only on post-stream failure
 */
function buildStreamingResponse(
  deltaStream: ReadableStream<string>,
  startTime: number,
  logRunArgs: Parameters<typeof logRun>[1],
  ctx: HandlerContext,
): Response {
  const encoder = new TextEncoder()

  function sseEvent(obj: Record<string, unknown>): Uint8Array {
    return encoder.encode(`data: ${JSON.stringify(obj)}\n\n`)
  }

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      // Accumulates the entire raw JSON from the model
      let fullBuffer = ''
      // Accumulates characters after `"response":"` opening quote is found
      let responseTextAccum = ''
      // Accumulates word-boundary batched text since the last emit
      let wordBatch = ''
      // Accumulates text for the current in-progress sentence
      let sentenceAccum = ''

      // State machine flags
      let inResponseValue = false
      let responseValueDone = false
      // Track backslash escapes inside the JSON string value
      let escapeNext = false

      try {
        const reader = deltaStream.getReader()

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          fullBuffer += value

          if (!inResponseValue && !responseValueDone) {
            // Look for the opening of the response field value.
            // The model streams structured output in schema-defined order, so
            // `"response":"` appears early.  We search the running buffer.
            const marker = '"response":"'
            const markerIdx = fullBuffer.indexOf(marker)
            if (markerIdx !== -1) {
              inResponseValue = true
              // Skip past the marker; everything from here belongs to the value
              // (we re-process the tail below inside the inResponseValue block)
              const tail = fullBuffer.slice(markerIdx + marker.length)
              fullBuffer = fullBuffer.slice(0, markerIdx + marker.length)

              // Process any already-buffered characters of the value
              for (const ch of tail) {
                if (responseValueDone) break

                if (escapeNext) {
                  // Emit the escaped char as-is
                  const escapedChar = ch === 'n' ? '\n' : ch === 't' ? '\t' : ch === 'r' ? '\r' : ch
                  responseTextAccum += escapedChar
                  wordBatch += escapedChar
                  sentenceAccum += escapedChar
                  escapeNext = false
                  continue
                }

                if (ch === '\\') {
                  escapeNext = true
                  continue
                }

                if (ch === '"') {
                  // Unescaped closing quote — response value is complete
                  inResponseValue = false
                  responseValueDone = true

                  // Flush any remaining word batch
                  if (wordBatch.trim()) {
                    controller.enqueue(sseEvent({ type: 'text_delta', text: wordBatch }))
                    sentenceAccum += wordBatch
                    wordBatch = ''
                  }
                  // Flush any remaining sentence
                  if (sentenceAccum.trim()) {
                    controller.enqueue(sseEvent({ type: 'sentence', text: sentenceAccum.trim() }))
                    sentenceAccum = ''
                  }
                  break
                }

                responseTextAccum += ch
                wordBatch += ch
                sentenceAccum += ch

                // Emit word batch on whitespace or sentence-ending punctuation
                const isWordBoundary = ch === ' ' || ch === '\n' || ch === '\t'
                const isPunct = ch === '.' || ch === '!' || ch === '?'

                if (isWordBoundary && wordBatch.trim()) {
                  controller.enqueue(sseEvent({ type: 'text_delta', text: wordBatch }))
                  wordBatch = ''
                } else if (isPunct) {
                  // Include the punctuation in the batch then emit
                  controller.enqueue(sseEvent({ type: 'text_delta', text: wordBatch }))
                  wordBatch = ''

                  // Check for sentence boundary
                  if (isSentenceBoundary(sentenceAccum)) {
                    controller.enqueue(sseEvent({ type: 'sentence', text: sentenceAccum.trim() }))
                    sentenceAccum = ''
                  }
                }
              }
            }
          } else if (inResponseValue) {
            // Process the freshly arrived delta character by character
            for (const ch of value) {
              if (responseValueDone) break

              if (escapeNext) {
                const escapedChar = ch === 'n' ? '\n' : ch === 't' ? '\t' : ch === 'r' ? '\r' : ch
                responseTextAccum += escapedChar
                wordBatch += escapedChar
                sentenceAccum += escapedChar
                escapeNext = false
                continue
              }

              if (ch === '\\') {
                escapeNext = true
                continue
              }

              if (ch === '"') {
                inResponseValue = false
                responseValueDone = true

                if (wordBatch.trim()) {
                  controller.enqueue(sseEvent({ type: 'text_delta', text: wordBatch }))
                  sentenceAccum += wordBatch
                  wordBatch = ''
                }
                if (sentenceAccum.trim()) {
                  controller.enqueue(sseEvent({ type: 'sentence', text: sentenceAccum.trim() }))
                  sentenceAccum = ''
                }
                break
              }

              responseTextAccum += ch
              wordBatch += ch
              sentenceAccum += ch

              const isWordBoundary = ch === ' ' || ch === '\n' || ch === '\t'
              const isPunct = ch === '.' || ch === '!' || ch === '?'

              if (isWordBoundary && wordBatch.trim()) {
                controller.enqueue(sseEvent({ type: 'text_delta', text: wordBatch }))
                wordBatch = ''
              } else if (isPunct) {
                controller.enqueue(sseEvent({ type: 'text_delta', text: wordBatch }))
                wordBatch = ''

                if (isSentenceBoundary(sentenceAccum)) {
                  controller.enqueue(sseEvent({ type: 'sentence', text: sentenceAccum.trim() }))
                  sentenceAccum = ''
                }
              }
            }
          }
          // If responseValueDone, we just accumulate fullBuffer for the final parse
        }

        // Parse the complete JSON and emit the done event
        let parsed: Record<string, unknown>
        try {
          parsed = JSON.parse(fullBuffer)
        } catch {
          controller.enqueue(sseEvent({ type: 'error', message: 'Failed to parse complete response JSON' }))
          controller.close()
          return
        }

        controller.enqueue(sseEvent({ type: 'done', data: parsed }))
        controller.close()

        // Log telemetry after streaming is complete
        const latencyMs = Date.now() - startTime
        const runEntry = { ...logRunArgs, latency_ms: latencyMs, output: parsed }
        if (ctx.waitUntil) {
          ctx.waitUntil(logRun(ctx.supabase, runEntry))
        } else {
          // Fire-and-forget fallback for local dev
          logRun(ctx.supabase, runEntry).catch(() => {})
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Stream error'
        try {
          controller.enqueue(sseEvent({ type: 'error', message }))
          controller.close()
        } catch {
          // Controller may already be closed; ignore
        }
      }
    },
  })

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    },
  })
}

withMiddleware(async (req: Request, ctx: HandlerContext) => {
  const { messages, context, stream: streamMode } = await req.json() as InterviewRequest

  const config = {
    ...DEFAULT_INTERVIEW_CONFIG,
    ...(context ? { context } : {}),
  }

  const systemPrompt = buildInterviewPrompt(config)

  console.log('[interview] Context mode:', context?.mode || 'blank', '| stream:', streamMode ?? false)

  const windowedMessages = await buildContextWindow(
    messages.map((m: ChatMessage) => ({ role: m.role, content: m.content })),
    config.maxMessagesInContext,
    ctx.openaiKey,
  )

  const allMessages = [
    { role: 'system', content: systemPrompt },
    ...windowedMessages,
  ]

  // Base telemetry fields that don't depend on the response
  const baseLogArgs = {
    user_id: ctx.user.id as string,
    type: 'interview',
    prompt_id: INTERVIEW_PROMPT_ID,
    model: 'gpt-4o',
    input: { messages: messages.slice(-5) },
    output: {} as Record<string, unknown>,
    latency_ms: 0,
    tokens_in: null as number | null,
    tokens_out: null as number | null,
  }

  if (streamMode === true) {
    const startTime = Date.now()

    const deltaStream = await streamChatCompletion({
      openaiKey: ctx.openaiKey,
      messages: allMessages,
      responseFormat: {
        type: 'json_schema',
        json_schema: {
          strict: true,
          schema: INTERVIEW_RESPONSE_SCHEMA,
        },
      },
      temperature: config.temperature,
      maxTokens: config.maxTokens,
    })

    return buildStreamingResponse(deltaStream, startTime, baseLogArgs, ctx)
  }

  // Non-streaming path — preserved exactly as before for backward compatibility
  const { parsed, usage, latencyMs } = await callChatCompletion({
    openaiKey: ctx.openaiKey,
    messages: allMessages,
    temperature: config.temperature,
    maxTokens: config.maxTokens,
  })

  await logRun(ctx.supabase, {
    ...baseLogArgs,
    output: parsed,
    latency_ms: latencyMs,
    tokens_in: usage?.prompt_tokens ?? null,
    tokens_out: usage?.completion_tokens ?? null,
  })

  return jsonResponse(parsed)
})
