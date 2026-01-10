---
name: telemetry-finetune
description: Telemetry collection patterns for future fine-tuning. Use when implementing logging, metrics, or user behavior tracking.
---

# Telemetry That Helps Fine-tuning Later

## Collect only high-value signals (cost-aware)

### Bullet evolution
Store both:
- `original_text` (LLM output)
- `current_text` (user-edited)
- `edit_distance` or `was_edited` boolean (computed)

This lets you measure "drift" between model output and user preference.

### Outcome signal
Optional, later:
- `user_reported_outcome`: { interview, offer, reject, unknown }
- link that outcome to:
  - resume_id
  - job_draft_id
  - template_id
This becomes your supervised signal.

### Implicit quality
- time-to-first-draft
- number of manual edits
- export count
- which bullets users delete often

## Privacy
- don't store full job descriptions forever unless necessary
- store hashes + minimal features if possible
