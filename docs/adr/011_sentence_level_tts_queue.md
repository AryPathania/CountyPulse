# ADR 011 — Sentence-Level TTS Queue

**Status**: Accepted
**Date**: 2026-03-27

## Context

Before streaming was added, the voice interview flow called `speak(fullText)` once after the complete LLM response arrived. The `speak` edge function received the entire response text, called OpenAI TTS once, and returned a single audio file. This produced one network round-trip and one TTS API call per interview turn, but audio playback could not begin until the full response was received and TTS was fetched — adding ~500ms on top of the 3–5s wait for the LLM response.

With SSE streaming (ADR 010), sentences arrive individually via `sentence` events as the model generates them. The TTS system needs to handle a sequence of short texts rather than one long text, and should start playing the first sentence before the last sentence has even been generated.

## Decision

Add a **drain-on-end sentence queue** inside `useVoiceOutput`. Each `speakSentence(text)` call:

1. Creates a new `AbortController` for that item at enqueue time.
2. Pushes `{ text, controller }` onto the queue.
3. If nothing is currently playing, immediately starts `drainQueue()`.

`drainQueue` shifts the next item from the front of the queue, fetches TTS audio, plays it, and calls itself again from `audio.onended`. The queue drains item by item.

`stop()` aborts all controllers in the queue (including items not yet fetching), clears the array, stops the current audio, and sets `isPlayingRef` to false.

`speak()` (full-text, single-call) remains unchanged for backward compatibility and for text mode where sentence-level dispatch is not used.

### Why `AbortController` per item at enqueue time

The controller is created when the item is enqueued, not when its fetch starts. This means `stop()` can cancel all pending items — including those waiting in the queue — by aborting their controllers. If the controller were created only at fetch time, items still in the queue would have no handle to cancel them.

### TTS cost tradeoff

Each `speakSentence` call is a separate request to the `speak` edge function, which makes one OpenAI TTS API call. A 3-sentence response generates 3 TTS API calls instead of 1. TTS cost is proportional to character count regardless of how calls are batched (OpenAI charges per character), so the cost increase is the per-request overhead, not the per-character cost. This overhead is accepted for MVP given the latency improvement (~1.5s sooner first speech). Revisit if TTS per-request costs become significant at scale.

### No pre-fetch

A more aggressive design would pre-fetch TTS for the next sentence while the current sentence is playing, eliminating the silence gap between sentences. This was rejected for MVP:
- Saves at most ~400ms per sentence boundary
- Roughly doubles implementation complexity (two concurrent fetches in flight at once)
- Requires more careful `AbortController` management
- TTS API cost management becomes more complex (pre-fetched audio may be discarded if `stop()` is called)

## Alternatives Rejected

| Alternative | Reason rejected |
|-------------|----------------|
| Single `speak(fullText)` call after `done` event | Loses all streaming latency benefit; audio starts ~1.5s later |
| Pre-fetch queue (fetch N+1 while N plays) | Saves <500ms, doubles complexity, triples cost management surface |
| Web Audio API with concatenated audio buffers | Significantly more complex; browser compatibility risk; no benefit over sequential `Audio` elements |

## Tradeoffs

- **N TTS calls vs 1**: Per-request overhead added for each sentence. Acceptable at MVP scale.
- **Silence gap between sentences**: If a sentence's TTS fetch takes longer than the previous sentence's playback, there will be a brief silence. Typical ~350–500ms TTS latency for short sentences; this is generally not noticeable for conversational pacing.
- **Sentence boundary false positives**: Sentence detection uses 30-character minimum + `.!?` followed by optional whitespace. Abbreviations like "Dr." or "U.S." below the character threshold are not treated as boundaries.

## Consequences

- Voice interview users hear the first sentence of the AI response ~1.5s sooner than before.
- Subsequent sentences play sequentially as each TTS fetch completes.
- The user can start their next message (type or record) as soon as the `done` SSE event fires — they do not need to wait for TTS to finish. `isLoading` is set to `false` on `done`, not on TTS end.
- `speakSentence` is a new export on `UseVoiceOutputReturn`; `speak` is unchanged.

## References

- `packages/ui/src/hooks/useVoiceOutput.ts` — `speakSentence()`, `drainQueue()`, `SentenceQueueItem`, `stop()` queue teardown
- `supabase/functions/speak/index.ts` — TTS edge function (unchanged; handles one text string per call)
- `docs/adr/010_streaming_interview_response.md` — SSE streaming that produces `sentence` events
