import { withMiddleware, jsonResponse, logRun } from '../_shared/middleware.ts'
import type { HandlerContext } from '../_shared/middleware.ts'

const SUPPORTED_FORMATS = ['mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'wav', 'webm']

withMiddleware(async (req: Request, ctx: HandlerContext) => {
  const contentType = req.headers.get('content-type') || ''
  if (!contentType.includes('multipart/form-data')) {
    return jsonResponse({ error: 'Content-Type must be multipart/form-data' }, 400)
  }

  const formData = await req.formData()
  const audioFile = formData.get('audio')

  if (!audioFile || !(audioFile instanceof File)) {
    return jsonResponse({ error: 'Audio file is required in the "audio" field' }, 400)
  }

  const MAX_FILE_SIZE = 25 * 1024 * 1024
  if (audioFile.size > MAX_FILE_SIZE) {
    return jsonResponse({ error: 'Audio file exceeds maximum size of 25MB' }, 400)
  }

  let extension = 'webm'
  if (audioFile.name) {
    const nameParts = audioFile.name.split('.')
    if (nameParts.length > 1) {
      extension = nameParts[nameParts.length - 1].toLowerCase()
    }
  } else if (audioFile.type) {
    const typeParts = audioFile.type.split('/')
    if (typeParts.length > 1) {
      extension = typeParts[1].split(';')[0].toLowerCase()
    }
  }

  if (!SUPPORTED_FORMATS.includes(extension)) {
    return jsonResponse({
      error: `Unsupported audio format: ${extension}. Supported formats: ${SUPPORTED_FORMATS.join(', ')}`
    }, 400)
  }

  const startTime = Date.now()

  const whisperFormData = new FormData()
  whisperFormData.append('file', audioFile, `audio.${extension}`)
  whisperFormData.append('model', 'whisper-1')

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ctx.openaiKey}`,
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

  await logRun(ctx.supabase, {
    user_id: ctx.user.id as string,
    type: 'transcribe',
    prompt_id: 'whisper-1',
    model: 'whisper-1',
    input: { audio_size_bytes: audioFile.size, audio_format: extension },
    output: { text_length: transcribedText.length },
    latency_ms: latencyMs,
    tokens_in: null,
    tokens_out: null,
  })

  return jsonResponse({ text: transcribedText })
})
