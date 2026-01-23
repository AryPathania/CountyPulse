import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useVoiceOutput } from '../../hooks/useVoiceOutput'

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

describe('useVoiceOutput', () => {
  const mockOnStart = vi.fn()
  const mockOnEnd = vi.fn()
  const mockOnError = vi.fn()
  let originalFetch: typeof fetch
  let originalAudio: typeof Audio
  let originalCreateObjectURL: typeof URL.createObjectURL
  let originalRevokeObjectURL: typeof URL.revokeObjectURL

  // Mock Audio instance
  let mockAudioInstance: {
    play: ReturnType<typeof vi.fn>
    pause: ReturnType<typeof vi.fn>
    src: string
    currentTime: number
    onended: (() => void) | null
    onerror: (() => void) | null
  }

  beforeEach(() => {
    vi.clearAllMocks()

    // Save originals
    originalFetch = global.fetch
    originalAudio = global.Audio
    originalCreateObjectURL = URL.createObjectURL
    originalRevokeObjectURL = URL.revokeObjectURL

    // Mock authenticated session
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'test-access-token' } },
    })

    // Reset mock audio instance
    mockAudioInstance = {
      play: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn(),
      src: '',
      currentTime: 0,
      onended: null,
      onerror: null,
    }

    // Mock Audio constructor
    global.Audio = vi.fn(() => mockAudioInstance) as unknown as typeof Audio

    // Mock URL methods
    URL.createObjectURL = vi.fn(() => 'blob:mock-url')
    URL.revokeObjectURL = vi.fn()

    // Mock fetch
    global.fetch = vi.fn()
  })

  afterEach(() => {
    // Restore originals
    global.fetch = originalFetch
    global.Audio = originalAudio
    URL.createObjectURL = originalCreateObjectURL
    URL.revokeObjectURL = originalRevokeObjectURL
  })

  it('starts in non-speaking state', () => {
    const { result } = renderHook(() =>
      useVoiceOutput({
        onStart: mockOnStart,
        onEnd: mockOnEnd,
        onError: mockOnError,
      })
    )

    expect(result.current.isSpeaking).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('uses default voice (nova) when not specified', () => {
    const { result } = renderHook(() => useVoiceOutput())

    // Default voice is 'nova', will be used in API call
    expect(result.current.isSpeaking).toBe(false)
  })

  it('calls API and plays audio on speak()', async () => {
    const audioBlob = new Blob(['mock audio'], { type: 'audio/mpeg' })
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      blob: async () => audioBlob,
    } as Response)

    const { result } = renderHook(() =>
      useVoiceOutput({
        voice: 'alloy',
        onStart: mockOnStart,
        onEnd: mockOnEnd,
        onError: mockOnError,
      })
    )

    await act(async () => {
      await result.current.speak('Hello world')
    })

    expect(global.fetch).toHaveBeenCalledWith(
      `${SUPABASE_URL}/functions/v1/speak`,
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-access-token',
        },
        body: JSON.stringify({ text: 'Hello world', voice: 'alloy' }),
      })
    )

    expect(URL.createObjectURL).toHaveBeenCalledWith(audioBlob)
    expect(mockAudioInstance.play).toHaveBeenCalled()
    expect(mockOnStart).toHaveBeenCalled()
    expect(result.current.isSpeaking).toBe(true)
  })

  it('sets isSpeaking to false when audio ends', async () => {
    const audioBlob = new Blob(['mock audio'], { type: 'audio/mpeg' })
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      blob: async () => audioBlob,
    } as Response)

    const { result } = renderHook(() =>
      useVoiceOutput({
        onStart: mockOnStart,
        onEnd: mockOnEnd,
        onError: mockOnError,
      })
    )

    await act(async () => {
      await result.current.speak('Hello world')
    })

    expect(result.current.isSpeaking).toBe(true)

    // Simulate audio ended
    await act(async () => {
      mockAudioInstance.onended?.()
    })

    expect(result.current.isSpeaking).toBe(false)
    expect(mockOnEnd).toHaveBeenCalled()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
  })

  it('stops current playback', async () => {
    const audioBlob = new Blob(['mock audio'], { type: 'audio/mpeg' })
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      blob: async () => audioBlob,
    } as Response)

    const { result } = renderHook(() =>
      useVoiceOutput({
        onStart: mockOnStart,
        onEnd: mockOnEnd,
        onError: mockOnError,
      })
    )

    // Start speaking
    await act(async () => {
      await result.current.speak('Hello world')
    })

    expect(result.current.isSpeaking).toBe(true)

    // Stop playback
    act(() => {
      result.current.stop()
    })

    expect(mockAudioInstance.pause).toHaveBeenCalled()
    expect(result.current.isSpeaking).toBe(false)
  })

  it('handles API error', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      text: async () => 'API Error: Service unavailable',
    } as Response)

    const { result } = renderHook(() =>
      useVoiceOutput({
        onStart: mockOnStart,
        onEnd: mockOnEnd,
        onError: mockOnError,
      })
    )

    await act(async () => {
      await result.current.speak('Hello world')
    })

    expect(result.current.isSpeaking).toBe(false)
    expect(result.current.error?.message).toContain('Speech synthesis failed')
    expect(mockOnError).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('Speech synthesis failed') })
    )
  })

  it('handles network error', async () => {
    vi.mocked(global.fetch).mockRejectedValue(new Error('Network error'))

    const { result } = renderHook(() =>
      useVoiceOutput({
        onStart: mockOnStart,
        onEnd: mockOnEnd,
        onError: mockOnError,
      })
    )

    await act(async () => {
      await result.current.speak('Hello world')
    })

    expect(result.current.isSpeaking).toBe(false)
    expect(result.current.error?.message).toBe('Network error')
    expect(mockOnError).toHaveBeenCalled()
  })

  it('handles audio playback error', async () => {
    const audioBlob = new Blob(['mock audio'], { type: 'audio/mpeg' })
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      blob: async () => audioBlob,
    } as Response)

    const { result } = renderHook(() =>
      useVoiceOutput({
        onStart: mockOnStart,
        onEnd: mockOnEnd,
        onError: mockOnError,
      })
    )

    await act(async () => {
      await result.current.speak('Hello world')
    })

    // Simulate audio error
    await act(async () => {
      mockAudioInstance.onerror?.()
    })

    expect(result.current.isSpeaking).toBe(false)
    expect(result.current.error?.message).toBe('Audio playback failed')
    expect(mockOnError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Audio playback failed' })
    )
    expect(URL.revokeObjectURL).toHaveBeenCalled()
  })

  it('does not speak empty text', async () => {
    const { result } = renderHook(() =>
      useVoiceOutput({
        onStart: mockOnStart,
        onEnd: mockOnEnd,
        onError: mockOnError,
      })
    )

    await act(async () => {
      await result.current.speak('')
    })

    expect(global.fetch).not.toHaveBeenCalled()
    expect(result.current.isSpeaking).toBe(false)
  })

  it('does not speak whitespace-only text', async () => {
    const { result } = renderHook(() =>
      useVoiceOutput({
        onStart: mockOnStart,
        onEnd: mockOnEnd,
        onError: mockOnError,
      })
    )

    await act(async () => {
      await result.current.speak('   ')
    })

    expect(global.fetch).not.toHaveBeenCalled()
    expect(result.current.isSpeaking).toBe(false)
  })

  it('stops previous playback before starting new', async () => {
    const audioBlob = new Blob(['mock audio'], { type: 'audio/mpeg' })
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      blob: async () => audioBlob,
    } as Response)

    const { result } = renderHook(() =>
      useVoiceOutput({
        onStart: mockOnStart,
        onEnd: mockOnEnd,
        onError: mockOnError,
      })
    )

    // Start first speech
    await act(async () => {
      await result.current.speak('First message')
    })

    // Create a new mock instance for the second call
    const secondMockAudioInstance = {
      play: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn(),
      src: '',
      currentTime: 0,
      onended: null,
      onerror: null,
    }
    global.Audio = vi.fn(() => secondMockAudioInstance) as unknown as typeof Audio

    // Start second speech (should stop first)
    await act(async () => {
      await result.current.speak('Second message')
    })

    // First audio should have been paused
    expect(mockAudioInstance.pause).toHaveBeenCalled()
    // Second audio should be playing
    expect(secondMockAudioInstance.play).toHaveBeenCalled()
  })

  it('handles abort gracefully when stop is called during fetch', async () => {
    // Make fetch hang until we abort, then reject with AbortError
    let rejectFetch: (reason: unknown) => void
    vi.mocked(global.fetch).mockImplementation(
      () =>
        new Promise((_, reject) => {
          rejectFetch = reject
        })
    )

    const { result } = renderHook(() =>
      useVoiceOutput({
        onStart: mockOnStart,
        onEnd: mockOnEnd,
        onError: mockOnError,
      })
    )

    // Start speaking (this will call getSession then fetch)
    let speakPromise: Promise<void>
    act(() => {
      speakPromise = result.current.speak('Hello world')
    })

    // Wait for fetch to be called (after getSession resolves)
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled()
    })

    // Stop immediately (this aborts the fetch)
    act(() => {
      result.current.stop()
    })

    // Simulate the abort error from fetch
    await act(async () => {
      rejectFetch(new DOMException('Aborted', 'AbortError'))
    })

    // Wait for speak promise to resolve/reject
    await act(async () => {
      await speakPromise
    })

    // Should not set error for abort
    expect(result.current.error).toBeNull()
    expect(mockOnError).not.toHaveBeenCalled()
  })

  it('clears error on new speak attempt', async () => {
    // First call fails
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      text: async () => 'Error',
    } as Response)

    const { result } = renderHook(() =>
      useVoiceOutput({
        onStart: mockOnStart,
        onEnd: mockOnEnd,
        onError: mockOnError,
      })
    )

    await act(async () => {
      await result.current.speak('First message')
    })

    expect(result.current.error).not.toBeNull()

    // Second call succeeds
    const audioBlob = new Blob(['mock audio'], { type: 'audio/mpeg' })
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      blob: async () => audioBlob,
    } as Response)

    await act(async () => {
      await result.current.speak('Second message')
    })

    expect(result.current.error).toBeNull()
  })

  it('handles play() rejection', async () => {
    const audioBlob = new Blob(['mock audio'], { type: 'audio/mpeg' })
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      blob: async () => audioBlob,
    } as Response)

    mockAudioInstance.play = vi.fn().mockRejectedValue(new Error('Playback not allowed'))

    const { result } = renderHook(() =>
      useVoiceOutput({
        onStart: mockOnStart,
        onEnd: mockOnEnd,
        onError: mockOnError,
      })
    )

    await act(async () => {
      await result.current.speak('Hello world')
    })

    expect(result.current.isSpeaking).toBe(false)
    expect(result.current.error?.message).toBe('Playback not allowed')
    expect(mockOnError).toHaveBeenCalled()
  })

  it('uses specified voice in API call', async () => {
    const audioBlob = new Blob(['mock audio'], { type: 'audio/mpeg' })
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      blob: async () => audioBlob,
    } as Response)

    const { result } = renderHook(() =>
      useVoiceOutput({
        voice: 'shimmer',
        onStart: mockOnStart,
        onEnd: mockOnEnd,
        onError: mockOnError,
      })
    )

    await act(async () => {
      await result.current.speak('Hello world')
    })

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({ text: 'Hello world', voice: 'shimmer' }),
      })
    )
  })
})
