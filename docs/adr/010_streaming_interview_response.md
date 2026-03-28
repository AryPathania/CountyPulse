# ADR 010 — Streaming Interview Response

**Status**: Accepted
**Date**: 2026-03-27

## Context

The interview edge function previously batched the full LLM response before returning it as JSON. The client received the complete response after a 3–5 second wait, displayed the text, and only then began fetching TTS audio. This created a noticeable latency before the user heard any speech.

Voice is the primary use case for the interview flow. The goal was to reduce time-to-first-speech from ~3.5–5.5s to under 2s by starting TTS as soon as the first complete sentence arrives from the model.

### The JSON mode field-ordering problem

The obvious approach — scanning the raw JSON stream for the `"response":` key — is fragile with JSON mode (`response_format: { type: 'json_object' }`). JSON mode does not guarantee field emission order; GPT-4o could emit `shouldContinue` or `extractedBullets` before `response`. There is no documented order contract.

## Decision

Switch the interview edge function from JSON mode to **OpenAI Structured Outputs** (`response_format: { type: 'json_schema', ... }`) with `stream: true`. Define the schema with `response` as the first property. Structured Outputs emit fields in schema-defined order, so the `response` value streams out before any other field — this is the field ordering guarantee JSON mode does not provide.

Add **conditional SSE streaming** to the `interview` edge function. When the request body includes `stream: true`, the function returns `text/event-stream`. When `stream` is absent or `false`, it returns JSON as before (full backward compatibility — `sendInterviewMessage()` is unchanged).

### SSE protocol (4 event types)

```
data: {"type":"text_delta","text":"<word or punctuation chunk>"}
data: {"type":"sentence","text":"<complete sentence (30+ chars, ends .!?)>"}
data: {"type":"done","data":{<full parsed InterviewStepResponse>}}
data: {"type":"error","message":"<msg>"}   ← only on post-stream failure
```

### Single LLM call maintained

The alternative of splitting the response into two calls (one for the `response` text, one for extracted data) was rejected. Two independent model calls can produce contradictory outputs — extracted bullets may not match what was said in the conversational response. A single call preserves coherence.

### Post-stream telemetry

`logRun` is called after the stream closes using `ctx.waitUntil` (from `HandlerContext`) so the Deno isolate stays alive for the async DB write. Falls back to fire-and-forget in local dev where `EdgeRuntime.waitUntil` may not be available.

### Error handling

- Pre-stream errors (auth failure, context-window build failure): return JSON error response as before.
- Post-stream errors (parse failure, stream interruption): emit `{"type":"error","message":"..."}` as final SSE event and close the stream.
- The frontend `streamFunctionCall` utility detects pre-stream JSON responses via `Content-Type` header inspection and routes them to `onError`.

## Alternatives Rejected

| Alternative | Reason rejected |
|-------------|----------------|
| Two-call split (text call + data call) | Two independent LLM samples can contradict each other; coherence risk |
| JSON mode streaming + scan for `"response":` key | Field emission order not guaranteed in JSON mode; fragile |
| Client-side polling / WebSocket | SSE is simpler for server-push one-way streams; no persistent connection needed |

## Tradeoffs

- **Streaming JSON parser complexity**: The server-side parser in `buildStreamingResponse` (~80 lines) tracks a state machine to extract the `response` field character by character from the streaming token deltas. This is more complex than a simple `JSON.parse()` call.
- **Structured Outputs vs JSON mode**: Structured Outputs require an explicit JSON schema definition that must stay in sync with `InterviewStepResponseSchema` in `@odie/shared`. The schema is defined inline in the edge function as a plain object with an explicit field order (TypeScript/Zod object key order is not a deployment guarantee across all runtimes).
- **Local dev `waitUntil` gap**: `EdgeRuntime.waitUntil` is not available in `supabase start` local dev. Telemetry uses fire-and-forget fallback locally; this is acceptable since telemetry is non-critical.

## Consequences

- Time-to-first-speech improves from ~3.5–5.5s to ~0.9–1.8s for voice mode users.
- Text mode users see progressive text rendering in the streaming bubble.
- The non-streaming path (`sendInterviewMessage`) continues to work unchanged for tests and any callers that do not pass `stream: true`.
- `streamChatCompletion()` is added to `supabase/functions/_shared/middleware.ts` as an additive export; `callChatCompletion()` is untouched.

## References

- `supabase/functions/interview/index.ts` — SSE streaming handler, structured output schema, conditional `stream` flag
- `supabase/functions/_shared/middleware.ts` — `streamChatCompletion()`, `HandlerContext.waitUntil`
- `packages/ui/src/services/supabase-stream.ts` — `streamFunctionCall()` utility
- `packages/ui/src/services/interview.ts` — `streamInterviewMessage()`
- `packages/ui/src/components/interview/InterviewChat.tsx` — streaming bubble, `onSentence` → `speakSentence` dispatch
- `docs/adr/011_sentence_level_tts_queue.md` — sentence queue decision
