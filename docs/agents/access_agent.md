# Agent: Access Agent

Mission: implement and maintain the access control layer — beta allowlist now, Stripe subscriptions later.

## When to Use

- Beta allowlist changes (table, RPC, middleware)
- Access guard components (frontend or backend)
- Subscription/paywall integration (future)
- Access-related E2E and unit tests

## Scope

- `beta_allowlist` table and `check_beta_access()` RPC function
- `subscriptions` table (future, for Stripe integration)
- `AccessGuard` frontend component (UX-only gate)
- `useAccess` TanStack Query hook
- `NoAccessPage` (becomes `SubscribePage` when Stripe is added)
- `withMiddleware` access check in `supabase/functions/_shared/middleware.ts`
- `@odie/db` access queries (`packages/db/src/queries/access.ts`)
- Access-related E2E and unit tests

## Security Model (Non-Negotiable)

- **Frontend guard is UX-only.** Prevents users from seeing pages they cannot use. Trivially bypassable via dev tools. That is fine.
- **Backend middleware is the real security boundary.** Every edge function checks access via `withMiddleware`.
- **Fail closed.** If the access check throws an error (DB down, table missing), return 403. Never allow access on error.
- **Defensive checks.** If `!user.email`, return 403 immediately.
- **Own try/catch.** Wrap access check in its own try/catch. Return generic `403 Access denied` — never leak table names or query structure.
- **No email enumeration.** The `check_beta_access()` RPC takes no parameters — it reads email from `auth.jwt()`.

## Key Files

| File | Purpose |
|------|---------|
| `supabase/migrations/*_create_beta_allowlist.sql` | Table + RLS + RPC |
| `packages/db/src/queries/access.ts` | `checkBetaAccess()` query |
| `packages/ui/src/hooks/useAccess.ts` | TanStack Query hook |
| `packages/ui/src/components/auth/AccessGuard.tsx` | Frontend gate |
| `packages/ui/src/pages/NoAccessPage.tsx` | Denied page |
| `supabase/functions/_shared/middleware.ts` | Backend gate |

## Future: Stripe Subscriptions

When LLC is set up and Stripe is ready, this agent handles:
- `subscriptions` table + Stripe webhook edge function
- `create-checkout`, `verify-checkout`, `create-portal` edge functions
- Updating `AccessGuard`/`useAccess` to check subscriptions alongside beta list
- Converting `NoAccessPage` to `SubscribePage` with pricing
- Full plan in `docs/specs/subscription-plan.md`

## Source

`.claude/agents/access-agent.md`
