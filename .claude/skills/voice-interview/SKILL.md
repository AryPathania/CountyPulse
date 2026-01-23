---
name: voice-interview
description: Voice input/output patterns for interview feature using OpenAI Whisper (STT) and TTS.
---

# Voice Interview Feature

## Purpose
Enable voice input and output during the interview flow, allowing users to speak their responses and hear AI questions.

## Architecture

```
User speaks → [mic] → audio blob → transcribe edge function (Whisper) → text → input field
AI responds → text displayed → speak edge function (TTS) → audio → [speaker]
```

## Key Files

### Edge Functions
- `supabase/functions/transcribe/index.ts` - OpenAI Whisper STT
- `supabase/functions/speak/index.ts` - OpenAI TTS

### UI Hooks
- `packages/ui/src/hooks/useVoiceInput.ts` - MediaRecorder + transcribe API
- `packages/ui/src/hooks/useVoiceOutput.ts` - Audio playback + speak API
- `packages/ui/src/hooks/useVoiceSettings.ts` - Persist voice preferences

### UI Component
- `packages/ui/src/components/interview/VoiceControls.tsx` - Voice control UI

## Testing Patterns

### Mocking MediaRecorder

```typescript
class MockMediaRecorder {
  state: 'inactive' | 'recording' | 'paused' = 'inactive'
  ondataavailable: ((e: { data: Blob }) => void) | null = null
  onstop: (() => void) | null = null
  onerror: (() => void) | null = null

  start() { this.state = 'recording' }
  stop() {
    this.state = 'inactive'
    if (this.ondataavailable) {
      const blob = new Blob(['mock audio'], { type: 'audio/webm' })
      this.ondataavailable({ data: blob })
    }
    setTimeout(() => this.onstop?.(), 0)
  }

  static isTypeSupported(mimeType: string): boolean {
    return mimeType === 'audio/webm' || mimeType === 'audio/mp4'
  }
}

// Usage in test
;(window as any).MediaRecorder = MockMediaRecorder
```

### Mocking Supabase Auth for Voice Hooks

```typescript
const mockGetSession = vi.fn()

vi.mock('@odie/db', () => ({
  supabase: {
    auth: {
      getSession: () => mockGetSession(),
    },
  },
}))

// In beforeEach
mockGetSession.mockResolvedValue({
  data: { session: { access_token: 'test-access-token' } },
})
```

### Mocking Audio Playback

```typescript
let mockAudioInstance = {
  play: vi.fn().mockResolvedValue(undefined),
  pause: vi.fn(),
  src: '',
  currentTime: 0,
  onended: null,
  onerror: null,
}

global.Audio = vi.fn(() => mockAudioInstance) as unknown as typeof Audio
URL.createObjectURL = vi.fn(() => 'blob:mock-url')
URL.revokeObjectURL = vi.fn()
```

## Test IDs

| Test ID | Component | Purpose |
|---------|-----------|---------|
| `voice-input-toggle` | VoiceControls | Mic on/off toggle |
| `voice-output-toggle` | VoiceControls | Speaker on/off toggle |
| `voice-picker` | VoiceControls | Voice selection dropdown |
| `mic-button` | VoiceControls | Microphone record button |
| `speak-button` | InterviewChat | Per-message speak button |
| `recording-indicator` | VoiceControls | Visual recording feedback |

## Available Voices

| Voice | Description |
|-------|-------------|
| alloy | Neutral and balanced |
| echo | Warm and conversational |
| fable | Expressive and storytelling |
| onyx | Deep and authoritative |
| nova (default) | Friendly and professional |
| shimmer | Clear and bright |

## Edge Function Deployment

```bash
supabase functions deploy transcribe
supabase functions deploy speak
```

## Settings Persistence

Voice settings are stored in localStorage under key `voice-settings`:

```typescript
interface VoiceSettings {
  inputEnabled: boolean   // default: false
  outputEnabled: boolean  // default: false
  voice: string          // default: 'nova'
}
```

## API Costs (Reference)

- **Whisper**: $0.006 per minute of audio
- **TTS**: $0.015 per 1,000 characters
- **Typical interview**: ~$0.10 total
