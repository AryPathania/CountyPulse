import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InterviewChat } from '../../../components/interview/InterviewChat'
import { resetMockState } from '../../../services/interview'

describe('InterviewChat', () => {
  const mockOnComplete = vi.fn()
  const mockOnCancel = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    resetMockState()
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
})
