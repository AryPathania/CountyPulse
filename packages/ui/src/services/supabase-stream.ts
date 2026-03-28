const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL

/**
 * Low-level SSE stream reader for Supabase edge functions.
 *
 * Handles:
 * - Pre-stream JSON errors (e.g., auth failure, 500) via Content-Type check
 * - Safari < 16.4 missing response.body guard
 * - Clean stream close before 'done' event treated as error
 */
export async function streamFunctionCall(
  functionName: string,
  body: Record<string, unknown>,
  session: { access_token: string },
  callbacks: {
    onEvent: (event: { type: string; [key: string]: unknown }) => void
    onError: (error: Error) => void
  }
): Promise<void> {
  let response: Response
  try {
    response = await fetch(`${SUPABASE_URL}/functions/v1/${functionName}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
  } catch (err) {
    callbacks.onError(err instanceof Error ? err : new Error('Network request failed'))
    return
  }

  // Non-OK response — parse error body regardless of Content-Type
  if (!response.ok) {
    try {
      const errorData = await response.json()
      callbacks.onError(new Error(errorData.message ?? errorData.error ?? `HTTP ${response.status}`))
    } catch {
      callbacks.onError(new Error(`HTTP ${response.status}`))
    }
    return
  }

  // Pre-stream JSON error: backend returned application/json instead of text/event-stream
  const contentType = response.headers.get('Content-Type') ?? ''
  if (contentType.startsWith('application/json')) {
    try {
      const errorData = await response.json()
      callbacks.onError(new Error(errorData.message ?? errorData.error ?? 'Unexpected JSON response from stream endpoint'))
    } catch {
      callbacks.onError(new Error('Unexpected JSON response from stream endpoint'))
    }
    return
  }

  // Safari < 16.4 guard: response.body may be null
  if (!response.body) {
    callbacks.onError(new Error('Streaming not supported in this browser'))
    return
  }

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader()
  let buffer = ''
  let receivedDone = false

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += value
      const lines = buffer.split('\n')
      // Keep the last (potentially incomplete) line in the buffer
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data: ')) continue
        const jsonStr = trimmed.slice('data: '.length)
        if (!jsonStr) continue

        let event: { type: string; [key: string]: unknown }
        try {
          event = JSON.parse(jsonStr)
        } catch {
          // Malformed SSE line — skip
          continue
        }

        if (event.type === 'done') {
          receivedDone = true
        }
        callbacks.onEvent(event)
      }
    }
  } finally {
    reader.releaseLock()
  }

  if (!receivedDone) {
    callbacks.onError(new Error('Stream ended unexpectedly'))
  }
}
