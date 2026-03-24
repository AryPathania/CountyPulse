# ADR 008 — Resume Intelligence Layer Architecture

**Status**: Accepted
**Date**: 2026-03-22

## Context

Vector similarity (cosine distance via pgvector) is effective for finding bullets with overlapping vocabulary but cannot reason about semantic connections. For example, "designed distributed APIs serving 10M requests/day" has low cosine similarity to an "Object Oriented Design" requirement, even though API design directly demonstrates OOD principles. This causes false negatives in gap analysis — real coverage is misclassified as a gap, and candidates are told to interview for skills they already have evidence for.

The mechanical pipeline (embed, vector match, threshold classify) produces results that are directionally correct but lack the reasoning needed for accurate coverage assessment.

## Decision

Add a `refine-analysis` edge function as an intelligence layer after vector matching in the gap analysis pipeline. The full pipeline becomes:

```
Parse JD -> Embed -> Vector Match -> Classify -> REFINE (LLM) -> Store
```

The refine step receives the mechanical classification results and all candidate bullets, then uses an `o4-mini` reasoning model (see ADR 007) to re-evaluate each requirement's coverage status.

## Key Design Decisions

### Single LLM call, not multi-step agent
The refine step makes one LLM call with all requirements and bullets in context. This is sufficient for the classification task and avoids the latency and complexity of an agentic loop. The full bullet library fits within context window limits for typical users.

### Three-tier classification
Requirements are classified as:
- **covered** — candidate has strong evidence in existing bullets
- **partially_covered** — some evidence exists but may need strengthening
- **gap** — no meaningful evidence found

### User triage
Each requirement surfaces with action buttons: Include / Add to Interview / Ignore. Buttons block interaction until the user has triaged every requirement, ensuring deliberate decisions rather than passive acceptance.

### Edge function fetches data server-side
The refine-analysis edge function fetches bullets and match results directly from the database using the service role, avoiding the need to ship embedding vectors or large bullet sets from the client.

### LLM selects but never generates
The LLM identifies which existing bullets cover which requirements and recommends bullets for inclusion. It never generates qualification text. All resume content comes from the user. This is a core credibility guardrail.

### Non-blocking fallback
If the refine-analysis call fails (timeout, model error, rate limit), the system falls back to the mechanical vector-match results. The refinement is an enhancement, not a gate.

### Training data from ignored gaps
When a user marks a gap as "Ignore," that signal is stored. Over time, accumulated ignore patterns can inform prompt improvements to reduce false-positive gaps.

## Tradeoffs

- **Latency**: Adds approximately 3-5 seconds to the gap analysis pipeline for the LLM reasoning call.
- **Cost**: One additional LLM call per gap analysis, approximately $0.01-0.03 per invocation with `o4-mini`.
- **Accuracy**: Significant improvement in coverage detection, especially for semantic connections that vector similarity misses.
- **Complexity**: One more edge function to deploy, test, and maintain. Mitigated by the single-purpose design (separation of concerns).

## Consequences

- Gap analysis results are more accurate, reducing false-negative gaps and improving user trust in the system's recommendations.
- The pipeline has a clear separation of concerns: parsing, matching, and refinement are independent edge functions with independent testing and deployment.
- The non-blocking fallback means the system degrades gracefully if the intelligence layer is unavailable.

## References

- `supabase/functions/refine-analysis/index.ts` — intelligence layer edge function
- `supabase/functions/_shared/middleware.ts` — `callReasoningModel()` helper
- `docs/adr/007_model_selection_intelligence_layer.md` — model selection rationale
