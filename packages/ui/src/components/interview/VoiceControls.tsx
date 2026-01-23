import './VoiceControls.css'

export interface VoiceControlsProps {
  inputEnabled: boolean
  outputEnabled: boolean
  voice: string
  isRecording: boolean
  onInputToggle: () => void
  onOutputToggle: () => void
  onVoiceChange: (voice: string) => void
  onMicClick: () => void
}

const AVAILABLE_VOICES = [
  { id: 'alloy', label: 'Alloy' },
  { id: 'echo', label: 'Echo' },
  { id: 'fable', label: 'Fable' },
  { id: 'onyx', label: 'Onyx' },
  { id: 'nova', label: 'Nova' },
  { id: 'shimmer', label: 'Shimmer' },
]

/**
 * UI component for voice controls in the interview chat.
 * Provides toggles for voice input/output, voice selection, and microphone button.
 */
export function VoiceControls({
  inputEnabled,
  outputEnabled,
  voice,
  isRecording,
  onInputToggle,
  onOutputToggle,
  onVoiceChange,
  onMicClick,
}: VoiceControlsProps) {
  return (
    <div className="voice-controls" data-testid="voice-controls">
      <div className="voice-toggles">
        <button
          type="button"
          className={`voice-toggle ${inputEnabled ? 'active' : ''}`}
          onClick={onInputToggle}
          data-testid="voice-input-toggle"
          aria-pressed={inputEnabled}
          title="Toggle voice input"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
          </svg>
          <span>Voice In</span>
        </button>

        <button
          type="button"
          className={`voice-toggle ${outputEnabled ? 'active' : ''}`}
          onClick={onOutputToggle}
          data-testid="voice-output-toggle"
          aria-pressed={outputEnabled}
          title="Toggle voice output"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
          </svg>
          <span>Voice Out</span>
        </button>
      </div>

      <div className="voice-picker-container">
        <label htmlFor="voice-picker" className="sr-only">
          Select voice
        </label>
        <select
          id="voice-picker"
          className="voice-picker"
          value={voice}
          onChange={(e) => onVoiceChange(e.target.value)}
          data-testid="voice-picker"
          disabled={!outputEnabled}
        >
          {AVAILABLE_VOICES.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </select>
      </div>

      {inputEnabled && (
        <button
          type="button"
          className={`mic-button ${isRecording ? 'recording' : ''}`}
          onClick={onMicClick}
          data-testid="mic-button"
          aria-label={isRecording ? 'Stop recording' : 'Start recording'}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
          </svg>
          {isRecording && (
            <span className="recording-indicator" data-testid="recording-indicator" />
          )}
        </button>
      )}
    </div>
  )
}
