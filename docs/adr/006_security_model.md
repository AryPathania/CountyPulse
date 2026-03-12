# ADR 006 — Security Model

**Status**: Accepted
**Date**: 2026-03-11

## Context

The app accepts free-form user inputs (JD text, bullet text, URLs for scraping) and makes server-side network requests (fetch-jd edge function). Several input vectors need documented threat analysis.

## Decisions and Mitigations

### 1. SSRF (Server-Side Request Forgery) — `fetch-jd` edge function

- **Risk**: attacker passes a URL to an internal resource (169.254.169.254 AWS metadata, localhost, private RFC-1918 IPs) to probe infrastructure
- **Mitigation**: `isPrivateHostname()` in `fetch-jd/index.ts` blocks loopback (localhost, 127.x, ::1, fe80:), RFC-1918 (10.x, 172.16–31.x, 192.168.x), and link-local/AWS metadata (169.254.x). Only http/https schemes accepted.
- **Additional guards**: 10-second timeout, 2MB response cap, content-type check (HTML/plain only), 50K character truncation before LLM
- **Implementation**: `supabase/functions/fetch-jd/index.ts`

### 2. SQL Injection

- **Risk**: user text in DB queries
- **Mitigation**: Not possible. All DB access goes through the Supabase JS client, which uses PostgREST with parameterized queries. No raw SQL string construction anywhere in the codebase.
- **Implementation**: all queries in `packages/db/src/queries/`

### 3. XSS (Cross-Site Scripting)

- **Risk**: user-controlled content rendered as HTML
- **Mitigation**: Not possible under current architecture. All rendering uses React JSX, which escapes dynamic content by default. `dangerouslySetInnerHTML` is not used anywhere (confirmed by audit 2026-03-11).
- **Note**: re-audit required if `dangerouslySetInnerHTML` is ever introduced.

### 4. LLM Prompt Injection

- **Risk**: attacker embeds adversarial instructions in JD text or interview responses (e.g., "Ignore previous instructions...")
- **Impact**: Limited — only affects the attacker's own session/output. Not a lateral attack vector since each user's data is isolated by RLS.
- **Mitigation**: System prompts establish agent context and reduce susceptibility. No cross-user contamination possible.
- **Future consideration**: add a prompt injection detection layer if multi-tenant LLM features are added.

### 5. Authentication and Authorization

- All Supabase tables have RLS policies enforcing `user_id = auth.uid()`. Users can only read/write their own data.
- Edge functions use `withMiddleware` which validates the Bearer JWT before processing. Unauthenticated requests are rejected.
- The `fetch-jd` function requires auth so only authenticated users can trigger server-side fetches.

## Consequences

- SSRF protection is hostname-based (pre-DNS). A DNS rebinding attack could theoretically bypass this. Acceptable risk for MVP — Supabase edge functions run in an isolated environment.
- LLM prompt injection remains a risk but is contained to single-user impact.

## References

- `supabase/functions/fetch-jd/index.ts` — SSRF mitigations
- `packages/db/src/queries/` — parameterized query usage
