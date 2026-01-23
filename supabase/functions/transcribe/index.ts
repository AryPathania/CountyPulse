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

// Supported audio formats for OpenAI Whisper
const SUPPORTED_FORMATS = ['mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'wav', 'webm']

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

    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse multipart form data
    const contentType = req.headers.get('content-type') || ''
    if (!contentType.includes('multipart/form-data')) {
      return new Response(
        JSON.stringify({ error: 'Content-Type must be multipart/form-data' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const formData = await req.formData()
    const audioFile = formData.get('audio')

    if (!audioFile || !(audioFile instanceof File)) {
      return new Response(
        JSON.stringify({ error: 'Audio file is required in the "audio" field' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate file size (max 25MB for Whisper API)
    const MAX_FILE_SIZE = 25 * 1024 * 1024
    if (audioFile.size > MAX_FILE_SIZE) {
      return new Response(
        JSON.stringify({ error: 'Audio file exceeds maximum size of 25MB' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Determine file extension from filename or content type
    let extension = 'webm'
    if (audioFile.name) {
      const nameParts = audioFile.name.split('.')
      if (nameParts.length > 1) {
        extension = nameParts[nameParts.length - 1].toLowerCase()
      }
    } else if (audioFile.type) {
      // Extract extension from MIME type (e.g., 'audio/webm' -> 'webm')
      const typeParts = audioFile.type.split('/')
      if (typeParts.length > 1) {
        extension = typeParts[1].split(';')[0].toLowerCase()
      }
    }

    // Validate format
    if (!SUPPORTED_FORMATS.includes(extension)) {
      return new Response(
        JSON.stringify({
          error: `Unsupported audio format: ${extension}. Supported formats: ${SUPPORTED_FORMATS.join(', ')}`
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const startTime = Date.now()

    // Prepare form data for OpenAI Whisper API
    const whisperFormData = new FormData()
    whisperFormData.append('file', audioFile, `audio.${extension}`)
    whisperFormData.append('model', 'whisper-1')

    // Call OpenAI Whisper API
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: whisperFormData,
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('OpenAI Whisper API error:', response.status, errorText)
      throw new Error(`OpenAI API error: ${response.status}`)
    }

    const data = await response.json()
    const latencyMs = Date.now() - startTime

    const transcribedText = data.text

    // Log the run for telemetry
    await supabase.from('runs').insert({
      user_id: user.id,
      type: 'transcribe',
      prompt_id: 'whisper-1',
      model: 'whisper-1',
      input: {
        audio_size_bytes: audioFile.size,
        audio_format: extension,
      },
      output: {
        text_length: transcribedText.length,
      },
      success: true,
      latency_ms: latencyMs,
      tokens_in: null,
      tokens_out: null,
    })

    return new Response(
      JSON.stringify({ text: transcribedText }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Transcribe function error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
