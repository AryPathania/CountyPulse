# Spec: Telemetry + logs for continuous improvement

Status: Draft  
Owner: Pipeline Agent + DB Agent  
Date: 2026-01-10

## Goal
Collect just enough data to:
- improve prompts
- fine-tune later
- learn what users actually edit

## What to log
1) Runs table entries for every LLM call (prompt_id, model, input, output, latency)
2) Bullet evolution:
   - original_text
   - current_text
   - was_edited
3) Draft outcomes:
   - JD pasted
   - retrieved bullet IDs
   - selected bullet IDs
4) Optional user outcome:
   - interview/offer/reject (later)

## Cost control
- Store full JD text in MVP, but add retention controls later.
- Consider hashing JD text and storing only embedding + extracted requirements once stable.

## Acceptance criteria
- Every LLM call creates a `runs` row
- Bullets preserve original_text forever

## Test plan
- Integration:
  - generate draft → `runs` row exists
- Unit:
  - `was_edited` computed correctly

