import { withMiddleware, corsHeaders, jsonResponse, logRun } from '../_shared/middleware.ts'
import type { HandlerContext } from '../_shared/middleware.ts'

const VALID_VOICES = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'] as const
type Voice = (typeof VALID_VOICES)[number]

interface SpeakRequest {
  text: string
  voice?: Voice
}

withMiddleware(async (req: Request, ctx: HandlerContext) => {
  const body = await req.json() as SpeakRequest
  const { text, voice = 'nova' } = body

  if (!text || typeof text !== 'string') {
    return jsonResponse({ error: 'Text is required and must be a string' }, 400)
  }

  if (text.length === 0) {
    return jsonResponse({ error: 'Text cannot be empty' }, 400)
  }

  if (text.length > 4096) {
    return jsonResponse({ error: 'Text exceeds maximum length of 4096 characters' }, 400)
  }

  if (!VALID_VOICES.includes(voice as Voice)) {
    return jsonResponse({ error: `Invalid voice. Must be one of: ${VALID_VOICES.join(', ')}` }, 400)
  }

  const startTime = Date.now()

  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ctx.openaiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'tts-1',
      input: text,
      voice: voice,
      response_format: 'mp3',
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`OpenAI TTS API error: ${response.status} ${errorText}`)
  }

  const audioBuffer = await response.arrayBuffer()
  const latencyMs = Date.now() - startTime

  await logRun(ctx.supabase, {
    user_id: ctx.user.id as string,
    type: 'speak',
    prompt_id: 'tts-1',
    model: 'tts-1',
    input: { text: text.slice(0, 500), voice },
    output: { bytes: audioBuffer.byteLength },
    latency_ms: latencyMs,
    tokens_in: null,
    tokens_out: null,
  })

  return new Response(audioBuffer, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'audio/mpeg',
      'Content-Length': audioBuffer.byteLength.toString(),
    },
  })
})
