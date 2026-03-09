import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { extractBearerToken } from '../_shared/auth.ts'
import { buildContextWindow } from '../_shared/prompts/context.ts'
import { buildInterviewPrompt, DEFAULT_INTERVIEW_CONFIG, INTERVIEW_PROMPT_ID } from '../_shared/prompts/interview.ts'

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Build the system prompt from config
const config = DEFAULT_INTERVIEW_CONFIG
const INTERVIEW_SYSTEM_PROMPT = buildInterviewPrompt(config)

interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

interface InterviewRequest {
  messages: ChatMessage[]
  userId: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify JWT and get user
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const token = extractBearerToken(authHeader)
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { messages } = await req.json() as InterviewRequest

    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Apply context window management for long conversations.
    // Keeps the first 2 messages + a summary of dropped middle + recent tail.
    const windowedMessages = await buildContextWindow(
      messages.map((m: ChatMessage) => ({ role: m.role, content: m.content })),
      config.maxMessagesInContext,
      OPENAI_API_KEY,
    )

    const openaiMessages = [
      { role: 'system', content: INTERVIEW_SYSTEM_PROMPT },
      ...windowedMessages,
    ]

    const startTime = Date.now()

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: openaiMessages,
        temperature: config.temperature,
        max_tokens: config.maxTokens,
        response_format: { type: 'json_object' },
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`OpenAI API error: ${response.status} ${errorText}`)
    }

    const data = await response.json()
    const latencyMs = Date.now() - startTime

    const assistantMessage = data.choices[0].message.content
    const usage = data.usage

    // Log the run for telemetry
    await supabase.from('runs').insert({
      user_id: user.id,
      type: 'interview',
      prompt_id: INTERVIEW_PROMPT_ID,
      model: 'gpt-4o',
      input: { messages: messages.slice(-5) }, // Log last 5 messages for context
      output: JSON.parse(assistantMessage),
      success: true,
      latency_ms: latencyMs,
      tokens_in: usage?.prompt_tokens ?? null,
      tokens_out: usage?.completion_tokens ?? null,
    })

    // Parse and validate the response
    let parsedResponse
    try {
      parsedResponse = JSON.parse(assistantMessage)
    } catch {
      throw new Error('Failed to parse LLM response as JSON')
    }

    return new Response(
      JSON.stringify(parsedResponse),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Interview function error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
