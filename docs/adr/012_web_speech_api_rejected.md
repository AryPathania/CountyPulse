# ADR 012 — Web Speech API Rejected for Transcription Preview; Waveform Visualizer Chosen

**Status**: Accepted
**Date**: 2026-03-27

## Context

The voice interview user experience had a dead period between when the user stopped recording and when Whisper transcription completed. The "Recording..." static indicator gave no live feedback during recording, and the transcription delay (1–2s) was invisible — users had no confirmation that their audio was being captured.

Two approaches were considered to improve this feedback:
1. Show the user's words as they speak using Web Speech API interim results.
2. Show a live audio waveform animation to confirm the microphone is active and receiving audio.

## Decision

Use an **`AnalyserNode` waveform visualizer** on the existing `MediaStream` from `useVoiceInput`. No second API, no additional browser permissions, no extra streams.

`useVoiceInput` exposes `analyserNode: AnalyserNode | null` in its return type. `InterviewChat.tsx` threads it to `VoiceControls.tsx` as an optional prop. `VoiceControls` renders animated CSS bars sampled from the `AnalyserNode` frequency data at ~60fps via `requestAnimationFrame`. The visualizer is active only while `analyserNode` is non-null (i.e., during recording).

## Why Web Speech API Was Rejected

### Dual-stream microphone conflict

Running both `MediaRecorder` (for Whisper) and `SpeechRecognition` (for interim results) simultaneously requires two microphone streams. There is no documented browser guarantee that claiming two concurrent streams from the same microphone device is safe across Chrome, Safari, Firefox, and mobile browsers. In practice, one stream can suppress or corrupt the other, or the browser may reject the second `getUserMedia` call entirely.

### Interim result flicker degrades UX

Web Speech API interim results are frequently wrong for technical terms — company names, tech stack names, product names, and acronyms. The interim text appears, then is replaced by the corrected Whisper result a second later. This creates visible text flicker: the user sees wrong words, then right words. This is objectively worse UX than a clean loading state with a waveform confirming audio capture.

### Browser divergence

Web Speech API behavior differs significantly across browsers. Safari's implementation has known gaps. Interim results are not guaranteed in all implementations. The waveform uses only `AudioContext` and `AnalyserNode`, which are part of the Web Audio API and have consistent cross-browser support.

## Alternatives Rejected

| Alternative | Reason rejected |
|-------------|----------------|
| Web Speech API interim results | Dual-stream microphone conflict; interim text flicker for technical terms; browser divergence |
| Chunked Whisper streaming | WebM audio cannot be split mid-stream and reassembled reliably; context loss at chunk boundaries would require overlapping windows, adding complexity |
| Static "Recording..." text | Already the status quo; provides no live feedback; rejected as insufficient |

## Tradeoffs

- **No word preview**: Users see a waveform but not their words in real time. This is a known limitation accepted for the reasons above. Whisper transcription still appears in the input box after recording stops (1–2s latency).
- **`AnalyserNode` overhead**: Sampling frequency data at 60fps is negligible CPU cost. The `AnalyserNode` is attached to the same `MediaStream` already captured by `MediaRecorder` — no additional media processing.
- **One more prop thread**: `analyserNode` is threaded from `useVoiceInput` → `InterviewChat` → `VoiceControls`. This is a minor coupling increase; the prop is optional and the component degrades gracefully when `null`.

## Consequences

- Users see an animated waveform during recording, confirming audio capture without any additional API calls, browser permissions, or streams.
- No dual-stream microphone conflict risk.
- Whisper remains the sole transcription source; no risk of interim/final result mismatch.
- The `useVoiceInput` public interface gains one new optional field (`analyserNode`); all existing callers are unaffected.

## References

- `packages/ui/src/hooks/useVoiceInput.ts` — `analyserNode` exposed in return type
- `packages/ui/src/components/interview/VoiceControls.tsx` — waveform visualizer using `AnalyserNode`
- `packages/ui/src/components/interview/InterviewChat.tsx` — threads `analyserNode` prop to `VoiceControls`
