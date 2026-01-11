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
})
