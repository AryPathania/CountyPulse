---
name: prompt-versioning
description: Prompt versioning and evaluation harness patterns. Use when working with LLM prompts, creating new prompts, or setting up evaluation.
---

# Prompt Versioning + Evaluation Harness

## Hard rule
Prompts are code.

## Storage
- `packages/shared/src/prompts/<prompt_name>/v001.md`
- Each prompt has:
  - intent
  - inputs
  - outputs (JSON schema)
  - examples
  - failure modes

## Runtime
Every LLM call logs:
- prompt_id (name + version)
- model
- temperature
- input hash
- output
- token usage (if available)
- latency
- success/fail label

## Evaluation
Create a tiny "golden set" early:
- 10 interview transcripts
- 10 bullet normalization expected outputs
- 10 JDs + expected chosen bullets (approx)

You can't fine-tune or prompt-iterate without eval data.
Collect it from day one.
