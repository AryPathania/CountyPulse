import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InterviewChat } from '../../../components/interview/InterviewChat'
import { resetMockState } from '../../../services/interview'

vi.stubEnv('VITE_SUPABASE_URL', 'http://localhost:54321')

// Mock @odie/db so the live path can be tested for error states
const mockGetSession = vi.fn()
const mockFunctionsInvoke = vi.fn()
vi.mock('@odie/db', () => ({
  supabase: {
    auth: { getSession: () => mockGetSession() },
    functions: { invoke: (...args: unknown[]) => mockFunctionsInvoke(...args) },
  },
}))

/**
 * Build a fake SSE ReadableStream for tests that exercise the live streaming path.
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

// Controllable mock for useVoiceInput so tests can set isTranscribing
const mockStartRecording = vi.fn()
const mockStopRecording = vi.fn()
let mockIsTranscribing = false

vi.mock('../../../hooks/useVoiceInput', () => ({
  useVoiceInput: ({ onTranscript }: { onTranscript?: (text: string) => void }) => ({
    isRecording: false,
    isTranscribing: mockIsTranscribing,
    startRecording: mockStartRecording,
    stopRecording: mockStopRecording,
    _onTranscript: onTranscript, // expose for tests
  }),
}))

describe('InterviewChat', () => {
  const mockOnComplete = vi.fn()
  const mockOnCancel = vi.fn()
  let originalFetch: typeof fetch

  beforeEach(() => {
    vi.clearAllMocks()
    resetMockState()
    originalFetch = global.fetch
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('should render with initial greeting message', () => {
    render(
      <InterviewChat
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
        config={{ useMock: true }}
      />
    )

    expect(screen.getByTestId('interview-chat')).toBeInTheDocument()
    expect(screen.getByTestId('interview-messages')).toBeInTheDocument()
    expect(screen.getByTestId('interview-input')).toBeInTheDocument()
    expect(screen.getByTestId('interview-send')).toBeInTheDocument()
  })

  it('should display initial assistant message', () => {
    render(
      <InterviewChat
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
        config={{ useMock: true }}
      />
    )

    expect(screen.getByText(/I'm Odie/)).toBeInTheDocument()
  })

  it('should send message and receive response in mock mode', async () => {
    render(
      <InterviewChat
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
        config={{ useMock: true }}
      />
    )

    const input = screen.getByTestId('interview-input')
    const sendButton = screen.getByTestId('interview-send')

    await userEvent.type(input, 'I worked at Acme Corp as a Software Engineer')
    await userEvent.click(sendButton)

    // User message should appear
    await waitFor(() => {
      expect(screen.getByText('I worked at Acme Corp as a Software Engineer')).toBeInTheDocument()
    })

    // Assistant response should appear (use getAllByText since Acme Corp appears in multiple places)
    await waitFor(() => {
      const assistantMessages = screen.getAllByTestId('message-assistant')
      // Should have at least 2 messages (initial greeting + response)
      expect(assistantMessages.length).toBeGreaterThan(1)
    })
  })

  it('should clear input after sending', async () => {
    render(
      <InterviewChat
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
        config={{ useMock: true }}
      />
    )

    const input = screen.getByTestId('interview-input') as HTMLInputElement
    await userEvent.type(input, 'Test message')
    await userEvent.click(screen.getByTestId('interview-send'))

    await waitFor(() => {
      expect(input.value).toBe('')
    })
  })

  it('should disable send button when input is empty', () => {
    render(
      <InterviewChat
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
        config={{ useMock: true }}
      />
    )

    expect(screen.getByTestId('interview-send')).toBeDisabled()
  })

  it('should call onCancel when cancel button is clicked', async () => {
    render(
      <InterviewChat
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
        config={{ useMock: true }}
      />
    )

    await userEvent.click(screen.getByTestId('interview-cancel'))
    expect(mockOnCancel).toHaveBeenCalledOnce()
  })

  it('should show end interview button before completion', () => {
    render(
      <InterviewChat
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
        config={{ useMock: true }}
      />
    )

    expect(screen.getByTestId('interview-end')).toBeInTheDocument()
  })

  it('should show extracted data preview after position is captured', async () => {
    render(
      <InterviewChat
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
        config={{ useMock: true }}
      />
    )

    // Send first message to trigger position extraction
    await userEvent.type(screen.getByTestId('interview-input'), 'Acme Corp, Software Engineer')
    await userEvent.click(screen.getByTestId('interview-send'))

    // Preview should show the captured position
    await waitFor(() => {
      expect(screen.getByTestId('interview-preview')).toBeInTheDocument()
    })
  })

  it('should complete interview and call onComplete', async () => {
    render(
      <InterviewChat
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
        config={{ useMock: true }}
      />
    )

    // Simulate full interview by clicking End Interview
    await userEvent.click(screen.getByTestId('interview-end'))

    // Should show complete state
    await waitFor(() => {
      expect(screen.getByTestId('interview-complete')).toBeInTheDocument()
    })

    // Click finish button
    await userEvent.click(screen.getByTestId('interview-finish'))

    // onComplete is called when finish button is clicked
    expect(mockOnComplete).toHaveBeenCalled()
    expect(mockOnComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        positions: expect.any(Array),
      })
    )
  })

  it('should show loading state while processing', async () => {
    render(
      <InterviewChat
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
        config={{ useMock: true }}
      />
    )

    // Verify the chat is rendered and input is enabled initially
    const input = screen.getByTestId('interview-input') as HTMLInputElement
    expect(input).not.toBeDisabled()

    // Type and send a message
    await userEvent.type(input, 'Test message')
    await userEvent.click(screen.getByTestId('interview-send'))

    // After sending, we should see a response eventually
    await waitFor(() => {
      const messages = screen.getAllByTestId('message-assistant')
      expect(messages.length).toBeGreaterThan(1)
    })
  })

  it('should accumulate bullets through interview', async () => {
    render(
      <InterviewChat
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
        config={{ useMock: true }}
      />
    )

    // First message - trigger position extraction
    await userEvent.type(screen.getByTestId('interview-input'), 'Acme Corp, Software Engineer')
    await userEvent.click(screen.getByTestId('interview-send'))

    await waitFor(() => {
      expect(screen.getByTestId('interview-preview')).toBeInTheDocument()
    })

    // Second message - add dates
    await userEvent.type(screen.getByTestId('interview-input'), 'Jan 2022 to Jan 2024, San Francisco')
    await userEvent.click(screen.getByTestId('interview-send'))

    await waitFor(() => {
      const preview = screen.getByTestId('interview-preview')
      expect(preview).toHaveTextContent('Acme Corp')
    })

    // Third message - trigger bullet extraction
    await userEvent.type(screen.getByTestId('interview-input'), 'I reduced API latency by 40%')
    await userEvent.click(screen.getByTestId('interview-send'))

    await waitFor(() => {
      const preview = screen.getByTestId('interview-preview')
      expect(preview).toHaveTextContent('1 bullets')
    })
  })

  describe('error handling', () => {
    it('should display error message when sendInterviewMessage throws in live mode', async () => {
      // Use live mode (no useMock) — supabase is mocked to return unauthenticated
      mockGetSession.mockResolvedValue({ data: { session: null } })

      render(
        <InterviewChat
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
          // No useMock: true — uses live mode
        />
      )

      // Wait for initial greeting message (getInitialMessage runs synchronously)
      await waitFor(() => {
        expect(screen.getByTestId('interview-input')).toBeInTheDocument()
      })

      const input = screen.getByTestId('interview-input')
      await userEvent.type(input, 'I worked at Acme Corp')
      await userEvent.click(screen.getByTestId('interview-send'))

      // Since session is null, sendInterviewMessage throws "Not authenticated"
      await waitFor(() => {
        expect(screen.getByTestId('interview-error')).toBeInTheDocument()
      })

      expect(screen.getByTestId('interview-error')).toHaveTextContent('Not authenticated')
    })
  })

  describe('voice features', () => {
    beforeEach(() => {
      mockIsTranscribing = false
    })

    it('should show transcribing indicator when isTranscribing is true', () => {
      mockIsTranscribing = true

      render(
        <InterviewChat
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
          config={{ useMock: true }}
        />
      )

      expect(screen.getByTestId('transcribing-indicator')).toBeInTheDocument()
      expect(screen.getByTestId('transcribing-indicator')).toHaveTextContent('Transcribing...')
    })

    it('should not show transcribing indicator when isTranscribing is false', () => {
      mockIsTranscribing = false

      render(
        <InterviewChat
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
          config={{ useMock: true }}
        />
      )

      expect(screen.queryByTestId('transcribing-indicator')).not.toBeInTheDocument()
    })

    it('should show speak buttons on assistant messages when voice output is enabled', async () => {
      // Enable voice output via localStorage before rendering
      localStorage.setItem('voice-settings', JSON.stringify({ inputEnabled: false, outputEnabled: true, voice: 'nova' }))

      render(
        <InterviewChat
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
          config={{ useMock: true }}
        />
      )

      // Initial message from assistant should show speak button
      await waitFor(() => {
        expect(screen.getByTestId('interview-messages')).toBeInTheDocument()
        // At least one assistant message should exist
        const assistantMessages = screen.getAllByTestId('message-assistant')
        expect(assistantMessages.length).toBeGreaterThan(0)
      })

      // Speak buttons should be visible
      const speakButtons = screen.getAllByTestId('speak-button')
      expect(speakButtons.length).toBeGreaterThan(0)

      localStorage.removeItem('voice-settings')
    })

    it('should not show speak buttons when voice output is disabled', () => {
      localStorage.setItem('voice-settings', JSON.stringify({ inputEnabled: false, outputEnabled: false, voice: 'nova' }))

      render(
        <InterviewChat
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
          config={{ useMock: true }}
        />
      )

      expect(screen.queryByTestId('speak-button')).not.toBeInTheDocument()

      localStorage.removeItem('voice-settings')
    })
  })

  describe('persistence features', () => {
    it('renders persistence notice with correct text', () => {
      render(
        <InterviewChat
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
          config={{ useMock: true }}
        />
      )

      const notice = screen.getByTestId('persistence-notice')
      expect(notice).toBeInTheDocument()
      expect(notice).toHaveTextContent('Your progress is saved in this browser only')
    })

    it('uses initialMessages when provided', () => {
      const initialMessages = [
        {
          id: 'msg-1',
          role: 'assistant' as const,
          content: 'Restored greeting message',
          timestamp: '2024-01-15T10:00:00Z',
        },
        {
          id: 'msg-2',
          role: 'user' as const,
          content: 'Restored user message',
          timestamp: '2024-01-15T10:01:00Z',
        },
      ]

      render(
        <InterviewChat
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
          config={{ useMock: true }}
          initialMessages={initialMessages}
        />
      )

      // Should display the restored messages instead of default greeting
      expect(screen.getByText('Restored greeting message')).toBeInTheDocument()
      expect(screen.getByText('Restored user message')).toBeInTheDocument()
      // Should NOT show default greeting
      expect(screen.queryByText(/I'm Odie/)).not.toBeInTheDocument()
    })

    it('uses initialExtractedData when provided', () => {
      const initialExtractedData = {
        positions: [
          {
            position: {
              company: 'Restored Corp',
              title: 'Restored Engineer',
            },
            bullets: [
              { text: 'Restored bullet 1' },
              { text: 'Restored bullet 2' },
            ],
          },
        ],
      }

      render(
        <InterviewChat
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
          config={{ useMock: true }}
          initialExtractedData={initialExtractedData}
        />
      )

      // Preview should show the restored position
      const preview = screen.getByTestId('interview-preview')
      expect(preview).toBeInTheDocument()
      expect(preview).toHaveTextContent('Restored Corp')
      expect(preview).toHaveTextContent('Restored Engineer')
      expect(preview).toHaveTextContent('2 bullets')
    })

    it('calls onStateChange when messages change', async () => {
      const mockOnStateChange = vi.fn()

      render(
        <InterviewChat
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
          config={{ useMock: true }}
          onStateChange={mockOnStateChange}
        />
      )

      // Initial message triggers onStateChange
      await waitFor(() => {
        expect(mockOnStateChange).toHaveBeenCalled()
      })

      // Send a message
      await userEvent.type(screen.getByTestId('interview-input'), 'Test message')
      await userEvent.click(screen.getByTestId('interview-send'))

      // Should have been called again with updated messages
      await waitFor(() => {
        expect(mockOnStateChange.mock.calls.length).toBeGreaterThan(1)
        // Last call should include the user message
        const lastCall = mockOnStateChange.mock.calls[mockOnStateChange.mock.calls.length - 1]
        const messages = lastCall[0]
        expect(messages.some((m: { content: string }) => m.content === 'Test message')).toBe(true)
      })
    })

    it('calls onStateChange when extractedData changes', async () => {
      const mockOnStateChange = vi.fn()

      render(
        <InterviewChat
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
          config={{ useMock: true }}
          onStateChange={mockOnStateChange}
        />
      )

      // Trigger position extraction
      await userEvent.type(screen.getByTestId('interview-input'), 'Acme Corp, Software Engineer')
      await userEvent.click(screen.getByTestId('interview-send'))

      // Wait for extraction to happen
      await waitFor(() => {
        expect(screen.getByTestId('interview-preview')).toBeInTheDocument()
      })

      // onStateChange should have been called with extracted data
      await waitFor(() => {
        const calls = mockOnStateChange.mock.calls
        const lastCall = calls[calls.length - 1]
        const extractedData = lastCall[1]
        expect(extractedData.positions.length).toBeGreaterThan(0)
        expect(extractedData.positions[0].position.company).toBe('Acme Corp')
      })
    })
  })

  describe('extractedEntries', () => {
    it('shows entry count in completion summary when entries exist', async () => {
      const initialExtractedData = {
        positions: [
          {
            position: { company: 'Acme Corp', title: 'Engineer' },
            bullets: [],
          },
        ],
        entries: [
          { category: 'education' as const, title: 'B.S. CS', subtitle: 'MIT' },
          { category: 'certification' as const, title: 'AWS Certified', subtitle: null },
        ],
      }

      render(
        <InterviewChat
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
          config={{ useMock: true }}
          initialExtractedData={initialExtractedData}
        />
      )

      // End interview to trigger completion summary
      await userEvent.click(screen.getByTestId('interview-end'))

      await waitFor(() => {
        expect(screen.getByTestId('interview-complete')).toBeInTheDocument()
      })

      const summary = screen.getByTestId('interview-complete')
      expect(summary).toHaveTextContent('2 profile entry(ies)')
    })

    it('does not show entry count in completion summary when no entries', async () => {
      render(
        <InterviewChat
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
          config={{ useMock: true }}
        />
      )

      await userEvent.click(screen.getByTestId('interview-end'))

      await waitFor(() => {
        expect(screen.getByTestId('interview-complete')).toBeInTheDocument()
      })

      const summary = screen.getByTestId('interview-complete')
      expect(summary).not.toHaveTextContent('profile entry')
    })

    it('includes entries in onComplete callback data', async () => {
      const initialExtractedData = {
        positions: [],
        entries: [
          { category: 'education' as const, title: 'B.S. CS', subtitle: 'MIT' },
        ],
      }

      render(
        <InterviewChat
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
          config={{ useMock: true }}
          initialExtractedData={initialExtractedData}
        />
      )

      await userEvent.click(screen.getByTestId('interview-end'))

      await waitFor(() => {
        expect(screen.getByTestId('interview-complete')).toBeInTheDocument()
      })

      await userEvent.click(screen.getByTestId('interview-finish'))

      expect(mockOnComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          entries: [
            { category: 'education', title: 'B.S. CS', subtitle: 'MIT' },
          ],
        })
      )
    })

    it('deduplicates extractedEntries returned by streamInterviewMessage', async () => {
      const educationEntry = {
        category: 'education' as const,
        title: 'B.S. CS',
        subtitle: 'MIT',
        startDate: null,
        endDate: null,
        location: null,
      }

      // First response returns an education entry; second returns the same entry (should dedup)
      mockGetSession.mockResolvedValue({
        data: { session: { access_token: 'test-token' } },
      })

      global.fetch = vi.fn()
        .mockResolvedValueOnce(
          new Response(
            makeSseStream([
              { type: 'done', data: {
                response: 'Tell me more about your education.',
                extractedPosition: null,
                extractedBullets: null,
                shouldContinue: true,
                extractedEntries: [educationEntry],
              }},
            ]),
            { status: 200, headers: { 'Content-Type': 'text/event-stream' } }
          )
        )
        .mockResolvedValueOnce(
          new Response(
            makeSseStream([
              { type: 'done', data: {
                response: 'Great, anything else?',
                extractedPosition: null,
                extractedBullets: null,
                shouldContinue: true,
                extractedEntries: [educationEntry],
              }},
            ]),
            { status: 200, headers: { 'Content-Type': 'text/event-stream' } }
          )
        )

      render(
        <InterviewChat
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
          // No useMock - uses live streaming path
        />
      )

      // Wait for initial greeting
      await waitFor(() => {
        expect(screen.getByTestId('interview-input')).toBeInTheDocument()
      })

      // Send first message - triggers entry extraction
      const input = screen.getByTestId('interview-input')
      await userEvent.type(input, 'I studied CS at MIT')
      await userEvent.click(screen.getByTestId('interview-send'))

      await waitFor(() => {
        const msgs = screen.getAllByTestId('message-assistant')
        expect(msgs.length).toBeGreaterThan(1)
      })

      // Send second message - same entry returned again
      await userEvent.type(screen.getByTestId('interview-input'), 'Yes that is correct')
      await userEvent.click(screen.getByTestId('interview-send'))

      await waitFor(() => {
        expect(screen.getByText('Great, anything else?')).toBeInTheDocument()
      })

      // End interview and check onComplete data
      await userEvent.click(screen.getByTestId('interview-end'))
      await waitFor(() => {
        expect(screen.getByTestId('interview-complete')).toBeInTheDocument()
      })

      await userEvent.click(screen.getByTestId('interview-finish'))

      // Entry should appear only once (dedup worked)
      expect(mockOnComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          entries: [educationEntry],
        })
      )
      expect(mockOnComplete.mock.calls[0][0].entries).toHaveLength(1)
    })

    it('initializes with empty entries array by default', async () => {
      render(
        <InterviewChat
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
          config={{ useMock: true }}
        />
      )

      await userEvent.click(screen.getByTestId('interview-end'))

      await waitFor(() => {
        expect(screen.getByTestId('interview-complete')).toBeInTheDocument()
      })

      await userEvent.click(screen.getByTestId('interview-finish'))

      expect(mockOnComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          entries: [],
        })
      )
    })
  })
})
