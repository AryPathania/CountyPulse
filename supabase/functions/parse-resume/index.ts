import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { extractBearerToken } from '../_shared/auth.ts'
import { buildResumeParsePrompt, DEFAULT_RESUME_PARSE_CONFIG, RESUME_PARSE_PROMPT_ID } from '../_shared/prompts/resume-parse.ts'

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ParseResumeRequest {
  text: string
  config?: { qualityBar?: 'strict' | 'moderate' | 'lenient' }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Auth
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const token = extractBearerToken(authHeader)
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { text, config: requestConfig } = await req.json() as ParseResumeRequest
    console.log('[parse-resume] Parsing resume text, length:', text?.length)

    if (!text || typeof text !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Resume text is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Build config and prompt
    const config = { ...DEFAULT_RESUME_PARSE_CONFIG, ...requestConfig }
    const systemPrompt = buildResumeParsePrompt(config)

    const startTime = Date.now()

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text },
        ],
        temperature: 0.3,
        max_tokens: 4000,
        response_format: { type: 'json_object' },
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[parse-resume] OpenAI API error:', response.status)
      throw new Error(`OpenAI API error: ${response.status} ${errorText}`)
    }

    const data = await response.json()
    const latencyMs = Date.now() - startTime
    const assistantMessage = data.choices[0].message.content
    const usage = data.usage

    // Log telemetry
    await supabase.from('runs').insert({
      user_id: user.id,
      type: 'parse-resume',
      prompt_id: RESUME_PARSE_PROMPT_ID,
      model: 'gpt-4o',
      input: { text_length: text.length, config },
      output: JSON.parse(assistantMessage),
      success: true,
      latency_ms: latencyMs,
      tokens_in: usage?.prompt_tokens ?? null,
      tokens_out: usage?.completion_tokens ?? null,
    })

    let parsedResponse
    try {
      parsedResponse = JSON.parse(assistantMessage)
    } catch {
      throw new Error('Failed to parse LLM response as JSON')
    }

    console.log('[parse-resume] Success, positions:', parsedResponse.positions?.length)

    return new Response(
      JSON.stringify(parsedResponse),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[parse-resume] Error:', error instanceof Error ? error.message : 'Unknown error')
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
