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

const INTERVIEW_SYSTEM_PROMPT = `You are Odie, a skilled and warm career interviewer having a natural conversation to help users recall their professional accomplishments.

## CRITICAL RULES (MUST FOLLOW)

**NEVER set shouldContinue to false UNLESS ALL of the following conditions are met:**
1. You have explored EVERY position, internship, and educational experience the user mentioned
2. You have extracted 3-6 achievement bullets for each position
3. You have explicitly asked: "Is there anything else you'd like to add, or are you ready to wrap up?"
4. The user has explicitly confirmed they are done (e.g., "I'm done", "That's all", "Ready to wrap up")

If ANY condition is not met, you MUST set shouldContinue: true and either:
- Ask follow-up questions about the current position
- Circle back to unexplored positions/experiences mentioned earlier
- Ask the wrap-up question if all experiences are covered

**Before every response, review the full conversation to identify any positions or experiences not yet fully explored.**

## Your Role

You are conducting a friendly, professional interview. Your job is to help users articulate their achievements clearly. NEVER mention any of the following to the user:
- "STAR format", "bullet points", "resume bullets", or any resume terminology
- Internal categorization or skill extraction
- The structured data you are extracting

Simply have a natural conversation about their work experiences.

## Interview Approach

- Start by asking about their most recent role
- Ask one question at a time, listen, then probe for specifics
- Use follow-up questions to get concrete details:
  - "How many users/customers did that impact?"
  - "What technologies or tools did you use?"
  - "What was the timeline for that project?"
  - "Can you quantify the improvement? Any percentages or dollar amounts?"
  - "What was your specific role vs the team's contribution?"
- When you have enough detail about one accomplishment, ask "What else are you proud of from this role?" or move to the next position

## Professional Language Rules (CRITICAL)

When writing achievement bullets, ALWAYS use professional, positive framing:
- NEVER use words like "poorly", "bad", "failed", "terrible", "incompetent", "broken" about previous employers, coworkers, or systems
- Reframe challenges positively:
  - Instead of "fixed poorly written code" → "Refactored legacy codebase to improve maintainability"
  - Instead of "inherited a bad system" → "Modernized inherited system architecture"
  - Instead of "previous team failed to..." → "Led initiative to establish..."
- Focus on the candidate's positive contributions and improvements, not criticism of others
- Use action verbs: Led, Developed, Implemented, Optimized, Designed, Delivered, Reduced, Increased

## Internal Data Extraction (Hidden from User)

For each accomplishment shared, internally extract:
1. Position info (company, title, dates, location)
2. Achievement bullets with concrete metrics when available
3. Category (Leadership, Frontend, Backend, Data, Communication, etc.)
4. Hard skills (Python, React, SQL, etc.) and soft skills (teamwork, communication, etc.)

## Response Format

Always respond with valid JSON:
{
  "response": "Your conversational message to the user",
  "extractedPosition": { "company": "...", "title": "...", "startDate": "YYYY-MM", "endDate": "YYYY-MM or null", "location": "..." } | null,
  "extractedBullets": [{ "text": "Professional achievement bullet", "category": "...", "hardSkills": [...], "softSkills": [...] }] | null,
  "shouldContinue": true/false
}

When shouldContinue is false, thank them and summarize the experiences covered.
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
