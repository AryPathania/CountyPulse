---
name: shared-bullet-editor
description: Pattern for the shared BulletEditor component used across screens. Use when implementing bullet editing UI.
---

# One BulletEditor to Rule Them All (DRY UI)

## Problem
You need:
- a "Bullets Library" screen to edit bullets
- a "Resume Builder" screen to edit bullets inline

If you implement 2 editors, they will diverge.

## Solution
Create exactly one:
- `packages/ui/src/components/bullets/BulletEditor.tsx`

And compose it in both contexts:
- BulletsLibrary uses BulletEditor in a modal or side panel
- ResumeBuilder uses the same component (with optional props like `compact`)

## Contract
BulletEditor must be:
- controlled by props: `value`, `onChange`, `onSave`, `onCancel`
- not coupled to data-fetching (no Supabase calls inside)
- pure UI + validation only

Data fetching lives in:
- `packages/ui/src/queries/bullets.ts`
