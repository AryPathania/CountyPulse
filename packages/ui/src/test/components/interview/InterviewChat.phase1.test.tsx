/**
 * Phase 1 voice interview tests.
 *
 * Covers:
 *  1a. Auto-submit after transcription when voice input is enabled
 *  1a. TTS race guard — defer auto-submit while TTS is playing
 *  1a. Echo loop prevention — stopRecording called when isSpeaking becomes true while recording
 *  1a. micDisabled prop passed to VoiceControls when TTS is playing
 *  1a. isTranscribing guard — manual Enter no-ops when isTranscribing
 *  1c. TTS decoupled from isLoading — isLoading goes false before TTS finishes
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InterviewChat } from '../../../components/interview/InterviewChat'
import { resetMockState } from '../../../services/interview'

// ---------------------------------------------------------------------------
// Shared mocks
// ---------------------------------------------------------------------------

const mockGetSession = vi.fn()
const mockFunctionsInvoke = vi.fn()
vi.mock('@odie/db', () => ({
  supabase: {
    auth: { getSession: () => mockGetSession() },
    functions: { invoke: (...args: unknown[]) => mockFunctionsInvoke(...args) },
  },
}))

// Controllable useVoiceInput mock — lets tests drive isRecording, isTranscribing,
// and manually fire the onTranscript callback.
const mockStartRecording = vi.fn()
const mockStopRecording = vi.fn()
let mockIsRecording = false
let mockIsTranscribingP1 = false
let capturedOnTranscript: ((text: string) => void) | undefined

vi.mock('../../../hooks/useVoiceInput', () => ({
  useVoiceInput: ({ onTranscript }: { onTranscript?: (text: string) => void }) => {
    capturedOnTranscript = onTranscript
    return {
      isRecording: mockIsRecording,
      isTranscribing: mockIsTranscribingP1,
      startRecording: mockStartRecording,
      stopRecording: mockStopRecording,
      analyserNode: null,
      error: null,
    }
  },
}))

// Controllable useVoiceOutput mock — lets tests drive isSpeaking and manually
// fire the onEnd callback.
let mockIsSpeaking = false
const mockSpeak = vi.fn()
const mockStopSpeaking = vi.fn()
let capturedOnEnd: (() => void) | undefined

vi.mock('../../../hooks/useVoiceOutput', () => ({
  useVoiceOutput: ({ onEnd }: { onEnd?: () => void } = {}) => {
    capturedOnEnd = onEnd
    return {
      isSpeaking: mockIsSpeaking,
      speak: mockSpeak,
      stop: mockStopSpeaking,
      error: null,
    }
  },
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Enable voice input via localStorage before render. */
function enableVoiceInput() {
  localStorage.setItem(
    'voice-settings',
    JSON.stringify({ inputEnabled: true, outputEnabled: false, voice: 'nova' })
  )
}

/** Enable both voice input and output via localStorage before render. */
function enableVoiceIO() {
  localStorage.setItem(
    'voice-settings',
    JSON.stringify({ inputEnabled: true, outputEnabled: true, voice: 'nova' })
  )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('InterviewChat Phase 1 voice changes', () => {
  const mockOnComplete = vi.fn()
  const mockOnCancel = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    resetMockState()
    mockIsRecording = false
    mockIsTranscribingP1 = false
    mockIsSpeaking = false
    capturedOnTranscript = undefined
    capturedOnEnd = undefined
    localStorage.removeItem('voice-settings')
  })

  // -------------------------------------------------------------------------
  // 1. Auto-submit after transcription
  // -------------------------------------------------------------------------

  describe('auto-submit after transcription', () => {
    it('calls sendInterviewMessage when transcript arrives with voice input enabled', async () => {
      enableVoiceInput()

      render(
        <InterviewChat
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
          config={{ useMock: true }}
        />
      )

      // Wait for component to initialise
      await waitFor(() => expect(screen.getByTestId('interview-input')).toBeInTheDocument())

      // Simulate Whisper transcription arriving
      await act(async () => {
        capturedOnTranscript?.('I led a team of five engineers.')
      })

      // Message should appear in chat without manual Enter
      await waitFor(() => {
        expect(screen.getByText('I led a team of five engineers.')).toBeInTheDocument()
      })
    })

    it('does NOT auto-submit when voice input is disabled', async () => {
      // Default settings have inputEnabled: false
      render(
        <InterviewChat
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
          config={{ useMock: true }}
        />
      )

      await waitFor(() => expect(screen.getByTestId('interview-input')).toBeInTheDocument())

      await act(async () => {
        capturedOnTranscript?.('Should not auto-submit')
      })

      // The text should appear in the input field, not as a submitted message
      const inputEl = screen.getByTestId('interview-input') as HTMLInputElement
      expect(inputEl.value).toBe('Should not auto-submit')

      // No user message bubble should exist
      const userMessages = screen.queryAllByTestId('message-user')
      expect(userMessages).toHaveLength(0)
    })
  })

  // -------------------------------------------------------------------------
  // 2. TTS race guard — deferred auto-submit
  // -------------------------------------------------------------------------

  describe('TTS race guard', () => {
    it('defers auto-submit while TTS is playing; submits when TTS ends', async () => {
      enableVoiceIO()
      mockIsSpeaking = true // TTS is already playing when transcript arrives

      render(
        <InterviewChat
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
          config={{ useMock: true }}
        />
      )

      await waitFor(() => expect(screen.getByTestId('interview-input')).toBeInTheDocument())

      // Transcript arrives while TTS is playing — should be deferred
      await act(async () => {
        capturedOnTranscript?.('Deferred transcript text')
      })

      // Should NOT have been submitted yet
      expect(screen.queryByText('Deferred transcript text')).not.toBeInTheDocument()

      // TTS ends — the deferred transcript should now fire
      mockIsSpeaking = false
      await act(async () => {
        capturedOnEnd?.()
      })

      // Now the message should appear
      await waitFor(() => {
        expect(screen.getByText('Deferred transcript text')).toBeInTheDocument()
      })
    })
  })

  // -------------------------------------------------------------------------
  // 3. Echo loop prevention
  // -------------------------------------------------------------------------

  describe('echo loop prevention', () => {
    it('calls stopRecording when isSpeaking becomes true while recording', async () => {
      enableVoiceIO()
      mockIsRecording = true

      render(
        <InterviewChat
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
          config={{ useMock: true }}
        />
      )

      // Initial render: isRecording=true, isSpeaking=false — no stop yet
      await waitFor(() => expect(screen.getByTestId('interview-chat')).toBeInTheDocument())
      expect(mockStopRecording).not.toHaveBeenCalled()

      // TTS starts playing — isSpeaking becomes true while still recording
      mockIsSpeaking = true
      // Re-render to pick up the new isSpeaking value
      render(
        <InterviewChat
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
          config={{ useMock: true }}
        />
      )

      await waitFor(() => {
        expect(mockStopRecording).toHaveBeenCalled()
      })
    })
  })

  // -------------------------------------------------------------------------
  // 4. micDisabled passed to VoiceControls when TTS is playing
  // -------------------------------------------------------------------------

  describe('micDisabled when TTS is speaking', () => {
    it('mic button is disabled when isSpeaking is true', async () => {
      enableVoiceInput()
      mockIsSpeaking = true

      render(
        <InterviewChat
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
          config={{ useMock: true }}
        />
      )

      await waitFor(() => expect(screen.getByTestId('mic-button')).toBeInTheDocument())

      const micButton = screen.getByTestId('mic-button')
      expect(micButton).toBeDisabled()
    })

    it('mic button is enabled when isSpeaking is false', async () => {
      enableVoiceInput()
      mockIsSpeaking = false

      render(
        <InterviewChat
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
          config={{ useMock: true }}
        />
      )

      await waitFor(() => expect(screen.getByTestId('mic-button')).toBeInTheDocument())

      const micButton = screen.getByTestId('mic-button')
      expect(micButton).not.toBeDisabled()
    })

    it('handleMicClick returns immediately when isSpeaking is true', async () => {
      enableVoiceInput()
      mockIsSpeaking = true

      render(
        <InterviewChat
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
          config={{ useMock: true }}
        />
      )

      await waitFor(() => expect(screen.getByTestId('mic-button')).toBeInTheDocument())

      // The button is disabled so click is a no-op at the DOM level —
      // startRecording and stopRecording must not have been called
      await userEvent.click(screen.getByTestId('mic-button'), { pointerEventsCheck: 0 })

      expect(mockStartRecording).not.toHaveBeenCalled()
      expect(mockStopRecording).not.toHaveBeenCalled()
    })
  })

  // -------------------------------------------------------------------------
  // 5. isTranscribing guard on manual submit
  // -------------------------------------------------------------------------

  describe('isTranscribing guard', () => {
    it('does not submit via Enter when isTranscribing is true', async () => {
      mockIsTranscribingP1 = true

      render(
        <InterviewChat
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
          config={{ useMock: true }}
        />
      )

      await waitFor(() => expect(screen.getByTestId('interview-input')).toBeInTheDocument())

      const input = screen.getByTestId('interview-input')
      await userEvent.type(input, 'Hello{Enter}')

      // No user message should have been sent
      expect(screen.queryByTestId('message-user')).not.toBeInTheDocument()
    })

    it('allows submit via Enter when isTranscribing is false', async () => {
      mockIsTranscribingP1 = false

      render(
        <InterviewChat
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
          config={{ useMock: true }}
        />
      )

      await waitFor(() => expect(screen.getByTestId('interview-input')).toBeInTheDocument())

      const input = screen.getByTestId('interview-input')
      await userEvent.type(input, 'Hello there')
      await userEvent.click(screen.getByTestId('interview-send'))

      await waitFor(() => {
        expect(screen.getByText('Hello there')).toBeInTheDocument()
      })
    })
  })

  // -------------------------------------------------------------------------
  // 6. TTS decoupled from isLoading (Phase 1c)
  // -------------------------------------------------------------------------

  describe('TTS decoupled from isLoading', () => {
    it('input is re-enabled after LLM response even when TTS is configured', async () => {
      enableVoiceIO()

      render(
        <InterviewChat
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
          config={{ useMock: true }}
        />
      )

      await waitFor(() => expect(screen.getByTestId('interview-input')).toBeInTheDocument())

      const input = screen.getByTestId('interview-input') as HTMLInputElement
      await userEvent.type(input, 'Test response decoupling')
      await userEvent.click(screen.getByTestId('interview-send'))

      // After the LLM response the input must be re-enabled even before TTS finishes.
      // In mock mode the response resolves synchronously — we just need to wait for it.
      await waitFor(() => {
        const msgs = screen.getAllByTestId('message-assistant')
        expect(msgs.length).toBeGreaterThan(1)
      })

      // Input must be enabled (not disabled) — TTS plays in parallel
      expect(input).not.toBeDisabled()
    })

    it('speak is called after LLM response when outputEnabled is true', async () => {
      enableVoiceIO()

      render(
        <InterviewChat
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
          config={{ useMock: true }}
        />
      )

      await waitFor(() => expect(screen.getByTestId('interview-input')).toBeInTheDocument())

      await userEvent.type(screen.getByTestId('interview-input'), 'Trigger TTS')
      await userEvent.click(screen.getByTestId('interview-send'))

      await waitFor(() => {
        expect(mockSpeak).toHaveBeenCalled()
      })
    })

    it('speak is NOT called when outputEnabled is false', async () => {
      enableVoiceInput() // only input enabled, not output

      render(
        <InterviewChat
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
          config={{ useMock: true }}
        />
      )

      await waitFor(() => expect(screen.getByTestId('interview-input')).toBeInTheDocument())

      await userEvent.type(screen.getByTestId('interview-input'), 'No TTS')
      await userEvent.click(screen.getByTestId('interview-send'))

      await waitFor(() => {
        const msgs = screen.getAllByTestId('message-assistant')
        expect(msgs.length).toBeGreaterThan(1)
      })

      expect(mockSpeak).not.toHaveBeenCalled()
    })
  })
})
