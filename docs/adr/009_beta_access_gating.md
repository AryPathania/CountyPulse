# ADR 009 — Beta Access Gating

**Status**: Accepted
**Date**: 2026-03-25

## Context

The application is deployed on a public domain with Supabase Auth handling authentication, but there is no access control beyond authentication. Anyone who signs up can use the full application. Before the LLC is established and a Stripe subscription system is in place, we need a way to restrict access to invited beta testers only.

Requirements:
- Simple to administer (no custom admin UI needed for MVP)
- Secure at the backend level (not just a frontend cosmetic gate)
- Extensible to a subscription model later without a rewrite
- No email enumeration vulnerability

## Decision

Implement an email-based `beta_allowlist` table with dual-layer enforcement:

### Backend layer (security boundary)
- `withMiddleware` in `supabase/functions/_shared/middleware.ts` gains a `requireAccess` option (default `true`). After JWT auth, it queries `beta_allowlist` directly using the service role to check if the user's email is on the list.
- **Fail-closed**: any error (DB down, missing table, missing email on JWT) returns 403. Access is never granted on error.
- Edge functions can opt out with `requireAccess: false` for public endpoints.

### Frontend layer (UX guard)
- `AccessGuard` component wraps all protected routes inside `AuthGuard`. It calls `check_beta_access()` RPC via the `useAccess` hook and redirects to `/no-access` if the user is not on the beta list.
- This is UX-only and trivially bypassable via dev tools. That is acceptable because the backend middleware is the real security boundary.

### RPC function (no enumeration)
- `check_beta_access()` is a `SECURITY DEFINER` function that reads the user's email from `auth.jwt()`. It takes no parameters, so callers cannot probe arbitrary emails.

### Administration
- Beta testers are added/removed directly in the Supabase dashboard by inserting/deleting rows in `beta_allowlist`. No admin UI is needed for the beta phase.

## Tradeoffs

- **Simplicity vs. features**: No self-service invite flow, no admin dashboard. Acceptable for a small beta cohort managed by one person.
- **Dual-layer overhead**: Two checks (frontend + backend) for the same gate. The frontend check avoids confusing UX; the backend check provides real security. Both are cheap (single row lookup).
- **Email-only matching**: If a user changes their email in Supabase Auth, they lose beta access until the new email is added. Acceptable for beta; a subscription system keyed on `user_id` will replace this.
- **Default-on access check**: All edge functions require access by default. New edge functions automatically get the gate without developer action. Functions that should be public must explicitly opt out.

## Consequences

- Only invited users can use the application, both at the UI level and at the API level.
- Adding a beta tester is a single INSERT in the Supabase dashboard.
- The `withMiddleware` pattern is already used by all edge functions, so no per-function changes were needed.
- When Stripe subscriptions are added, the access check expands to include active/trialing subscription status alongside the beta allowlist (free override). The `AccessGuard` and `useAccess` hook extend naturally.

## References

- `supabase/migrations/*_create_beta_allowlist.sql` — table, RLS, RPC function
- `supabase/functions/_shared/middleware.ts` — `requireAccess` option in `withMiddleware`
- `packages/ui/src/components/auth/AccessGuard.tsx` — frontend UX guard
- `packages/ui/src/pages/NoAccessPage.tsx` — access denied page
- `packages/ui/src/hooks/useAccess.ts` — TanStack Query hook for access check
- `packages/db/src/queries/access.ts` — `checkBetaAccess()` query
