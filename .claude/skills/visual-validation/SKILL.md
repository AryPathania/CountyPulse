---
name: visual-validation
description: Before/after screenshot comparison for UX validation. Use after UI changes.
---

# Visual Validation via Playwright

## Purpose
Capture and compare screenshots to validate UX changes visually.

## Workflow

### 1. Capture "Before" (if possible)
If the app is running with the bug, capture first:
```bash
cd packages/ui
pnpm exec playwright test screenshot-capture --project=chromium
```

### 2. Make Changes
Apply the fix via ui-agent.

### 3. Capture "After"
Run screenshot capture again:
```bash
cd packages/ui
pnpm exec playwright test screenshot-capture --project=chromium
```

### 4. Compare
Screenshots are saved to `packages/ui/screenshots/`:
- Manual visual comparison
- Or use Playwright's built-in comparison

## Adding Custom Captures

Add to `e2e/screenshot-capture.spec.ts`:

```typescript
test('capture specific-component', async ({ page }) => {
  await page.goto('/path')
  // Add any setup needed (auth, data)
  await page.screenshot({
    path: 'screenshots/specific-component.png',
    fullPage: true,
  })
})
```

## Best Practices
- Use consistent viewport (1280x720 default)
- Wait for loading states to complete before capturing
- Mock authentication for protected pages
- Capture both desktop and mobile if responsive
- Use `fullPage: true` for complete page captures

## Key Pages Captured
1. Login page (unauthenticated state)
2. Bullets library page (authenticated state)
3. Interview page (authenticated state)
4. Resumes list page (authenticated state)

## Screenshot Directory
Screenshots are saved to `packages/ui/screenshots/` which is gitignored.
