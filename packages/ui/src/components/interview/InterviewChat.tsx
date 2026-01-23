import { useState, useRef, useEffect, useCallback } from 'react'
import type { ChatMessage, ExtractedInterviewData } from '@odie/shared'
import {
  sendInterviewMessage,
  getInitialMessage,
  resetMockState,
  type InterviewServiceConfig,
} from '../../services/interview'
import { useVoiceInput } from '../../hooks/useVoiceInput'
import { useVoiceOutput } from '../../hooks/useVoiceOutput'
import { useVoiceSettings } from '../../hooks/useVoiceSettings'
import { VoiceControls } from './VoiceControls'
import './InterviewChat.css'
import './VoiceControls.css'

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
  const [error, setError] = useState<string | null>(null)
  const [isComplete, setIsComplete] = useState(false)
  const [extractedData, setExtractedData] = useState<ExtractedInterviewData>(
    initialExtractedData ?? { positions: [] }
  )
  const [hasInitialized, setHasInitialized] = useState(!!initialMessages?.length)

  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Voice settings and hooks
  const { settings: voiceSettings, setInputEnabled, setOutputEnabled, setVoice } = useVoiceSettings()

  const handleTranscript = useCallback((text: string) => {
    setInput((prev) => (prev ? `${prev} ${text}` : text))
    inputRef.current?.focus({ preventScroll: true })
  }, [])

  const { isRecording, isTranscribing, startRecording, stopRecording } = useVoiceInput({
    onTranscript: handleTranscript,
  })

  const { isSpeaking, speak, stop: stopSpeaking } = useVoiceOutput({
    voice: voiceSettings.voice,
  })

  const handleMicClick = useCallback(() => {
    if (isRecording) {
      stopRecording()
    } else {
      startRecording()
    }
  }, [isRecording, startRecording, stopRecording])

  const handleSpeak = useCallback((text: string) => {
    if (isSpeaking) {
      stopSpeaking()
    } else {
      speak(text)
    }
  }, [isSpeaking, speak, stopSpeaking])

  // Initialize chat with greeting (only if no initial messages provided)
  useEffect(() => {
    if (hasInitialized) return

    if (config?.useMock) {
      resetMockState()
    }
    const initialMessage = getInitialMessage()
    setMessages([initialMessage])
    setHasInitialized(true)
  }, [config?.useMock, hasInitialized])

  // Notify parent when state changes for persistence
  useEffect(() => {
    if (onStateChange && messages.length > 0) {
      onStateChange(messages, extractedData)
    }
  }, [messages, extractedData, onStateChange])

  // Scroll to bottom when messages change (within container only, not page)
  useEffect(() => {
    const container = messagesContainerRef.current
    if (container) {
      container.scrollTop = container.scrollHeight
    }
  }, [messages])

  // Focus input when not loading
  useEffect(() => {
    if (!isLoading && !isComplete) {
      inputRef.current?.focus({ preventScroll: true })
    }
  }, [isLoading, isComplete])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString(),
    }

    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages)
    setInput('')
    setIsLoading(true)
    setError(null)

    try {
      const result = await sendInterviewMessage(updatedMessages, config)

      // Create assistant message
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: result.response,
        timestamp: new Date().toISOString(),
      }

      setMessages((prev) => [...prev, assistantMessage])

      // Auto-play AI response if voice output is enabled
      if (voiceSettings.outputEnabled) {
        speak(result.response)
      }

      // Handle extracted data
      if (result.extractedPosition) {
        setExtractedData((prev) => {
          const existingIndex = prev.positions.findIndex(
            (p) =>
              p.position.company === result.extractedPosition?.company &&
              p.position.title === result.extractedPosition?.title
          )

          if (existingIndex >= 0) {
            // Update existing position
            const updated = [...prev.positions]
            updated[existingIndex] = {
              ...updated[existingIndex],
              position: { ...updated[existingIndex].position, ...result.extractedPosition },
            }
            return { positions: updated }
          } else {
            // Add new position
            return {
              positions: [
                ...prev.positions,
                { position: result.extractedPosition!, bullets: [] },
              ],
            }
          }
        })
      }

      if (result.extractedBullets && result.extractedBullets.length > 0) {
        setExtractedData((prev) => {
          if (prev.positions.length === 0) return prev
          const updated = [...prev.positions]
          const lastIndex = updated.length - 1
          // Deduplicate: only add bullets whose text doesn't already exist
          const existingTexts = new Set(updated[lastIndex].bullets.map((b) => b.text))
          const newBullets = result.extractedBullets!.filter((b) => !existingTexts.has(b.text))
          if (newBullets.length === 0) return prev
          updated[lastIndex] = {
            ...updated[lastIndex],
            bullets: [...updated[lastIndex].bullets, ...newBullets],
          }
          return { positions: updated }
        })
      }

      if (!result.shouldContinue) {
        setIsComplete(true)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message')
    } finally {
      setIsLoading(false)
    }
  }

  const handleEndInterview = () => {
    setIsComplete(true)
    onComplete(extractedData)
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
        {isLoading && (
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
