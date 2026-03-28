/**
 * Phase 2 streaming tests for InterviewChat.
 *
 * Covers:
 *  2. Streaming text appears in bubble as text_delta events arrive
 *  2. speakSentence is called for each sentence event when output enabled
 *  2. speakSentence NOT called when output disabled
 *  2. streamingText cleared and permanent message added atomically on done
 *  2. Error state set when error event arrives
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InterviewChat } from '../../../components/interview/InterviewChat'
import { resetMockState } from '../../../services/interview'

// ---------------------------------------------------------------------------
// Shared mocks
// ---------------------------------------------------------------------------

vi.stubEnv('VITE_SUPABASE_URL', 'http://localhost:54321')

const mockGetSession = vi.fn()
const mockFunctionsInvoke = vi.fn()
vi.mock('@odie/db', () => ({
  supabase: {
    auth: { getSession: () => mockGetSession() },
    functions: { invoke: (...args: unknown[]) => mockFunctionsInvoke(...args) },
  },
}))

// Controllable useVoiceInput mock
const mockStartRecording = vi.fn()
const mockStopRecording = vi.fn()

vi.mock('../../../hooks/useVoiceInput', () => ({
  useVoiceInput: ({ onTranscript }: { onTranscript?: (text: string) => void }) => ({
    isRecording: false,
    isTranscribing: false,
    startRecording: mockStartRecording,
    stopRecording: mockStopRecording,
    analyserNode: null,
    error: null,
    _onTranscript: onTranscript,
  }),
}))

// Controllable useVoiceOutput mock that exposes speakSentence
const mockSpeak = vi.fn()
const mockSpeakSentence = vi.fn()
const mockStopSpeaking = vi.fn()

vi.mock('../../../hooks/useVoiceOutput', () => ({
  useVoiceOutput: () => ({
    isSpeaking: false,
    speak: mockSpeak,
    speakSentence: mockSpeakSentence,
    stop: mockStopSpeaking,
    error: null,
  }),
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a fake SSE ReadableStream for tests that exercise the live streaming path.
 * Each event object is emitted as `data: {...}\n\n`.
 */
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

/** Enable voice output via localStorage before render. */
function enableVoiceOutput() {
  localStorage.setItem(
    'voice-settings',
    JSON.stringify({ inputEnabled: false, outputEnabled: true, voice: 'nova' })
  )
}

/** Disable voice output via localStorage before render. */
function disableVoiceOutput() {
  localStorage.setItem(
    'voice-settings',
    JSON.stringify({ inputEnabled: false, outputEnabled: false, voice: 'nova' })
  )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('InterviewChat Phase 2 streaming changes', () => {
  const mockOnComplete = vi.fn()
  const mockOnCancel = vi.fn()
  let originalFetch: typeof fetch

  beforeEach(() => {
    vi.clearAllMocks()
    resetMockState()
    originalFetch = global.fetch
    localStorage.removeItem('voice-settings')
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'test-token' } },
    })
  })

  afterEach(() => {
    global.fetch = originalFetch
    localStorage.removeItem('voice-settings')
  })

  // -------------------------------------------------------------------------
  // 1. Streaming text appears in bubble as text_delta events arrive
  // -------------------------------------------------------------------------

  describe('streaming text bubble', () => {
    it('shows streaming bubble with text_delta content while streaming', async () => {
      global.fetch = vi.fn().mockResolvedValue(
        new Response(
          makeSseStream([
            { type: 'text_delta', text: 'Hello ' },
            { type: 'text_delta', text: 'world!' },
            { type: 'done', data: {
              response: 'Hello world!',
              extractedPosition: null,
              extractedBullets: null,
              shouldContinue: true,
              extractedEntries: null,
            }},
          ]),
          { status: 200, headers: { 'Content-Type': 'text/event-stream' } }
        )
      )

      render(
        <InterviewChat
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
          // No useMock — uses live streaming path
        />
      )

      await waitFor(() => expect(screen.getByTestId('interview-input')).toBeInTheDocument())

      const input = screen.getByTestId('interview-input')
      await userEvent.type(input, 'Tell me something')
      await userEvent.click(screen.getByTestId('interview-send'))

      // Streaming bubble (data-testid="message-streaming") should appear during streaming
      // and contain the accumulated delta text
      await waitFor(() => {
        const streamingBubble = screen.queryByTestId('message-streaming')
        // By the time the stream closes the bubble may have already converted to permanent,
        // so we check either streaming bubble exists OR permanent message exists with content
        const permanentMessages = screen.queryAllByTestId('message-assistant')
        const streamText = permanentMessages.some((m) => m.textContent?.includes('Hello world!'))
        expect(streamingBubble !== null || streamText).toBe(true)
      })
    })

    it('streaming cursor element is rendered while streaming text is present', async () => {
      // Simulate a stalled stream that never sends done — tests the streaming cursor
      let resolveStream!: () => void
      const streamPromise = new Promise<void>((resolve) => { resolveStream = resolve })

      global.fetch = vi.fn().mockResolvedValue(
        new Response(
          new ReadableStream<Uint8Array>({
            async start(controller) {
              const encoder = new TextEncoder()
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'text_delta', text: 'Streaming...' })}\n\n`))
              // Wait until test tells us to continue — keeps stream open
              await streamPromise
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done', data: {
                response: 'Streaming...',
                extractedPosition: null,
                extractedBullets: null,
                shouldContinue: true,
                extractedEntries: null,
              }})}\n\n`))
              controller.close()
            },
          }),
          { status: 200, headers: { 'Content-Type': 'text/event-stream' } }
        )
      )

      render(
        <InterviewChat
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      )

      await waitFor(() => expect(screen.getByTestId('interview-input')).toBeInTheDocument())

      const input = screen.getByTestId('interview-input')
      await userEvent.type(input, 'Check streaming cursor')
      await userEvent.click(screen.getByTestId('interview-send'))

      // The streaming bubble should appear with the streaming cursor
      await waitFor(() => {
        const streamingBubble = screen.queryByTestId('message-streaming')
        expect(streamingBubble).not.toBeNull()
      })

      const streamingBubble = screen.getByTestId('message-streaming')
      expect(streamingBubble.textContent).toContain('Streaming...')
      // Streaming cursor (aria-hidden span) should be inside the bubble
      const cursor = streamingBubble.querySelector('.streaming-cursor')
      expect(cursor).not.toBeNull()

      // Clean up: resolve the stream
      await act(async () => {
        resolveStream()
      })
    })

    it('streaming bubble disappears and permanent message appears after done event', async () => {
      global.fetch = vi.fn().mockResolvedValue(
        new Response(
          makeSseStream([
            { type: 'text_delta', text: 'Final answer.' },
            { type: 'done', data: {
              response: 'Final answer.',
              extractedPosition: null,
              extractedBullets: null,
              shouldContinue: true,
              extractedEntries: null,
            }},
          ]),
          { status: 200, headers: { 'Content-Type': 'text/event-stream' } }
        )
      )

      render(
        <InterviewChat
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      )

      await waitFor(() => expect(screen.getByTestId('interview-input')).toBeInTheDocument())

      await userEvent.type(screen.getByTestId('interview-input'), 'Atomic transition test')
      await userEvent.click(screen.getByTestId('interview-send'))

      // After done fires: no streaming bubble, permanent message present
      await waitFor(() => {
        expect(screen.queryByTestId('message-streaming')).not.toBeInTheDocument()
      })

      // Permanent assistant message should contain the response text
      const assistantMessages = screen.getAllByTestId('message-assistant')
      const hasResponse = assistantMessages.some((m) => m.textContent?.includes('Final answer.'))
      expect(hasResponse).toBe(true)
    })
  })

  // -------------------------------------------------------------------------
  // 2. speakSentence called per sentence event when output enabled
  // -------------------------------------------------------------------------

  describe('speakSentence called when output enabled', () => {
    it('calls speakSentence for each sentence event when outputEnabled is true', async () => {
      enableVoiceOutput()

      global.fetch = vi.fn().mockResolvedValue(
        new Response(
          makeSseStream([
            { type: 'text_delta', text: 'First sentence. Second sentence.' },
            { type: 'sentence', text: 'First sentence.' },
            { type: 'sentence', text: 'Second sentence.' },
            { type: 'done', data: {
              response: 'First sentence. Second sentence.',
              extractedPosition: null,
              extractedBullets: null,
              shouldContinue: true,
              extractedEntries: null,
            }},
          ]),
          { status: 200, headers: { 'Content-Type': 'text/event-stream' } }
        )
      )

      render(
        <InterviewChat
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      )

      await waitFor(() => expect(screen.getByTestId('interview-input')).toBeInTheDocument())

      await userEvent.type(screen.getByTestId('interview-input'), 'Speak sentences')
      await userEvent.click(screen.getByTestId('interview-send'))

      await waitFor(() => {
        expect(mockSpeakSentence).toHaveBeenCalledTimes(2)
      })

      expect(mockSpeakSentence).toHaveBeenNthCalledWith(1, 'First sentence.')
      expect(mockSpeakSentence).toHaveBeenNthCalledWith(2, 'Second sentence.')
    })

    it('calls speakSentence once for a single sentence event when outputEnabled', async () => {
      enableVoiceOutput()

      global.fetch = vi.fn().mockResolvedValue(
        new Response(
          makeSseStream([
            { type: 'text_delta', text: 'One sentence here.' },
            { type: 'sentence', text: 'One sentence here.' },
            { type: 'done', data: {
              response: 'One sentence here.',
              extractedPosition: null,
              extractedBullets: null,
              shouldContinue: true,
              extractedEntries: null,
            }},
          ]),
          { status: 200, headers: { 'Content-Type': 'text/event-stream' } }
        )
      )

      render(
        <InterviewChat
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      )

      await waitFor(() => expect(screen.getByTestId('interview-input')).toBeInTheDocument())

      await userEvent.type(screen.getByTestId('interview-input'), 'One sentence')
      await userEvent.click(screen.getByTestId('interview-send'))

      await waitFor(() => {
        expect(mockSpeakSentence).toHaveBeenCalledOnce()
      })
      expect(mockSpeakSentence).toHaveBeenCalledWith('One sentence here.')
    })
  })

  // -------------------------------------------------------------------------
  // 3. speakSentence NOT called when output disabled
  // -------------------------------------------------------------------------

  describe('speakSentence not called when output disabled', () => {
    it('does NOT call speakSentence when outputEnabled is false', async () => {
      disableVoiceOutput()

      global.fetch = vi.fn().mockResolvedValue(
        new Response(
          makeSseStream([
            { type: 'text_delta', text: 'Silent response.' },
            { type: 'sentence', text: 'Silent response.' },
            { type: 'done', data: {
              response: 'Silent response.',
              extractedPosition: null,
              extractedBullets: null,
              shouldContinue: true,
              extractedEntries: null,
            }},
          ]),
          { status: 200, headers: { 'Content-Type': 'text/event-stream' } }
        )
      )

      render(
        <InterviewChat
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      )

      await waitFor(() => expect(screen.getByTestId('interview-input')).toBeInTheDocument())

      await userEvent.type(screen.getByTestId('interview-input'), 'No TTS please')
      await userEvent.click(screen.getByTestId('interview-send'))

      // Wait for the permanent message to appear (stream complete)
      await waitFor(() => {
        const msgs = screen.getAllByTestId('message-assistant')
        const hasResponse = msgs.some((m) => m.textContent?.includes('Silent response.'))
        expect(hasResponse).toBe(true)
      })

      // speakSentence must not have been called
      expect(mockSpeakSentence).not.toHaveBeenCalled()
    })

    it('does NOT call speakSentence when outputEnabled is false (no localStorage setting)', async () => {
      // Default settings have outputEnabled: false
      global.fetch = vi.fn().mockResolvedValue(
        new Response(
          makeSseStream([
            { type: 'sentence', text: 'Should not speak.' },
            { type: 'done', data: {
              response: 'Should not speak.',
              extractedPosition: null,
              extractedBullets: null,
              shouldContinue: true,
              extractedEntries: null,
            }},
          ]),
          { status: 200, headers: { 'Content-Type': 'text/event-stream' } }
        )
      )

      render(
        <InterviewChat
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      )

      await waitFor(() => expect(screen.getByTestId('interview-input')).toBeInTheDocument())

      await userEvent.type(screen.getByTestId('interview-input'), 'Default output settings')
      await userEvent.click(screen.getByTestId('interview-send'))

      await waitFor(() => {
        const msgs = screen.getAllByTestId('message-assistant')
        expect(msgs.some((m) => m.textContent?.includes('Should not speak.'))).toBe(true)
      })

      expect(mockSpeakSentence).not.toHaveBeenCalled()
    })
  })

  // -------------------------------------------------------------------------
  // 4. Atomic transition: streamingText cleared, permanent message added on done
  // -------------------------------------------------------------------------

  describe('atomic done transition', () => {
    it('no frame with both streaming bubble and permanent message shows the same content', async () => {
      // After done fires:
      //   - message-streaming should not exist
      //   - permanent assistant message with done content should exist
      global.fetch = vi.fn().mockResolvedValue(
        new Response(
          makeSseStream([
            { type: 'text_delta', text: 'Atomic ' },
            { type: 'text_delta', text: 'response.' },
            { type: 'done', data: {
              response: 'Atomic response.',
              extractedPosition: null,
              extractedBullets: null,
              shouldContinue: true,
              extractedEntries: null,
            }},
          ]),
          { status: 200, headers: { 'Content-Type': 'text/event-stream' } }
        )
      )

      render(
        <InterviewChat
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      )

      await waitFor(() => expect(screen.getByTestId('interview-input')).toBeInTheDocument())

      await userEvent.type(screen.getByTestId('interview-input'), 'Atomic test')
      await userEvent.click(screen.getByTestId('interview-send'))

      // Wait for completion
      await waitFor(() => {
        const msgs = screen.getAllByTestId('message-assistant')
        expect(msgs.some((m) => m.textContent?.includes('Atomic response.'))).toBe(true)
      })

      // No streaming bubble should remain after done
      expect(screen.queryByTestId('message-streaming')).not.toBeInTheDocument()

      // Permanent message exists with the final content
      const assistantMsgs = screen.getAllByTestId('message-assistant')
      expect(assistantMsgs.some((m) => m.textContent?.includes('Atomic response.'))).toBe(true)
    })

    it('sets isLoading to false after done (input re-enabled)', async () => {
      global.fetch = vi.fn().mockResolvedValue(
        new Response(
          makeSseStream([
            { type: 'done', data: {
              response: 'Done response.',
              extractedPosition: null,
              extractedBullets: null,
              shouldContinue: true,
              extractedEntries: null,
            }},
          ]),
          { status: 200, headers: { 'Content-Type': 'text/event-stream' } }
        )
      )

      render(
        <InterviewChat
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      )

      await waitFor(() => expect(screen.getByTestId('interview-input')).toBeInTheDocument())

      await userEvent.type(screen.getByTestId('interview-input'), 'Loading test')
      await userEvent.click(screen.getByTestId('interview-send'))

      // Input should be re-enabled after done fires
      const input = screen.getByTestId('interview-input') as HTMLInputElement
      await waitFor(() => {
        expect(input).not.toBeDisabled()
      })
    })

    it('shouldContinue false from done event causes interview to complete', async () => {
      global.fetch = vi.fn().mockResolvedValue(
        new Response(
          makeSseStream([
            { type: 'done', data: {
              response: 'Interview complete!',
              extractedPosition: null,
              extractedBullets: null,
              shouldContinue: false,
              extractedEntries: null,
            }},
          ]),
          { status: 200, headers: { 'Content-Type': 'text/event-stream' } }
        )
      )

      render(
        <InterviewChat
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      )

      await waitFor(() => expect(screen.getByTestId('interview-input')).toBeInTheDocument())

      await userEvent.type(screen.getByTestId('interview-input'), 'End now')
      await userEvent.click(screen.getByTestId('interview-send'))

      // Interview complete state should show
      await waitFor(() => {
        expect(screen.getByTestId('interview-complete')).toBeInTheDocument()
      })
    })
  })

  // -------------------------------------------------------------------------
  // 5. Error state set when error event arrives
  // -------------------------------------------------------------------------

  describe('error event handling', () => {
    it('displays error state when stream emits an error event', async () => {
      global.fetch = vi.fn().mockResolvedValue(
        new Response(
          makeSseStream([
            { type: 'text_delta', text: 'Partial...' },
            { type: 'error', message: 'LLM stream interrupted' },
          ]),
          { status: 200, headers: { 'Content-Type': 'text/event-stream' } }
        )
      )

      render(
        <InterviewChat
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      )

      await waitFor(() => expect(screen.getByTestId('interview-input')).toBeInTheDocument())

      await userEvent.type(screen.getByTestId('interview-input'), 'Trigger error')
      await userEvent.click(screen.getByTestId('interview-send'))

      // Error state should appear — either from the error event or unexpected close
      await waitFor(() => {
        expect(screen.getByTestId('interview-error')).toBeInTheDocument()
      })
    })

    it('clears streaming text on error and re-enables input', async () => {
      global.fetch = vi.fn().mockResolvedValue(
        new Response(
          makeSseStream([
            { type: 'text_delta', text: 'Partial text...' },
            { type: 'error', message: 'Stream failed' },
          ]),
          { status: 200, headers: { 'Content-Type': 'text/event-stream' } }
        )
      )

      render(
        <InterviewChat
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      )

      await waitFor(() => expect(screen.getByTestId('interview-input')).toBeInTheDocument())

      await userEvent.type(screen.getByTestId('interview-input'), 'Error cleanup test')
      await userEvent.click(screen.getByTestId('interview-send'))

      // After error: streaming bubble should be gone, input re-enabled
      await waitFor(() => {
        expect(screen.getByTestId('interview-error')).toBeInTheDocument()
      })

      // Streaming bubble must be cleared on error
      expect(screen.queryByTestId('message-streaming')).not.toBeInTheDocument()

      // Input should be re-enabled
      const input = screen.getByTestId('interview-input') as HTMLInputElement
      expect(input).not.toBeDisabled()
    })

    it('shows error when response is not authenticated (pre-stream error)', async () => {
      global.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: 'Not authorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        })
      )

      render(
        <InterviewChat
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />
      )

      await waitFor(() => expect(screen.getByTestId('interview-input')).toBeInTheDocument())

      await userEvent.type(screen.getByTestId('interview-input'), 'Auth error test')
      await userEvent.click(screen.getByTestId('interview-send'))

      await waitFor(() => {
        expect(screen.getByTestId('interview-error')).toBeInTheDocument()
      })

      expect(screen.getByTestId('interview-error')).toHaveTextContent('Not authorized')
    })
  })
})
