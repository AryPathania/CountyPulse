# ADR 001: State management — TanStack Query + small client store

Date: 2026-01-10  
Status: Accepted (MVP)

## Context
We need:
- lots of server data (bullets, resumes, positions, job drafts)
- minimal client-only state (DnD, dialogs, current selection)

Redux is powerful but often overkill and increases boilerplate.

## Decision
- Use **TanStack Query** for all server-state.
- Use a tiny store (Zustand or React context) for ephemeral UI state.

## Consequences
- DRY data fetching: query functions defined once and reused.
- Less boilerplate than Redux in MVP.
- If/when client-state complexity increases, we can layer Redux later without rewriting server-state code.

