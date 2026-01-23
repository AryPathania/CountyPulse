import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { extractBearerToken } from '../_shared/auth.ts'

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const INTERVIEW_SYSTEM_PROMPT = `You are Odie, an AI career coach helping users build their professional profile for resume creation.

Your goal is to extract:
1. Work positions (company, title, dates, location)
2. 3-6 impactful STAR-format bullet points per position

Guidelines:
- Ask about one position at a time, starting with the most recent
- For each position, probe for specific achievements with concrete details: scale (users, transactions, data volume), tech stack, team size, timeline, business impact ($, %, time saved). Ask follow-up questions like "How many users?", "What technologies?", "Regional or global?" to transform vague statements into impressive STAR bullets.
- Convert stories into STAR format bullets (Situation, Task, Action, Result)
- Extract quantifiable metrics when possible (%, $, time saved, users, etc.)
- Categorize bullets (Leadership, Frontend, Backend, Data, Communication, etc.)
- Identify hard skills (Python, React, SQL, etc.) and soft skills (teamwork, communication, etc.)
- Dig for details until you have enough to write impressive STAR bullets, then ask if they want to add more about this position or move on. Respect their choice to move on.
- If the user mentioned multiple positions, internships, or education earlier, circle back to cover each one before ending.

Response format:
Always respond with valid JSON in this structure:
{
  "response": "Your conversational message to the user",
  "extractedPosition": { "company": "...", "title": "...", "startDate": "YYYY-MM", "endDate": "YYYY-MM or null", "location": "..." } | null,
  "extractedBullets": [{ "text": "STAR bullet", "category": "...", "hardSkills": [...], "softSkills": [...] }] | null,
  "shouldContinue": true/false
}

When to end (shouldContinue: false):
- Only after explicitly asking "Is there anything else you'd like to add, or are you ready to wrap up?"
- Only after the user confirms they're done
- Never end if the user mentioned experiences (positions, internships, education) that haven't been explored yet

When shouldContinue is false, summarize what was collected.
Never invent metrics - ask follow-up questions when details are missing.`

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

    // Build messages for OpenAI
    const openaiMessages = [
      { role: 'system', content: INTERVIEW_SYSTEM_PROMPT },
      ...messages.map((m: ChatMessage) => ({ role: m.role, content: m.content })),
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
        temperature: 0.7,
        max_tokens: 2000,
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
      prompt_id: 'interview_v1',
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
