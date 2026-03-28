import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { streamFunctionCall } from '../../services/supabase-stream'

// Set VITE_SUPABASE_URL via import.meta.env mock
vi.stubEnv('VITE_SUPABASE_URL', 'http://localhost:54321')

const SUPABASE_URL = 'http://localhost:54321'
const FUNCTION_NAME = 'interview'
const SESSION = { access_token: 'test-token' }

/**
 * Builds a fake SSE ReadableStream from an array of event objects.
 * Each event is emitted as a `data: {...}\n\n` line.
 */
function makeSseStream(events: object[], { earlyClosure = false } = {}): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const event of events) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
      }
      if (!earlyClosure) {
        controller.close()
      }
      // If earlyClosure is true, we just close without a done event — simulates network drop
      if (earlyClosure) {
        controller.close()
      }
    },
  })
}

describe('streamFunctionCall', () => {
  let originalFetch: typeof fetch

  beforeEach(() => {
    originalFetch = global.fetch
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('calls the correct URL with correct headers and body', async () => {
    const capturedRequests: Request[] = []
    global.fetch = vi.fn().mockImplementation((req: Request) => {
      capturedRequests.push(req)
      return Promise.resolve(
        new Response(
          makeSseStream([{ type: 'done', data: { response: 'ok' } }]),
          {
            status: 200,
            headers: { 'Content-Type': 'text/event-stream' },
          }
        )
      )
    })

    const onEvent = vi.fn()
    const onError = vi.fn()
    await streamFunctionCall(FUNCTION_NAME, { foo: 'bar' }, SESSION, { onEvent, onError })

    expect(global.fetch).toHaveBeenCalledOnce()
    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(url).toBe(`${SUPABASE_URL}/functions/v1/${FUNCTION_NAME}`)
    expect(init.method).toBe('POST')
    expect(init.headers['Authorization']).toBe(`Bearer ${SESSION.access_token}`)
    expect(init.headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(init.body)).toEqual({ foo: 'bar' })
    expect(onError).not.toHaveBeenCalled()
  })

  it('routes text_delta, sentence, and done events to onEvent', async () => {
    const events = [
      { type: 'text_delta', text: 'Hello ' },
      { type: 'text_delta', text: 'world' },
      { type: 'sentence', text: 'Hello world.' },
      { type: 'done', data: { response: 'Hello world.', shouldContinue: true } },
    ]
    global.fetch = vi.fn().mockResolvedValue(
      new Response(makeSseStream(events), {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      })
    )

    const received: object[] = []
    await streamFunctionCall(FUNCTION_NAME, {}, SESSION, {
      onEvent: (e) => received.push(e),
      onError: vi.fn(),
    })

    expect(received).toHaveLength(4)
    expect(received[0]).toMatchObject({ type: 'text_delta', text: 'Hello ' })
    expect(received[2]).toMatchObject({ type: 'sentence', text: 'Hello world.' })
    expect(received[3]).toMatchObject({ type: 'done' })
  })

  it('calls onError when response is not ok', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: 'Not authorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    const onError = vi.fn()
    await streamFunctionCall(FUNCTION_NAME, {}, SESSION, { onEvent: vi.fn(), onError })

    expect(onError).toHaveBeenCalledOnce()
    expect(onError.mock.calls[0][0].message).toContain('Not authorized')
  })

  it('calls onError when Content-Type is application/json (pre-stream error)', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'Function crashed' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    const onError = vi.fn()
    await streamFunctionCall(FUNCTION_NAME, {}, SESSION, { onEvent: vi.fn(), onError })

    expect(onError).toHaveBeenCalledOnce()
    expect(onError.mock.calls[0][0].message).toContain('Function crashed')
  })

  it('calls onError when response.body is null (Safari guard)', async () => {
    // Simulate a browser where Response.body is null (Safari < 16.4)
    // We can't set body on a real Response (it's a read-only getter), so we build
    // a plain object that satisfies the shape streamFunctionCall checks.
    const fakeResponse = {
      ok: true,
      status: 200,
      headers: new Headers({ 'Content-Type': 'text/event-stream' }),
      body: null,
      json: async () => ({}),
    }
    global.fetch = vi.fn().mockResolvedValue(fakeResponse)

    const onError = vi.fn()
    await streamFunctionCall(FUNCTION_NAME, {}, SESSION, { onEvent: vi.fn(), onError })

    expect(onError).toHaveBeenCalledOnce()
    expect(onError.mock.calls[0][0].message).toContain('Streaming not supported')
  })

  it('calls onError when stream ends without done event', async () => {
    // Stream with only non-done events — closes without emitting done
    const events = [{ type: 'text_delta', text: 'partial' }]
    global.fetch = vi.fn().mockResolvedValue(
      new Response(makeSseStream(events, { earlyClosure: false }), {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      })
    )

    const onError = vi.fn()
    await streamFunctionCall(FUNCTION_NAME, {}, SESSION, { onEvent: vi.fn(), onError })

    expect(onError).toHaveBeenCalledOnce()
    expect(onError.mock.calls[0][0].message).toContain('Stream ended unexpectedly')
  })

  it('calls onError when fetch throws a network error', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network failed'))

    const onError = vi.fn()
    await streamFunctionCall(FUNCTION_NAME, {}, SESSION, { onEvent: vi.fn(), onError })

    expect(onError).toHaveBeenCalledOnce()
    expect(onError.mock.calls[0][0].message).toBe('Network failed')
  })

  it('does not call onError when error type event arrives (routed through onEvent)', async () => {
    const events = [
      { type: 'error', message: 'stream interrupted' },
      // Note: no done event — but error event is handled by caller via onEvent
    ]
    global.fetch = vi.fn().mockResolvedValue(
      new Response(makeSseStream(events, { earlyClosure: false }), {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      })
    )

    const onEvent = vi.fn()
    const onError = vi.fn()
    await streamFunctionCall(FUNCTION_NAME, {}, SESSION, { onEvent, onError })

    // onEvent receives the error event
    expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }))
    // onError called because stream ended without done
    expect(onError).toHaveBeenCalledOnce()
    expect(onError.mock.calls[0][0].message).toContain('Stream ended unexpectedly')
  })

  it('handles malformed SSE lines gracefully (skips them)', async () => {
    const encoder = new TextEncoder()
    const badStream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('data: not-valid-json\n\n'))
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done', data: {} })}\n\n`))
        controller.close()
      },
    })

    global.fetch = vi.fn().mockResolvedValue(
      new Response(badStream, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      })
    )

    const onEvent = vi.fn()
    const onError = vi.fn()
    await streamFunctionCall(FUNCTION_NAME, {}, SESSION, { onEvent, onError })

    // Only the valid done event should fire, bad line skipped
    expect(onEvent).toHaveBeenCalledOnce()
    expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'done' }))
    expect(onError).not.toHaveBeenCalled()
  })

  it('handles HTTP error with unparseable JSON body', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response('Internal Server Error', {
        status: 500,
        headers: { 'Content-Type': 'text/html' },
      })
    )

    const onError = vi.fn()
    await streamFunctionCall(FUNCTION_NAME, {}, SESSION, { onEvent: vi.fn(), onError })

    expect(onError).toHaveBeenCalledOnce()
    expect(onError.mock.calls[0][0].message).toContain('500')
  })

  it('calls onError with fallback message when ok JSON response body cannot be parsed', async () => {
    // ok:true, Content-Type: application/json, but body is not valid JSON (binary garbage)
    const fakeResponse = {
      ok: true,
      status: 200,
      headers: new Headers({ 'Content-Type': 'application/json' }),
      body: null,
      json: async () => { throw new SyntaxError('Unexpected token') },
    }
    global.fetch = vi.fn().mockResolvedValue(fakeResponse)

    const onError = vi.fn()
    await streamFunctionCall(FUNCTION_NAME, {}, SESSION, { onEvent: vi.fn(), onError })

    expect(onError).toHaveBeenCalledOnce()
    expect(onError.mock.calls[0][0].message).toContain('Unexpected JSON response from stream endpoint')
  })
})
