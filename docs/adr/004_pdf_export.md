# ADR 004: PDF export — HTML preview + browser print (MVP)

Date: 2026-01-10  
Status: Accepted (MVP)

## Context
PDF generation is a rabbit hole.
We need something reliable and simple first.

## Decision
MVP exports PDF via:
- rendering the resume preview in the browser
- using print-to-PDF UX (or a simple export hook that triggers print)

## Consequences
- Fastest path to MVP
- Later we can add server-side generation (Playwright) without changing resume content model

