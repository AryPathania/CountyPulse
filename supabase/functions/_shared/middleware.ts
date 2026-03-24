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
}

export function withMiddleware(
  handler: (req: Request, ctx: HandlerContext) => Promise<Response>,
  options: MiddlewareOptions = {}
): void {
  const { requireOpenAI = true } = options

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

      const openaiKey = Deno.env.get('OPENAI_API_KEY') ?? ''
      if (requireOpenAI && !openaiKey) {
        return errorResponse('OpenAI API key not configured', 500)
      }

      const ctx: HandlerContext = {
        user: user as HandlerContext['user'],
        supabase,
        openaiKey,
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
