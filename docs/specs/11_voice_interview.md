# Spec: Voice Interview (OpenAI Whisper STT + TTS)

Status: Draft
Owner: UI Agent + Pipeline Agent
Date: 2026-01-22

## Goals
- Enable voice input via microphone (uses OpenAI Whisper for transcription)
- Enable voice output via speaker (uses OpenAI TTS)
- Voice is optional - text conversation always works
- Users can toggle voice input and voice output independently
- Users can select AI voice from available options
- Settings persist across sessions (localStorage)

## Non-Goals (Out of Scope)
- Edit previous responses (future feature)
- Real-time streaming transcription (batch only for MVP)
- Custom voice training
- Voice cloning
- Offline voice processing

## User Stories

### US-1: Voice Input
As a user, I want to speak my interview responses instead of typing so that the interview feels more natural and conversational.

### US-2: Voice Output
As a user, I want to hear the AI interviewer speak questions so I can listen instead of reading.

### US-3: Independent Voice Input Toggle
As a user, I want to toggle voice input on/off independently so I can type when I prefer or when in a quiet environment.

### US-4: Independent Voice Output Toggle
As a user, I want to toggle voice output on/off independently so I can read responses when I cannot use speakers.

### US-5: Voice Selection
As a user, I want to select which AI voice is used so I can choose a voice I find pleasant.

### US-6: Persistent Preferences
As a user, I want my voice preferences to persist when I return so I do not have to reconfigure each session.

## Architecture

### Data Flow
```
Voice Input Flow:
User speaks -> [mic] -> MediaRecorder -> audio blob -> transcribe edge function (Whisper) -> text -> input field

Voice Output Flow:
AI responds -> text displayed -> speak edge function (TTS) -> audio blob -> AudioContext -> [speaker]
```

### Components
```
InterviewPage
  |-- VoiceControls
  |     |-- VoiceInputToggle (data-testid="voice-input-toggle")
  |     |-- VoiceOutputToggle (data-testid="voice-output-toggle")
  |     |-- VoicePicker (data-testid="voice-picker")
  |-- MicButton (data-testid="mic-button")
  |     |-- RecordingIndicator (data-testid="recording-indicator")
  |-- ChatThread
  |     |-- MessageBubble
  |           |-- SpeakButton (data-testid="speak-button")
  |           |-- SpeakingIndicator (data-testid="speaking-indicator")
```

### Edge Functions
1. `transcribe` - Accepts audio blob, returns transcribed text via OpenAI Whisper
2. `speak` - Accepts text + voice selection, returns audio blob via OpenAI TTS

### Hooks
- `useVoiceInput()` - Manages microphone recording state and transcription
- `useVoiceOutput()` - Manages TTS playback and audio queue
- `useVoiceSettings()` - Manages voice preferences in localStorage

## UI

### Voice Controls Bar
Location: Top of interview page, below navigation
Layout: Horizontal bar with toggle switches and voice picker

```
[Mic: ON/OFF] [Speaker: ON/OFF] [Voice: alloy v]
```

### Mic Button
Location: Next to text input field
States:
- Idle: Microphone icon
- Recording: Pulsing red indicator, "Recording..." text
- Processing: Spinner, "Transcribing..." text

### Speak Button
Location: On each AI message bubble
States:
- Idle: Speaker icon
- Playing: Animated sound waves
- Loading: Spinner

### Visual Indicators
- `recording-indicator`: Red pulsing dot when recording
- `speaking-indicator`: Animated speaker waves when playing

## Voice Options

OpenAI TTS voices (MVP):
- `alloy` (default) - Neutral
- `echo` - Male
- `fable` - British
- `onyx` - Deep male
- `nova` - Female
- `shimmer` - Soft female

## Settings Persistence

localStorage key: `odie_voice_settings`

```json
{
  "voiceInputEnabled": true,
  "voiceOutputEnabled": true,
  "selectedVoice": "alloy"
}
```

## API Contracts

### POST /functions/v1/transcribe

Request:
```
Content-Type: multipart/form-data
Body: { audio: Blob (webm/wav) }
```

Response:
```json
{
  "text": "transcribed text here",
  "duration_seconds": 3.5
}
```

Errors:
- 400: Invalid audio format
- 413: Audio too long (>60 seconds for MVP)
- 500: Transcription failed

### POST /functions/v1/speak

Request:
```json
{
  "text": "Hello, tell me about your experience...",
  "voice": "alloy"
}
```

Response:
```
Content-Type: audio/mpeg
Body: audio blob
```

Errors:
- 400: Text too long (>4096 chars)
- 400: Invalid voice selection
- 500: TTS failed

## Acceptance Criteria (Testable)

### AC-1: Voice Controls Visible
- [ ] Voice controls bar appears on interview page
- [ ] Controls include: voice input toggle, voice output toggle, voice picker

### AC-2: Mic Button Recording State
- [ ] Mic button shows idle state when not recording
- [ ] Mic button shows recording state (pulsing indicator) when active
- [ ] Recording indicator (data-testid="recording-indicator") visible during recording

### AC-3: Transcription Flow
- [ ] Clicking mic button starts recording
- [ ] Clicking mic button again stops recording
- [ ] Transcribed text appears in input field after processing
- [ ] User can edit transcribed text before sending

### AC-4: TTS Playback
- [ ] AI responses automatically play audio when voice output is enabled
- [ ] Per-message speak button allows replaying AI messages
- [ ] Speaking indicator visible during playback

### AC-5: Voice Picker
- [ ] Voice picker dropdown shows all available voices
- [ ] Selecting a voice updates future TTS requests
- [ ] Selected voice applies to automatic playback and manual speak buttons

### AC-6: Settings Persistence
- [ ] Voice input toggle state persists to localStorage
- [ ] Voice output toggle state persists to localStorage
- [ ] Selected voice persists to localStorage
- [ ] Settings restore correctly on page reload

### AC-7: Graceful Degradation
- [ ] Feature works when only voice input is enabled
- [ ] Feature works when only voice output is enabled
- [ ] Text input always available regardless of voice settings
- [ ] Text conversation always displayed regardless of voice settings

## Edge Cases

### EC-1: Microphone Permission Denied
- Show clear error message: "Microphone access denied. Please enable in browser settings."
- Disable voice input toggle
- Voice output still works

### EC-2: No Microphone Available
- Show error message: "No microphone detected."
- Disable voice input toggle
- Voice output still works

### EC-3: Network Error During Transcription
- Show error toast: "Transcription failed. Please try again or type your response."
- Recording is discarded
- User can retry or fall back to typing

### EC-4: Network Error During TTS
- Show error toast: "Audio playback failed."
- Text response is still displayed
- Speak button shows error state, can retry

### EC-5: Unsupported Browser (No MediaRecorder)
- Hide voice input controls entirely
- Show tooltip: "Voice input not supported in this browser"
- Voice output may still work if AudioContext supported

### EC-6: User Interrupts Playback
- Stop current audio immediately
- Clear audio queue
- No error shown

### EC-7: User Stops Recording Before Speaking
- Discard empty recording
- Show brief feedback: "No speech detected"
- Return to idle state

### EC-8: Long Audio Recording
- Enforce 60-second limit in MVP
- Auto-stop at limit with message: "Recording limit reached"
- Process the captured audio

### EC-9: Multiple Rapid Toggles
- Debounce toggle state changes (100ms)
- Cancel in-flight requests when disabled

### EC-10: Page Navigation During Recording/Playback
- Stop recording and discard audio
- Stop playback
- Clean up AudioContext resources

## Test Plan

### Unit Tests (Vitest + Testing Library)

#### Hook Tests
- `useVoiceSettings`
  - Loads default settings when localStorage empty
  - Loads saved settings from localStorage
  - Persists changes to localStorage
  - Returns correct toggle handlers

- `useVoiceInput` (with mocked MediaRecorder)
  - Starts recording when triggered
  - Stops recording and returns blob
  - Handles permission denied error
  - Handles no microphone error
  - Respects 60-second limit

- `useVoiceOutput` (with mocked AudioContext)
  - Plays audio when given blob
  - Stops playback when requested
  - Queues multiple audio requests
  - Cleans up on unmount

#### Component Tests
- `VoiceControls`
  - Renders all controls
  - Toggles update settings
  - Voice picker shows options
  - Disabled states work correctly

- `MicButton`
  - Shows correct state icons
  - Calls start/stop handlers
  - Displays recording indicator

- `SpeakButton`
  - Shows correct state icons
  - Calls speak handler
  - Displays speaking indicator

### Integration Tests

#### API Mocking (MSW)
- Transcribe endpoint returns text
- Transcribe endpoint handles errors
- Speak endpoint returns audio
- Speak endpoint handles errors

#### Flow Tests
- Complete voice input flow (mock MediaRecorder + API)
- Complete voice output flow (mock AudioContext + API)
- Settings persistence across component remounts

### E2E Tests (Playwright)

#### Permission Mocking
```typescript
// Grant microphone permission
await context.grantPermissions(['microphone']);

// Deny microphone permission
await context.clearPermissions();
```

#### Test Cases
1. `voice-controls-visible.spec.ts`
   - Voice controls appear on interview page
   - All toggles and picker are interactive

2. `voice-input-toggle.spec.ts`
   - Toggle enables/disables mic button
   - State persists after reload

3. `voice-output-toggle.spec.ts`
   - Toggle controls automatic playback
   - Speak buttons still work when toggle off

4. `voice-picker.spec.ts`
   - Dropdown shows all voice options
   - Selection persists after reload

5. `mic-button-states.spec.ts`
   - Idle -> Recording -> Processing states
   - Recording indicator visibility

6. `speak-button-states.spec.ts`
   - Idle -> Playing states
   - Speaking indicator visibility

7. `permission-denied.spec.ts`
   - Error message shown
   - Voice input disabled
   - Voice output still works

8. `graceful-degradation.spec.ts`
   - Text always works
   - Independent toggle behavior

### Manual Testing Checklist
- [ ] Record and transcribe actual speech
- [ ] Verify transcription accuracy
- [ ] Listen to TTS output quality
- [ ] Test all 6 voice options
- [ ] Test on Chrome, Firefox, Safari
- [ ] Test on mobile browsers
- [ ] Test with slow network (throttle)
- [ ] Test with intermittent network

## Test IDs Reference

| Test ID | Element | Purpose |
|---------|---------|---------|
| `voice-input-toggle` | Toggle switch | Enable/disable microphone input |
| `voice-output-toggle` | Toggle switch | Enable/disable speaker output |
| `voice-picker` | Select dropdown | Choose AI voice |
| `mic-button` | Button | Start/stop recording |
| `speak-button` | Button | Replay AI message audio |
| `recording-indicator` | Visual element | Show recording in progress |
| `speaking-indicator` | Visual element | Show audio playing |

## Dependencies

### NPM Packages
- None required (uses native Web APIs)

### Web APIs Used
- `MediaRecorder` - Audio recording
- `AudioContext` - Audio playback
- `navigator.mediaDevices.getUserMedia` - Microphone access

### External Services
- OpenAI Whisper API (via edge function)
- OpenAI TTS API (via edge function)

## Environment Variables

```env
# Already exists
OPENAI_API_KEY=...  # Used by edge functions
```

## Security Considerations

- Audio is processed server-side (no client-side API keys)
- Audio is not stored permanently (processed and discarded)
- User must grant microphone permission
- Rate limiting on edge functions (prevent abuse)

## Performance Considerations

- Audio compression before upload (webm preferred)
- Maximum recording duration: 60 seconds
- TTS text limit: 4096 characters
- Audio caching: None in MVP (each play is fresh request)
- Cleanup AudioContext on unmount to prevent memory leaks

## Future Enhancements (Post-MVP)

- Real-time streaming transcription
- Voice activity detection (auto-stop when silence)
- Audio waveform visualization
- Keyboard shortcuts (spacebar to record)
- Custom wake word
- Offline mode with local models
