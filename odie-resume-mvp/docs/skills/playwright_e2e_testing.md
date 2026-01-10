# Skill: Playwright E2E tests (LLM-friendly)

## Why Playwright
- stable browser automation
- can do visual snapshots (nice-to-have)
- simple parallel runs

## Keep tests LLM-friendly
- use `data-testid` everywhere critical
- avoid brittle CSS selectors
- assert user-visible outcomes (text, counts, saved state)

## Must-have flows
1) login → home renders
2) create bullet → persists → reload shows it
3) build resume via DnD → persists order → reload matches
4) generate PDF (at least asserts “download link exists” or “preview renders”)

## Visual checks (nice-to-have)
- Playwright snapshot testing on the resume preview
- run only in CI nightly if flaky

