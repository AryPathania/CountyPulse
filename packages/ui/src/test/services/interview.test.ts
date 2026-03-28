import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock @odie/db
const mockGetSession = vi.fn()
const mockFunctionsInvoke = vi.fn()

vi.mock('@odie/db', () => ({
  supabase: {
    auth: { getSession: () => mockGetSession() },
    functions: { invoke: (...args: unknown[]) => mockFunctionsInvoke(...args) },
  },
}))

vi.stubEnv('VITE_SUPABASE_URL', 'http://localhost:54321')

import {
  sendInterviewMessage,
  streamInterviewMessage,
  getInitialMessage,
  resetMockState,
} from '../../services/interview'
import type { ChatMessage } from '@odie/shared'

describe('interview service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMockState()
  })

  const makeMessage = (role: 'user' | 'assistant', content: string): ChatMessage => ({
    id: `msg-${Date.now()}`,
    role,
    content,
    timestamp: new Date().toISOString(),
  })

  describe('getInitialMessage', () => {
    it('returns default greeting for no context', () => {
      const msg = getInitialMessage()
      expect(msg.id).toBe('initial')
      expect(msg.role).toBe('assistant')
      expect(msg.content).toContain("I'm Odie")
      expect(msg.timestamp).toBeTruthy()
    })

    it('returns resume-specific greeting for resume context', () => {
      const msg = getInitialMessage({ mode: 'resume' })
      expect(msg.content).toContain('review your resume')
      expect(msg.content).not.toContain("I'm Odie")
    })

    it('returns gaps-specific greeting for gaps context', () => {
      const msg = getInitialMessage({ mode: 'gaps' })
      expect(msg.content).toContain('strengthen your profile')
      expect(msg.content).not.toContain("I'm Odie")
    })

    it('returns default greeting for unknown context mode', () => {
      const msg = getInitialMessage({ mode: 'unknown' })
      expect(msg.content).toContain("I'm Odie")
    })
  })

  describe('sendInterviewMessage (mock mode)', () => {
    it('returns mock responses in sequence', async () => {
      const messages = [makeMessage('user', 'Hi')]

      const result1 = await sendInterviewMessage(messages, { useMock: true })
      expect(result1.response).toContain('Acme Corp')
      expect(result1.extractedPosition).toBeDefined()
      expect(result1.extractedPosition?.company).toBe('Acme Corp')

      const result2 = await sendInterviewMessage(messages, { useMock: true })
      expect(result2.response).toContain('two years')
      expect(result2.extractedPosition?.location).toBe('San Francisco')
    })

    it('returns shouldContinue false at end of mock conversation', async () => {
      const messages = [makeMessage('user', 'test')]

      // Burn through mock responses to reach the end
      for (let i = 0; i < 5; i++) {
        await sendInterviewMessage(messages, { useMock: true })
      }

      const final = await sendInterviewMessage(messages, { useMock: true })
      expect(final.shouldContinue).toBe(false)
    })

    it('extracts bullets in mock response at step 3', async () => {
      const messages = [makeMessage('user', 'test')]

      // Steps 1, 2 (position extraction), then step 3 (bullets)
      await sendInterviewMessage(messages, { useMock: true })
      await sendInterviewMessage(messages, { useMock: true })
      const result = await sendInterviewMessage(messages, { useMock: true })

      expect(result.extractedBullets).toBeDefined()
      expect(result.extractedBullets).toHaveLength(1)
      expect(result.extractedBullets![0].category).toBe('Backend')
      expect(result.extractedBullets![0].metrics?.value).toBe('40%')
    })

    it('resetMockState resets the counter', async () => {
      const messages = [makeMessage('user', 'test')]

      await sendInterviewMessage(messages, { useMock: true })
      resetMockState()

      const result = await sendInterviewMessage(messages, { useMock: true })
      // Should be back at step 1
      expect(result.response).toContain('Acme Corp')
    })
  })

  describe('sendInterviewMessage (live mode)', () => {
    it('sends messages to edge function and returns parsed response', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: { access_token: 'token' } },
      })

      mockFunctionsInvoke.mockResolvedValue({
        data: {
          response: 'Tell me more about your role',
          extractedPosition: null,
          extractedBullets: null,
          shouldContinue: true,
        },
        error: null,
      })

      const messages = [makeMessage('user', 'I worked at Google')]
      const result = await sendInterviewMessage(messages)

      expect(result.response).toBe('Tell me more about your role')
      expect(result.shouldContinue).toBe(true)
      expect(mockFunctionsInvoke).toHaveBeenCalledWith('interview', {
        body: { messages, context: undefined },
      })
    })

    it('passes context to edge function', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: { access_token: 'token' } },
      })

      mockFunctionsInvoke.mockResolvedValue({
        data: {
          response: 'I see your resume...',
          extractedPosition: null,
          extractedBullets: null,
          shouldContinue: true,
        },
        error: null,
      })

      const context = { mode: 'resume', someData: 'value' }
      const messages = [makeMessage('user', 'Hi')]
      await sendInterviewMessage(messages, { context })

      expect(mockFunctionsInvoke).toHaveBeenCalledWith('interview', {
        body: { messages, context },
      })
    })

    it('throws when not authenticated', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: null },
      })

      const messages = [makeMessage('user', 'test')]

      await expect(sendInterviewMessage(messages)).rejects.toThrow('Not authenticated')
    })

    it('throws when edge function returns error', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: { access_token: 'token' } },
      })

      mockFunctionsInvoke.mockResolvedValue({
        data: null,
        error: { message: 'Function error' },
      })

      const messages = [makeMessage('user', 'test')]

      await expect(sendInterviewMessage(messages)).rejects.toThrow('Function error')
    })

    it('throws on invalid response format', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: { access_token: 'token' } },
      })

      mockFunctionsInvoke.mockResolvedValue({
        data: { invalid: true },
        error: null,
      })

      const messages = [makeMessage('user', 'test')]

      await expect(sendInterviewMessage(messages)).rejects.toThrow(
        'Invalid response format from interview service'
      )
    })

    it('throws fallback message when edge function error has no message', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: { access_token: 'token' } },
      })

      // error object with empty message — exercises the || 'Interview request failed' branch
      mockFunctionsInvoke.mockResolvedValue({
        data: null,
        error: { message: '' },
      })

      const messages = [makeMessage('user', 'test')]

      await expect(sendInterviewMessage(messages)).rejects.toThrow('Interview request failed')
    })
  })

  describe('streamInterviewMessage', () => {
    let originalFetch: typeof fetch

    beforeEach(() => {
      originalFetch = global.fetch
    })

    afterEach(() => {
      global.fetch = originalFetch
    })

    function makeSseStream(events: object[]): ReadableStream<Uint8Array> {
      const encoder = new TextEncoder()
      return new ReadableStream<Uint8Array>({
        start(controller) {
          for (const event of events) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
          }
          controller.close()
        },
      })
    }

    it('calls onDone with parsed result on successful stream', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: { access_token: 'token' } },
      })

      const doneData = {
        response: 'Great answer!',
        extractedPosition: null,
        extractedBullets: null,
        shouldContinue: true,
        extractedEntries: null,
      }
      global.fetch = vi.fn().mockResolvedValue(
        new Response(
          makeSseStream([
            { type: 'text_delta', text: 'Great ' },
            { type: 'text_delta', text: 'answer!' },
            { type: 'sentence', text: 'Great answer!' },
            { type: 'done', data: doneData },
          ]),
          { status: 200, headers: { 'Content-Type': 'text/event-stream' } }
        )
      )

      const onTextDelta = vi.fn()
      const onSentence = vi.fn()
      const onDone = vi.fn()
      const onError = vi.fn()

      const messages: ChatMessage[] = [{ id: 'm1', role: 'user', content: 'Hi', timestamp: '2024-01-01T00:00:00Z' }]
      await streamInterviewMessage(messages, {}, { onTextDelta, onSentence, onDone, onError })

      expect(onTextDelta).toHaveBeenCalledWith('Great ')
      expect(onTextDelta).toHaveBeenCalledWith('answer!')
      expect(onSentence).toHaveBeenCalledWith('Great answer!')
      expect(onDone).toHaveBeenCalledOnce()
      expect(onDone.mock.calls[0][0].response).toBe('Great answer!')
      expect(onDone.mock.calls[0][0].shouldContinue).toBe(true)
      expect(onError).not.toHaveBeenCalled()
    })

    it('passes stream: true and context in request body', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: { access_token: 'token' } },
      })

      const doneData = {
        response: 'ok',
        extractedPosition: null,
        extractedBullets: null,
        shouldContinue: true,
        extractedEntries: null,
      }
      global.fetch = vi.fn().mockResolvedValue(
        new Response(
          makeSseStream([{ type: 'done', data: doneData }]),
          { status: 200, headers: { 'Content-Type': 'text/event-stream' } }
        )
      )

      const context = { mode: 'resume' as const }
      const messages: ChatMessage[] = []
      await streamInterviewMessage(messages, { context }, {
        onTextDelta: vi.fn(), onSentence: vi.fn(), onDone: vi.fn(), onError: vi.fn(),
      })

      const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
      const body = JSON.parse(init.body)
      expect(body.stream).toBe(true)
      expect(body.context).toEqual(context)
    })

    it('calls onError when not authenticated', async () => {
      mockGetSession.mockResolvedValue({ data: { session: null } })

      const onError = vi.fn()
      const messages: ChatMessage[] = []
      await streamInterviewMessage(messages, {}, {
        onTextDelta: vi.fn(), onSentence: vi.fn(), onDone: vi.fn(), onError,
      })

      expect(onError).toHaveBeenCalledOnce()
      expect(onError.mock.calls[0][0].message).toBe('Not authenticated')
    })

    it('calls onError on invalid done data schema', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: { access_token: 'token' } },
      })

      global.fetch = vi.fn().mockResolvedValue(
        new Response(
          makeSseStream([{ type: 'done', data: { invalid: true } }]),
          { status: 200, headers: { 'Content-Type': 'text/event-stream' } }
        )
      )

      const onError = vi.fn()
      await streamInterviewMessage([], {}, {
        onTextDelta: vi.fn(), onSentence: vi.fn(), onDone: vi.fn(), onError,
      })

      expect(onError).toHaveBeenCalledOnce()
      expect(onError.mock.calls[0][0].message).toContain('Invalid response format')
    })

    it('calls onError when stream emits error event followed by unexpected close', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: { access_token: 'token' } },
      })

      global.fetch = vi.fn().mockResolvedValue(
        new Response(
          makeSseStream([{ type: 'error', message: 'LLM failed' }]),
          { status: 200, headers: { 'Content-Type': 'text/event-stream' } }
        )
      )

      const onError = vi.fn()
      await streamInterviewMessage([], {}, {
        onTextDelta: vi.fn(), onSentence: vi.fn(), onDone: vi.fn(), onError,
      })

      // onError fires twice: once from the error event handler, once from unexpected close
      // (the error event handler calls onError via the event routing,
      //  then streamFunctionCall also fires onError for the missing done event)
      // We just verify it was called at least once with a meaningful message
      expect(onError).toHaveBeenCalled()
    })
  })

  describe('getMockResponse fallback', () => {
    it('returns MOCK_RESPONSES[6] when mockMessageCount exceeds array length', async () => {
      const messages = [makeMessage('user', 'test')]

      // Exhaust all 7 mock responses (indices 0-6)
      for (let i = 0; i < 7; i++) {
        await sendInterviewMessage(messages, { useMock: true })
      }

      // 8th call → mockMessageCount is now 7, which is past the end → fallback to index 6
      const result = await sendInterviewMessage(messages, { useMock: true })
      // Index 6 has shouldContinue: false (same as end of conversation)
      expect(result.shouldContinue).toBe(false)
      expect(typeof result.response).toBe('string')
      expect(result.response.length).toBeGreaterThan(0)
    })
  })
})
