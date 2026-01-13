---
name: playwright-screenshots
description: Capture screenshots for visual verification using Playwright. Use when you need to verify UI changes visually.
---

# Playwright Screenshot Capture

## Purpose
Capture screenshots of key application pages for visual verification during development and code review.

## Usage

### Running the screenshot capture test
```bash
cd packages/ui
pnpm exec playwright test screenshot-capture --project=chromium
```

### Screenshot output
Screenshots are saved to `packages/ui/screenshots/` directory. This directory is gitignored.

### Key pages captured
1. Login page (unauthenticated state)
2. Bullets library page (authenticated state)
3. Interview page (authenticated state)
4. Resumes list page (authenticated state)

## Adding new screenshots

To capture a new page, add to `packages/ui/e2e/screenshot-capture.spec.ts`:

```typescript
test('capture new-page', async ({ page }) => {
  await page.goto('/new-page')
  // Add any setup needed (auth, data)
  await page.screenshot({
    path: 'screenshots/new-page.png',
    fullPage: true,
  })
})
```

## Best practices
- Use `fullPage: true` for complete page captures
- Wait for loading states to complete before capturing
- Mock authentication for protected pages
- Use consistent viewport sizes for comparisons
