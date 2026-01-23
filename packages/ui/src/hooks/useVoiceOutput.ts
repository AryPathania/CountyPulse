import { useState, useRef, useCallback } from 'react'
import { supabase } from '@odie/db'

export interface UseVoiceOutputOptions {
  voice?: string
  onStart?: () => void
  onEnd?: () => void
  onError?: (error: Error) => void
}

export interface UseVoiceOutputReturn {
  isSpeaking: boolean
  speak: (text: string) => Promise<void>
  stop: () => void
  error: Error | null
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL

/**
 * Hook for voice output using the speak API.
 * Sends text to the speak edge function and plays the returned audio.
 */
export function useVoiceOutput({
  voice = 'nova',
  onStart,
  onEnd,
  onError,
}: UseVoiceOutputOptions = {}): UseVoiceOutputReturn {
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const handleError = useCallback(
    (err: Error) => {
      setError(err)
      onError?.(err)
    },
    [onError]
  )

  const stop = useCallback(() => {
    // Abort any pending fetch
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }

    // Stop and clean up audio
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      // Revoke object URL to free memory
      if (audioRef.current.src.startsWith('blob:')) {
        URL.revokeObjectURL(audioRef.current.src)
      }
      audioRef.current = null
    }

    setIsSpeaking(false)
  }, [])

  const speak = useCallback(
    async (text: string) => {
      // Stop any existing playback
      stop()
      setError(null)

      if (!text.trim()) {
        return
      }

      // Create abort controller for this request
      abortControllerRef.current = new AbortController()

      try {
        setIsSpeaking(true)
        onStart?.()

        // Get auth token
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          throw new Error('Not authenticated')
        }

        const response = await fetch(`${SUPABASE_URL}/functions/v1/speak`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ text, voice }),
          signal: abortControllerRef.current.signal,
        })

        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`Speech synthesis failed: ${errorText}`)
        }

        // Get audio data as blob
        const audioBlob = await response.blob()
        const audioUrl = URL.createObjectURL(audioBlob)

        // Create and play audio
        const audio = new Audio(audioUrl)
        audioRef.current = audio

        audio.onended = () => {
          URL.revokeObjectURL(audioUrl)
          audioRef.current = null
          setIsSpeaking(false)
          onEnd?.()
        }

        audio.onerror = () => {
          URL.revokeObjectURL(audioUrl)
          audioRef.current = null
          setIsSpeaking(false)
          handleError(new Error('Audio playback failed'))
        }

        await audio.play()
      } catch (err) {
        setIsSpeaking(false)
        if (err instanceof DOMException && err.name === 'AbortError') {
          // Request was aborted, not an error
          return
        }
        handleError(err instanceof Error ? err : new Error('Speech synthesis failed'))
      }
    },
    [voice, onStart, onEnd, handleError, stop]
  )

  return {
    isSpeaking,
    speak,
    stop,
    error,
  }
}
