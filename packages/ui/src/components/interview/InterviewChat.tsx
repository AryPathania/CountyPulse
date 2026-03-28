import { useState, useRef, useEffect, useCallback } from 'react'
import { flushSync } from 'react-dom'
import type { ChatMessage, ExtractedInterviewData } from '@odie/shared'
import {
  sendInterviewMessage,
  streamInterviewMessage,
  getInitialMessage,
  resetMockState,
  type InterviewServiceConfig,
  type InterviewResult,
} from '../../services/interview'
import { useVoiceInput } from '../../hooks/useVoiceInput'
import { useVoiceOutput } from '../../hooks/useVoiceOutput'
import { useVoiceSettings } from '../../hooks/useVoiceSettings'
import { VoiceControls } from './VoiceControls'
import type { ExtractedEntry } from '../../services/interview'
import './InterviewChat.css'
import './VoiceControls.css'

/** Merge new extracted entries into existing state, deduplicating by category+title+subtitle. */
function mergeExtractedEntries(
  prev: ExtractedInterviewData,
  newEntries: ExtractedEntry[]
): ExtractedInterviewData {
  const existing = prev.entries ?? []
  const existingKeys = new Set(
    existing.map((e) => `${e.category}|${e.title}|${e.subtitle ?? ''}`)
  )
  const unique = newEntries.filter(
    (e) => !existingKeys.has(`${e.category}|${e.title}|${e.subtitle ?? ''}`)
  )
  if (unique.length === 0) return prev
  return { ...prev, entries: [...existing, ...unique] }
}

export interface InterviewChatProps {
  onComplete: (data: ExtractedInterviewData) => void
  onCancel: () => void
  config?: InterviewServiceConfig
  initialMessages?: ChatMessage[]
  initialExtractedData?: ExtractedInterviewData
  onStateChange?: (
    messages: ChatMessage[],
    extractedData: ExtractedInterviewData
  ) => void
}

export function InterviewChat({
  onComplete,
  onCancel,
  config,
  initialMessages,
  initialExtractedData,
  onStateChange,
}: InterviewChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages ?? [])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isComplete, setIsComplete] = useState(false)
  const [extractedData, setExtractedData] = useState<ExtractedInterviewData>(
    initialExtractedData ?? { positions: [], entries: [] }
  )
  const [hasInitialized, setHasInitialized] = useState(!!initialMessages?.length)

  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  // Mirrors `messages` state so submitMessage always reads the latest snapshot
  // without needing `messages` as a useCallback dependency.
  const messagesRef = useRef<ChatMessage[]>(initialMessages ?? [])
  // Stores a transcript that arrived while TTS was playing; submitted when TTS ends.
  const pendingTranscriptRef = useRef<string | null>(null)
  // Stable ref to submitMessage so TTS onEnd callback can invoke it without stale closure.
  const submitMessageRef = useRef<((text: string) => Promise<void>) | null>(null)

  // Voice settings and hooks
  const { settings: voiceSettings, setInputEnabled, setOutputEnabled, setVoice } = useVoiceSettings()

  const handleTtsEnd = useCallback(() => {
    const pending = pendingTranscriptRef.current
    if (pending !== null) {
      pendingTranscriptRef.current = null
      submitMessageRef.current?.(pending)
    }
  }, [])

  const { isSpeaking, speak, speakSentence, stop: stopSpeaking } = useVoiceOutput({
    voice: voiceSettings.voice,
    onEnd: handleTtsEnd,
  })

  const handleTranscript = useCallback(
    (text: string) => {
      if (voiceSettings.inputEnabled) {
        // Auto-submit voice transcript. Defer if TTS is currently playing to prevent echo loop.
        if (isSpeaking) {
          pendingTranscriptRef.current = text
        } else {
          submitMessageRef.current?.(text)
        }
      } else {
        // Text-mode fallback: populate input field
        setInput((prev) => (prev ? `${prev} ${text}` : text))
        inputRef.current?.focus({ preventScroll: true })
      }
    },
    [voiceSettings.inputEnabled, isSpeaking]
  )

  const { isRecording, isTranscribing, startRecording, stopRecording, analyserNode } = useVoiceInput({
    onTranscript: handleTranscript,
  })

  const handleMicClick = useCallback(() => {
    // Never start recording while TTS is playing — prevents echo loop
    if (isSpeaking) return
    if (isRecording) {
      stopRecording()
    } else {
      startRecording()
    }
  }, [isSpeaking, isRecording, startRecording, stopRecording])

  const handleSpeak = useCallback((text: string) => {
    if (isSpeaking) {
      stopSpeaking()
    } else {
      speak(text)
    }
  }, [isSpeaking, speak, stopSpeaking])

  const appendAssistantMessage = useCallback((content: string) => {
    const msg: ChatMessage = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content,
      timestamp: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, msg])
  }, [])

  // Echo loop prevention: stop active recording when TTS starts playing.
  // This prevents TTS audio from being captured by the mic and re-submitted.
  useEffect(() => {
    if (isSpeaking && isRecording) {
      stopRecording()
    }
  }, [isSpeaking, isRecording, stopRecording])

  // Keep messagesRef in sync so submitMessage always reads the current snapshot.
  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  /**
   * Apply extracted data from an interview result into component state.
   * Pure state-update logic extracted so both the streaming and mock paths share it.
   */
  const applyExtractedData = useCallback((result: Pick<InterviewResult, 'extractedPosition' | 'extractedBullets' | 'extractedEntries'>) => {
    if (result.extractedPosition) {
      setExtractedData((prev) => {
        const existingIndex = prev.positions.findIndex(
          (p) =>
            p.position.company === result.extractedPosition?.company &&
            p.position.title === result.extractedPosition?.title
        )
        if (existingIndex >= 0) {
          const updated = [...prev.positions]
          updated[existingIndex] = {
            ...updated[existingIndex],
            position: { ...updated[existingIndex].position, ...result.extractedPosition },
          }
          return { ...prev, positions: updated }
        }
        return {
          ...prev,
          positions: [
            ...prev.positions,
            { position: result.extractedPosition!, bullets: [] },
          ],
        }
      })
    }

    if (result.extractedBullets && result.extractedBullets.length > 0) {
      setExtractedData((prev) => {
        if (prev.positions.length === 0) return prev
        const updated = [...prev.positions]
        const lastIndex = updated.length - 1
        const existingTexts = new Set(updated[lastIndex].bullets.map((b) => b.text))
        const newBullets = result.extractedBullets!.filter((b) => !existingTexts.has(b.text))
        if (newBullets.length === 0) return prev
        updated[lastIndex] = {
          ...updated[lastIndex],
          bullets: [...updated[lastIndex].bullets, ...newBullets],
        }
        return { ...prev, positions: updated }
      })
    }

    if (result.extractedEntries && result.extractedEntries.length > 0) {
      setExtractedData((prev) => mergeExtractedEntries(prev, result.extractedEntries!))
    }
  }, [])

  /**
   * Core send logic. Used by both the form submit path (typed text) and the
   * voice auto-submit path (transcript text). Reads current messages from
   * messagesRef to avoid stale closure issues.
   *
   * Uses streamInterviewMessage for the live path (progressive text in bubble +
   * sentence-level TTS). Falls back to sendInterviewMessage in mock mode so
   * all existing tests continue to pass unchanged.
   */
  const submitMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return

      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: text.trim(),
        timestamp: new Date().toISOString(),
      }

      const updatedMessages = [...messagesRef.current, userMessage]
      setMessages(updatedMessages)
      setIsLoading(true)
      setStreamingText('')
      setError(null)

      // Mock path: use synchronous sendInterviewMessage so tests are unaffected
      if (config?.useMock) {
        let responseTextForTts: string | null = null
        try {
          const result = await sendInterviewMessage(updatedMessages, config)
          appendAssistantMessage(result.response)
          responseTextForTts = result.response
          applyExtractedData(result)
          if (!result.shouldContinue) {
            setIsComplete(true)
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to send message')
        } finally {
          setIsLoading(false)
          if (voiceSettings.outputEnabled && responseTextForTts !== null) {
            speak(responseTextForTts)
          }
        }
        return
      }

      // Live streaming path
      await streamInterviewMessage(updatedMessages, config ?? {}, {
        onTextDelta: (delta) => {
          setStreamingText((prev) => prev + delta)
        },
        onSentence: (sentence) => {
          if (voiceSettings.outputEnabled) {
            speakSentence?.(sentence)
          }
        },
        onDone: (result) => {
          const assistantMessage: ChatMessage = {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: result.response,
            timestamp: new Date().toISOString(),
          }
          // Atomic transition: commit permanent message and clear streaming text
          // in one synchronous render so no frame shows both bubbles at once.
          flushSync(() => {
            setMessages((prev) => [...prev, assistantMessage])
            setStreamingText('')
          })
          applyExtractedData(result)
          setIsLoading(false)
          if (!result.shouldContinue) {
            setIsComplete(true)
          }
        },
        onError: (err) => {
          setIsLoading(false)
          setStreamingText('')
          setError(err.message)
        },
      })
    },
    [isLoading, config, appendAssistantMessage, applyExtractedData, voiceSettings.outputEnabled, speak, speakSentence]
  )

  // Keep submitMessageRef current so TTS onEnd can invoke it without a stale closure.
  useEffect(() => {
    submitMessageRef.current = submitMessage
  }, [submitMessage])

  // Initialize chat with greeting (only if no initial messages provided)
  useEffect(() => {
    if (hasInitialized) return

    if (config?.useMock) {
      resetMockState()
    }
    const initialMessage = getInitialMessage(config?.context)
    setMessages([initialMessage])
    setHasInitialized(true)
  }, [config?.useMock, config?.context, hasInitialized])

  // Auto-start: for context-aware modes (resume/gaps), automatically send
  // the first API call so the LLM can immediately react to the context
  const hasAutoStarted = useRef(false)
  useEffect(() => {
    if (hasAutoStarted.current) return
    if (!hasInitialized || messages.length === 0) return
    if (!config?.context?.mode || config.context.mode === 'blank') return
    // Only auto-start when there's just the greeting message (fresh session)
    if (messages.length !== 1 || messages[0].role !== 'assistant') return

    hasAutoStarted.current = true

    const mode = config.context?.mode
    let autoContent = "Yes, let's get started!"
    if (mode === 'resume') {
      autoContent = "Yes, let's get started! I'd like to focus on strengthening my weaker bullets and filling in any gaps."
    } else if (mode === 'gaps') {
      autoContent = "Yes, let's work on those gaps. I'd like to build strong bullets for the areas I'm missing."
    }

    const autoMessage: ChatMessage = {
      id: `user-auto-${Date.now()}`,
      role: 'user',
      content: autoContent,
      timestamp: new Date().toISOString(),
    }

    const updatedMessages = [...messages, autoMessage]
    setMessages(updatedMessages)
    setIsLoading(true)

    sendInterviewMessage(updatedMessages, config).then((result) => {
      appendAssistantMessage(result.response)

      if (result.extractedPosition) {
        setExtractedData((prev) => ({
          ...prev,
          positions: [...prev.positions, { position: result.extractedPosition!, bullets: [] }],
        }))
      }

      if (result.extractedEntries && result.extractedEntries.length > 0) {
        setExtractedData((prev) => mergeExtractedEntries(prev, result.extractedEntries!))
      }

      if (!result.shouldContinue) {
        setIsComplete(true)
      }
      setIsLoading(false)
    }).catch((err) => {
      setError(err instanceof Error ? err.message : 'Failed to start interview')
      setIsLoading(false)
    })
  }, [hasInitialized, messages, config, appendAssistantMessage])

  // Notify parent when state changes for persistence
  useEffect(() => {
    if (onStateChange && messages.length > 0) {
      onStateChange(messages, extractedData)
    }
  }, [messages, extractedData, onStateChange])

  // Scroll to bottom when messages or streaming text change (within container only, not page)
  useEffect(() => {
    const container = messagesContainerRef.current
    if (container) {
      container.scrollTop = container.scrollHeight
    }
  }, [messages, streamingText])

  // Focus input when not loading
  useEffect(() => {
    if (!isLoading && !isComplete) {
      inputRef.current?.focus({ preventScroll: true })
    }
  }, [isLoading, isComplete])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading || isTranscribing) return
    const text = input.trim()
    setInput('')
    await submitMessage(text)
  }

  const handleEndInterview = () => {
    setIsComplete(true)
  }

  const handleFinish = () => {
    onComplete(extractedData)
  }

  return (
    <div className="interview-chat" data-testid="interview-chat">
      <div className="interview-header">
        <h2>Career Interview</h2>
        <div className="interview-actions">
          {!isComplete && (
            <button
              type="button"
              onClick={handleEndInterview}
              className="btn-secondary"
              data-testid="interview-end"
            >
              End Interview
            </button>
          )}
          <button
            type="button"
            onClick={onCancel}
            className="btn-secondary"
            data-testid="interview-cancel"
          >
            Cancel
          </button>
        </div>
      </div>

      <div className="interview-persistence-notice" data-testid="persistence-notice">
        <span className="notice-icon">*</span>
        <span>Your progress is saved in this browser only</span>
      </div>

      <VoiceControls
        inputEnabled={voiceSettings.inputEnabled}
        outputEnabled={voiceSettings.outputEnabled}
        voice={voiceSettings.voice}
        isRecording={isRecording}
        micDisabled={isSpeaking}
        analyserNode={analyserNode}
        onInputToggle={() => setInputEnabled(!voiceSettings.inputEnabled)}
        onOutputToggle={() => setOutputEnabled(!voiceSettings.outputEnabled)}
        onVoiceChange={setVoice}
        onMicClick={handleMicClick}
      />

      {isTranscribing && (
        <div className="transcribing-indicator" data-testid="transcribing-indicator">
          Transcribing...
        </div>
      )}

      <div className="messages-container" data-testid="interview-messages" ref={messagesContainerRef}>
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`message message-${msg.role}`}
            data-testid={`message-${msg.role}`}
          >
            <div className="message-avatar">
              {msg.role === 'assistant' ? '🤖' : '👤'}
            </div>
            <div className="message-content">
              {msg.content}
              {msg.role === 'assistant' && voiceSettings.outputEnabled && (
                <button
                  type="button"
                  className={`speak-button ${isSpeaking ? 'speaking' : ''}`}
                  onClick={() => handleSpeak(msg.content)}
                  data-testid="speak-button"
                  aria-label={isSpeaking ? 'Stop speaking' : 'Speak message'}
                  title={isSpeaking ? 'Stop speaking' : 'Speak message'}
                >
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
                    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        ))}
        {streamingText.length > 0 && (
          <div className="message message-assistant" data-testid="message-streaming">
            <div className="message-avatar">🤖</div>
            <div className="message-content">
              {streamingText}
              <span className="streaming-cursor" aria-hidden="true" />
            </div>
          </div>
        )}
        {isLoading && streamingText.length === 0 && (
          <div className="message message-assistant" data-testid="message-loading">
            <div className="message-avatar">🤖</div>
            <div className="message-content typing-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="interview-error" data-testid="interview-error">
          {error}
        </div>
      )}

      {isComplete ? (
        <div className="interview-complete" data-testid="interview-complete">
          <div className="complete-summary">
            <h3>Interview Complete!</h3>
            <p>
              Collected {extractedData.positions.length} position(s) with{' '}
              {extractedData.positions.reduce((sum, p) => sum + p.bullets.length, 0)} bullet(s)
              {(extractedData.entries?.length ?? 0) > 0 && (
                <> and {extractedData.entries!.length} profile entry(ies)</>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={handleFinish}
            className="btn-primary"
            data-testid="interview-finish"
          >
            Save &amp; Continue
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="input-container">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your response..."
            disabled={isLoading}
            className="message-input"
            data-testid="interview-input"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="btn-primary send-button"
            data-testid="interview-send"
          >
            Send
          </button>
        </form>
      )}

      {extractedData.positions.length > 0 && (
        <div className="extracted-preview" data-testid="interview-preview">
          <h4>Captured Data</h4>
          {extractedData.positions.map((p, idx) => (
            <div key={idx} className="preview-position">
              <strong>{p.position.company}</strong> - {p.position.title}
              {p.bullets.length > 0 && (
                <span className="bullet-count">({p.bullets.length} bullets)</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
