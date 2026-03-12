# ADR 005 — Flexible Profile Links

**Status**: Accepted
**Date**: 2026-03-11

## Context

The original `candidate_profiles` schema had three fixed URL columns: `linkedin_url`, `github_url`, `website_url`. This approach doesn't scale:

- Users with less common link types (Twitter/X, personal blog, portfolio, custom domain) had no place to store them
- Adding new predefined link types required schema migrations
- The resume template had hardcoded rendering logic for exactly these three fields
- Users couldn't control the display label shown on their resume

## Decision

Replace the three fixed URL columns with a single `links JSONB NOT NULL DEFAULT '[]'` column on `candidate_profiles`. Each entry is `{ label: string, url: string }`.

- **App layer** enforces a max of 8 links (not the DB layer, which keeps things flexible)
- **Predefined label suggestions** (LinkedIn, GitHub, Twitter, Website) are offered as quick-add buttons in the UI but labels remain fully editable
- **Template rendering** iterates the `links` array — no hardcoded field names

## Consequences

**Positive:**
- Any link type is supported without schema changes
- Display labels are user-controlled (e.g. "My Portfolio" instead of "Website")
- Template code is simpler — one loop vs. three conditionals
- Sorting/ordering of links is inherently preserved by array position

**Negative:**
- No DB-level constraint on individual link structure (type safety enforced at TypeScript layer via `ProfileLink` contract in `@odie/shared`)
- Querying/filtering by specific link type requires JSONB path expressions if ever needed

## Implementation

- Migration: `supabase/migrations/027_flexible_profile_links.sql`
- Contract: `packages/shared/src/contracts/profile.ts` (`ProfileLink`, `PREDEFINED_LINK_LABELS`)
- DB query: `packages/db/src/queries/candidate-profiles.ts`
- UI: `packages/ui/src/components/ProfileForm.tsx` (quick-add + custom)

**Note (migration 028):** `user_profiles` was merged into `candidate_profiles`. The columns `display_name`, `profile_completed_at`, and `profile_version` now live in `candidate_profiles` alongside the `links` column added here. The `user_profiles` table has been dropped. There is now a single table for all user profile data.
