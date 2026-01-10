# Skill: TanStack Query vs Redux (the DRY approach)

## Mental model
- **TanStack Query**: server-state (cache, fetch, invalidation, retries)
- **Redux/Zustand**: client-state (UI selections, transient editing state)

In this app:
- bullets, resumes, templates, interview runs are **server-state**
- the currently edited resume draft, DnD ordering, open dialogs are **client-state**

## Recommendation for MVP
- Use **TanStack Query** for all Supabase reads/writes.
- Use a tiny store (Zustand or React context) only for ephemeral UI state.
- Add Redux only if you hit pain:
  - deep cross-screen state coupling
  - time-travel debugging need
  - large client-only derived state graph

## DRY win
Supabase calls live once in `packages/db`.
TanStack Query hooks wrap those calls once in `packages/ui/src/queries/*`.

