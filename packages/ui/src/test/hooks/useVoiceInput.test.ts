import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useVoiceInput } from '../../hooks/useVoiceInput'

// Set up environment
const SUPABASE_URL = 'http://localhost:54321'

// Mock @odie/db
const mockGetSession = vi.fn()

vi.mock('@odie/db', () => ({
  supabase: {
    auth: {
      getSession: () => mockGetSession(),
    },
  },
}))

// Mock MediaRecorder
class MockMediaRecorder {
  state: 'inactive' | 'recording' | 'paused' = 'inactive'
  ondataavailable: ((e: { data: Blob }) => void) | null = null
  onstop: (() => void) | null = null
  onerror: (() => void) | null = null
  private mimeType: string

  constructor(_stream: MediaStream, options?: { mimeType?: string }) {
    this.mimeType = options?.mimeType ?? 'audio/webm'
  }

  start() {
    this.state = 'recording'
  }

  stop() {
    this.state = 'inactive'
    // Simulate data available
    if (this.ondataavailable) {
      const blob = new Blob(['mock audio data'], { type: this.mimeType })
      this.ondataavailable({ data: blob })
    }
    // Simulate stop
    setTimeout(() => {
      if (this.onstop) {
        this.onstop()
      }
    }, 0)
  }

  static isTypeSupported(mimeType: string): boolean {
    return mimeType === 'audio/webm' || mimeType === 'audio/mp4'
  }
}

// Mock MediaStream
class MockMediaStream {
  private tracks: Array<{ stop: () => void }> = [{ stop: vi.fn() }]

  getTracks() {
    return this.tracks
  }
}

describe('useVoiceInput', () => {
  const mockOnTranscript = vi.fn()
  const mockOnError = vi.fn()
  let mockGetUserMedia: ReturnType<typeof vi.fn>
  let originalMediaRecorder: typeof MediaRecorder
  let originalFetch: typeof fetch

  beforeEach(() => {
    vi.clearAllMocks()

    // Save originals
    originalMediaRecorder = window.MediaRecorder
    originalFetch = global.fetch

    // Mock authenticated session
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'test-access-token' } },
    })

    // Mock MediaRecorder
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).MediaRecorder = MockMediaRecorder

    // Mock navigator.mediaDevices.getUserMedia
    mockGetUserMedia = vi.fn()
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: mockGetUserMedia,
      },
      writable: true,
      configurable: true,
    })

    // Mock fetch
    global.fetch = vi.fn()
  })

  afterEach(() => {
    // Restore originals
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).MediaRecorder = originalMediaRecorder
    global.fetch = originalFetch
  })

  it('starts in non-recording, non-transcribing state', () => {
    const { result } = renderHook(() =>
      useVoiceInput({
        onTranscript: mockOnTranscript,
        onError: mockOnError,
      })
    )

    expect(result.current.isRecording).toBe(false)
    expect(result.current.isTranscribing).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('starts recording when permission is granted', async () => {
    mockGetUserMedia.mockResolvedValue(new MockMediaStream())

    const { result } = renderHook(() =>
      useVoiceInput({
        onTranscript: mockOnTranscript,
        onError: mockOnError,
      })
    )

    await act(async () => {
      await result.current.startRecording()
    })

    expect(mockGetUserMedia).toHaveBeenCalledWith({ audio: true })
    expect(result.current.isRecording).toBe(true)
    expect(result.current.error).toBeNull()
  })

  it('sets error when microphone permission is denied', async () => {
    const permissionError = new DOMException('Permission denied', 'NotAllowedError')
    mockGetUserMedia.mockRejectedValue(permissionError)

    const { result } = renderHook(() =>
      useVoiceInput({
        onTranscript: mockOnTranscript,
        onError: mockOnError,
      })
    )

    await act(async () => {
      await result.current.startRecording()
    })

    expect(result.current.isRecording).toBe(false)
    expect(result.current.error).not.toBeNull()
    expect(result.current.error?.message).toBe('Microphone permission denied')
    expect(mockOnError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Microphone permission denied' })
    )
  })

  it('sets error when no microphone is found', async () => {
    const notFoundError = new DOMException('No device found', 'NotFoundError')
    mockGetUserMedia.mockRejectedValue(notFoundError)

    const { result } = renderHook(() =>
      useVoiceInput({
        onTranscript: mockOnTranscript,
        onError: mockOnError,
      })
    )

    await act(async () => {
      await result.current.startRecording()
    })

    expect(result.current.error?.message).toBe('No microphone found')
    expect(mockOnError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'No microphone found' })
    )
  })

  it('produces transcript after stopping recording', async () => {
    mockGetUserMedia.mockResolvedValue(new MockMediaStream())
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ text: 'Hello, this is a test transcript' }),
    } as Response)

    const { result } = renderHook(() =>
      useVoiceInput({
        onTranscript: mockOnTranscript,
        onError: mockOnError,
      })
    )

    // Start recording
    await act(async () => {
      await result.current.startRecording()
    })

    expect(result.current.isRecording).toBe(true)

    // Stop recording
    await act(async () => {
      result.current.stopRecording()
    })

    // Wait for transcription to complete
    await waitFor(() => {
      expect(result.current.isRecording).toBe(false)
    })

    await waitFor(() => {
      expect(mockOnTranscript).toHaveBeenCalledWith('Hello, this is a test transcript')
    })

    expect(global.fetch).toHaveBeenCalledWith(
      `${SUPABASE_URL}/functions/v1/transcribe`,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-access-token',
        }),
        body: expect.any(FormData),
      })
    )
  })

  it('handles transcription API error', async () => {
    mockGetUserMedia.mockResolvedValue(new MockMediaStream())
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      text: async () => 'API Error: Service unavailable',
    } as Response)

    const { result } = renderHook(() =>
      useVoiceInput({
        onTranscript: mockOnTranscript,
        onError: mockOnError,
      })
    )

    // Start recording
    await act(async () => {
      await result.current.startRecording()
    })

    // Stop recording
    await act(async () => {
      result.current.stopRecording()
    })

    // Wait for error
    await waitFor(() => {
      expect(result.current.error).not.toBeNull()
    })

    expect(result.current.error?.message).toContain('Transcription failed')
    expect(mockOnError).toHaveBeenCalled()
    expect(mockOnTranscript).not.toHaveBeenCalled()
  })

  it('handles empty transcription response', async () => {
    mockGetUserMedia.mockResolvedValue(new MockMediaStream())
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ text: '' }),
    } as Response)

    const { result } = renderHook(() =>
      useVoiceInput({
        onTranscript: mockOnTranscript,
        onError: mockOnError,
      })
    )

    await act(async () => {
      await result.current.startRecording()
    })

    await act(async () => {
      result.current.stopRecording()
    })

    await waitFor(() => {
      expect(result.current.error).not.toBeNull()
    })

    expect(result.current.error?.message).toBe('No transcription returned')
  })

  it('handles network error during transcription', async () => {
    mockGetUserMedia.mockResolvedValue(new MockMediaStream())
    vi.mocked(global.fetch).mockRejectedValue(new Error('Network error'))

    const { result } = renderHook(() =>
      useVoiceInput({
        onTranscript: mockOnTranscript,
        onError: mockOnError,
      })
    )

    await act(async () => {
      await result.current.startRecording()
    })

    await act(async () => {
      result.current.stopRecording()
    })

    await waitFor(() => {
      expect(result.current.error).not.toBeNull()
    })

    expect(mockOnError).toHaveBeenCalledWith(expect.objectContaining({ message: 'Network error' }))
  })

  it('stops recording and clears tracks', async () => {
    const mockStream = new MockMediaStream()
    const stopSpy = vi.spyOn(mockStream.getTracks()[0], 'stop')
    mockGetUserMedia.mockResolvedValue(mockStream)

    const { result } = renderHook(() =>
      useVoiceInput({
        onTranscript: mockOnTranscript,
        onError: mockOnError,
      })
    )

    await act(async () => {
      await result.current.startRecording()
    })

    expect(result.current.isRecording).toBe(true)

    await act(async () => {
      result.current.stopRecording()
    })

    expect(result.current.isRecording).toBe(false)
    // Tracks should be stopped
    expect(stopSpy).toHaveBeenCalled()
  })

  it('clears error on new recording attempt', async () => {
    const permissionError = new DOMException('Permission denied', 'NotAllowedError')
    mockGetUserMedia.mockRejectedValueOnce(permissionError)

    const { result } = renderHook(() =>
      useVoiceInput({
        onTranscript: mockOnTranscript,
        onError: mockOnError,
      })
    )

    // First attempt fails
    await act(async () => {
      await result.current.startRecording()
    })

    expect(result.current.error).not.toBeNull()

    // Mock success for second attempt
    mockGetUserMedia.mockResolvedValueOnce(new MockMediaStream())

    // Second attempt should clear error
    await act(async () => {
      await result.current.startRecording()
    })

    expect(result.current.error).toBeNull()
    expect(result.current.isRecording).toBe(true)
  })

  it('handles generic DOMException', async () => {
    const genericError = new DOMException('Some error', 'UnknownError')
    mockGetUserMedia.mockRejectedValue(genericError)

    const { result } = renderHook(() =>
      useVoiceInput({
        onTranscript: mockOnTranscript,
        onError: mockOnError,
      })
    )

    await act(async () => {
      await result.current.startRecording()
    })

    expect(result.current.error?.message).toContain('Microphone access failed')
  })

  it('handles non-Error rejection', async () => {
    mockGetUserMedia.mockRejectedValue('String error')

    const { result } = renderHook(() =>
      useVoiceInput({
        onTranscript: mockOnTranscript,
        onError: mockOnError,
      })
    )

    await act(async () => {
      await result.current.startRecording()
    })

    expect(result.current.error?.message).toBe('Failed to start recording')
  })
})
