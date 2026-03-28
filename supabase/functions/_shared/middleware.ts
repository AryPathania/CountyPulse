import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { extractBearerToken } from './auth.ts'

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

export interface HandlerContext {
  user: { id: string; [key: string]: unknown }
  supabase: ReturnType<typeof createClient>
  openaiKey: string
  waitUntil?: (p: Promise<unknown>) => void
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

export function errorResponse(message: string, status: number): Response {
  return jsonResponse({ error: message }, status)
}

// deno-lint-ignore no-explicit-any
export interface FetchOpenAIResult { data: any; latencyMs: number }

export async function fetchOpenAI(
  url: string,
  openaiKey: string,
  body: Record<string, unknown>,
): Promise<FetchOpenAIResult> {
  const startTime = Date.now()
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`OpenAI API error: ${response.status} ${errorText}`)
  }

  return { data: await response.json(), latencyMs: Date.now() - startTime }
}

export interface ChatCompletionOptions {
  openaiKey: string
  model?: string
  messages: Array<{ role: string; content: string }>
  temperature?: number
  maxTokens?: number
  jsonMode?: boolean
}

export interface ChatCompletionResult {
  parsed: Record<string, unknown>
  usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null
  latencyMs: number
}

export async function callChatCompletion(options: ChatCompletionOptions): Promise<ChatCompletionResult> {
  const { openaiKey, model = 'gpt-4o', messages, temperature = 0.3, maxTokens = 4000, jsonMode = true } = options

  const { data, latencyMs } = await fetchOpenAI(
    'https://api.openai.com/v1/chat/completions',
    openaiKey,
    { model, messages, temperature, max_tokens: maxTokens, ...(jsonMode ? { response_format: { type: 'json_object' } } : {}) },
  )

  const assistantMessage = data.choices[0].message.content

  let parsed
  try {
    parsed = JSON.parse(assistantMessage)
  } catch {
    throw new Error('Failed to parse LLM response as JSON')
  }

  return { parsed, usage: data.usage ?? null, latencyMs }
}

export interface StreamChatCompletionOptions {
  openaiKey: string
  messages: Array<{ role: string; content: string }>
  responseFormat: { type: 'json_schema'; json_schema: { strict: boolean; schema: Record<string, unknown> } }
  temperature?: number
  maxTokens?: number
}

/**
 * Calls OpenAI chat completions with stream: true and the given structured output
 * response format. Returns a ReadableStream<string> that yields raw delta text
 * strings (choices[0].delta.content) as they arrive from the OpenAI SSE stream.
 */
export async function streamChatCompletion(options: StreamChatCompletionOptions): Promise<ReadableStream<string>> {
  const { openaiKey, messages, responseFormat, temperature = 0.3, maxTokens = 4000 } = options

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: true,
      response_format: responseFormat,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`OpenAI API error: ${response.status} ${errorText}`)
  }

  if (!response.body) {
    throw new Error('OpenAI response has no body')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()

  return new ReadableStream<string>({
    async pull(controller) {
      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          controller.close()
          return
        }

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data: ')) continue
          const payload = trimmed.slice(6)
          if (payload === '[DONE]') {
            controller.close()
            return
          }
          try {
            const parsed = JSON.parse(payload)
            const delta = parsed.choices?.[0]?.delta?.content ?? ''
            if (delta) {
              controller.enqueue(delta)
            }
          } catch {
            // Ignore malformed SSE lines
          }
        }
      }
    },
    cancel() {
      reader.cancel()
    },
  })
}

export interface ReasoningModelOptions {
  openaiKey: string
  model?: string
  messages: Array<{ role: string; content: string }>
  maxCompletionTokens?: number
  jsonMode?: boolean
}

export async function callReasoningModel(options: ReasoningModelOptions): Promise<ChatCompletionResult> {
  const { openaiKey, model = 'o4-mini', messages, maxCompletionTokens = 16000, jsonMode = true } = options

  // Reasoning models use 'developer' role instead of 'system', no temperature param
  const formattedMessages = messages.map(m => ({
    role: m.role === 'system' ? 'developer' : m.role,
    content: m.content,
  }))

  const { data, latencyMs } = await fetchOpenAI(
    'https://api.openai.com/v1/chat/completions',
    openaiKey,
    { model, messages: formattedMessages, max_completion_tokens: maxCompletionTokens, ...(jsonMode ? { response_format: { type: 'json_object' } } : {}) },
  )

  const assistantMessage = data.choices[0].message.content

  let parsed
  try {
    parsed = JSON.parse(assistantMessage)
  } catch {
    throw new Error('Failed to parse reasoning model response as JSON')
  }

  return { parsed, usage: data.usage ?? null, latencyMs }
}

export interface RunLogEntry {
  user_id: string
  type: string
  prompt_id: string
  model: string
  input: Record<string, unknown>
  output: Record<string, unknown>
  latency_ms: number
  tokens_in: number | null
  tokens_out: number | null
}

export async function logRun(
  supabase: ReturnType<typeof createClient>,
  entry: RunLogEntry
): Promise<void> {
  await supabase.from('runs').insert({
    ...entry,
    success: true,
  })
}

interface MiddlewareOptions {
  requireOpenAI?: boolean
  requireAccess?: boolean
}

export function withMiddleware(
  handler: (req: Request, ctx: HandlerContext) => Promise<Response>,
  options: MiddlewareOptions = {}
): void {
  const { requireOpenAI = true, requireAccess = true } = options

  serve(async (req) => {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders })
    }

    try {
      const authHeader = req.headers.get('Authorization')
      if (!authHeader) {
        return errorResponse('Missing authorization header', 401)
      }

      const supabaseUrl = Deno.env.get('SUPABASE_URL')!
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      const supabase = createClient(supabaseUrl, supabaseKey)
      const token = extractBearerToken(authHeader)
      const { data: { user }, error: authError } = await supabase.auth.getUser(token)

      if (authError || !user) {
        return errorResponse('Invalid token', 401)
      }

      // Beta access check — the real security boundary.
      // Frontend AccessGuard is UX-only; this prevents actual resource consumption.
      if (requireAccess) {
        if (!user.email) {
          return errorResponse('Access denied', 403)
        }

        try {
          const { data: accessRow } = await supabase
            .from('beta_allowlist')
            .select('email')
            .eq('email', user.email.toLowerCase())
            .maybeSingle()

          if (!accessRow) {
            return errorResponse('Access denied', 403)
          }
        } catch {
          // Fail closed — if the check errors, deny access.
          // Generic message to avoid leaking table names or query structure.
          return errorResponse('Access denied', 403)
        }
      }

      const openaiKey = Deno.env.get('OPENAI_API_KEY') ?? ''
      if (requireOpenAI && !openaiKey) {
        return errorResponse('OpenAI API key not configured', 500)
      }

      // Attach waitUntil if the Deno EdgeRuntime exposes it on the request.
      // Falls back to undefined in local dev where it may not be available.
      // deno-lint-ignore no-explicit-any
      const waitUntil = typeof (req as any).waitUntil === 'function'
        // deno-lint-ignore no-explicit-any
        ? (req as any).waitUntil.bind(req)
        : undefined

      const ctx: HandlerContext = {
        user: user as HandlerContext['user'],
        supabase,
        openaiKey,
        waitUntil,
      }

      return await handler(req, ctx)
    } catch (error) {
      console.error('Edge function error:', error instanceof Error ? error.message : 'Unknown error')
      return errorResponse(
        error instanceof Error ? error.message : 'Unknown error',
        500
      )
    }
  })
}
