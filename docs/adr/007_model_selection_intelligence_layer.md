# ADR 007 — Model Selection for Intelligence Layer

**Status**: Accepted
**Date**: 2026-03-22

## Context

The gap analysis pipeline requires two distinct LLM tasks:

1. **JD parsing** — structured extraction of requirements from job description text into a typed schema (importance levels, categories, requirement text)
2. **Refine-analysis** — semantic reasoning about whether a candidate's bullets actually satisfy each requirement, even when surface-level similarity is low

These tasks have fundamentally different cognitive profiles. JD parsing is a structured extraction task that benefits from strong instruction following and schema adherence. Refine-analysis requires multi-step logical reasoning: "does designing distributed APIs demonstrate knowledge of Object Oriented Design?" requires understanding what skills are implied by an accomplishment.

## Decision

- **JD parsing**: Keep `gpt-4o`. It is proven for structured extraction with reliable schema conformance.
- **Refine-analysis**: Use `o4-mini` via a new `callReasoningModel()` helper in `middleware.ts`.

The `callReasoningModel()` helper handles the API contract differences between reasoning models and standard chat models:
- Uses `developer` role instead of `system` role
- Omits `temperature` parameter (reasoning models do not support it)
- Uses `max_completion_tokens` instead of `max_tokens`

## Rationale

- Refine-analysis requires multi-step logical reasoning (does this bullet satisfy this requirement?) — reasoning models are specifically designed for this class of problem.
- `o4-mini` is cheaper than `gpt-4o` for equivalent or better reasoning quality on classification tasks.
- JD parsing does not benefit from chain-of-thought reasoning; it benefits from precise instruction following where `gpt-4o` is already proven.
- Separating the model choice per task allows independent optimization without coupling.

## Tradeoffs

- **API contract differences**: Reasoning models have a different API contract (no temperature, developer role, different token parameter). The `callReasoningModel()` helper encapsulates this, but it is another code path to maintain.
- **Fallback strategy**: If `o4-mini` proves unreliable or is deprecated, the system falls back to `gpt-4o` for refine-analysis. The prompt structure is compatible with both.
- **Vendor lock-in**: Both models are OpenAI. A model-agnostic abstraction for non-OpenAI models is out of scope but noted as a future consideration.

## Consequences

- Edge functions now use two distinct model calling paths: `callModel()` for standard chat completions and `callReasoningModel()` for reasoning tasks.
- Cost per gap analysis increases by approximately $0.01-0.03 for the refine-analysis call, offset by using the cheaper `o4-mini` instead of `gpt-4o`.

## References

- `supabase/functions/_shared/middleware.ts` — `callReasoningModel()` helper
- `supabase/functions/refine-analysis/index.ts` — intelligence layer edge function
- `supabase/functions/parse-jd/index.ts` — JD parsing (unchanged, uses `gpt-4o`)
