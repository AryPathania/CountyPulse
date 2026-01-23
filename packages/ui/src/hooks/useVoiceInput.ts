import { useState, useRef, useCallback } from 'react'
import { supabase } from '@odie/db'

export interface UseVoiceInputOptions {
  onTranscript: (text: string) => void
  onError?: (error: Error) => void
}

export interface UseVoiceInputReturn {
  isRecording: boolean
  isTranscribing: boolean
  startRecording: () => Promise<void>
  stopRecording: () => void
  error: Error | null
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL

/**
 * Hook for voice input using MediaRecorder and transcribe API.
 * Captures audio from the microphone and sends it to the transcribe edge function.
 */
export function useVoiceInput({
  onTranscript,
  onError,
}: UseVoiceInputOptions): UseVoiceInputReturn {
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)

  const handleError = useCallback(
    (err: Error) => {
      setError(err)
      onError?.(err)
    },
    [onError]
  )

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    setIsRecording(false)
  }, [])

  const startRecording = useCallback(async () => {
    setError(null)
    audioChunksRef.current = []

    try {
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      // Create MediaRecorder with webm format (widely supported)
      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4'
      const mediaRecorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        // Stop all tracks
        stream.getTracks().forEach((track) => track.stop())
        streamRef.current = null

        if (audioChunksRef.current.length === 0) {
          handleError(new Error('No audio data recorded'))
          return
        }

        // Create audio blob
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType })
        audioChunksRef.current = []

        // Send to transcribe API
        setIsTranscribing(true)
        try {
          // Get auth token
          const { data: { session } } = await supabase.auth.getSession()
          if (!session) {
            throw new Error('Not authenticated')
          }

          const formData = new FormData()
          const extension = mimeType === 'audio/webm' ? 'webm' : 'm4a'
          formData.append('audio', audioBlob, `audio.${extension}`)

          const response = await fetch(`${SUPABASE_URL}/functions/v1/transcribe`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: formData,
          })

          if (!response.ok) {
            const errorText = await response.text()
            throw new Error(`Transcription failed: ${errorText}`)
          }

          const data = await response.json()
          if (data.text) {
            onTranscript(data.text)
          } else {
            throw new Error('No transcription returned')
          }
        } catch (err) {
          handleError(err instanceof Error ? err : new Error('Transcription failed'))
        } finally {
          setIsTranscribing(false)
        }
      }

      mediaRecorder.onerror = () => {
        handleError(new Error('Recording error occurred'))
        stopRecording()
      }

      // Start recording
      mediaRecorder.start()
      setIsRecording(true)
    } catch (err) {
      if (err instanceof DOMException) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          handleError(new Error('Microphone permission denied'))
        } else if (err.name === 'NotFoundError') {
          handleError(new Error('No microphone found'))
        } else {
          handleError(new Error(`Microphone access failed: ${err.message}`))
        }
      } else {
        handleError(err instanceof Error ? err : new Error('Failed to start recording'))
      }
    }
  }, [onTranscript, handleError, stopRecording])

  return {
    isRecording,
    isTranscribing,
    startRecording,
    stopRecording,
    error,
  }
}
