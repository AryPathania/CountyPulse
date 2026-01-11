import { test, expect } from './fixtures/auth'
import { mockAuthState } from './fixtures/auth'
import { setupApiMocks, MOCK_RESUMES, MOCK_BULLETS_WITH_POSITIONS } from './fixtures/mock-data'

declare global {
  interface Window {
    __printCalled?: boolean
  }
}

test.describe('Resume Builder', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthState(page)
    await setupApiMocks(page)
  })

  test('displays resumes list page', async ({ page }) => {
    await page.goto('/resumes')

    // Should see resumes page
    await expect(page.getByTestId('resumes-page')).toBeVisible()
    await expect(page.getByText('Your Resumes')).toBeVisible()
  })

  test('shows resume list items', async ({ page }) => {
    await page.goto('/resumes')

    // Should show resume items from job_drafts
    const resumesList = page.getByTestId('resumes-list')
    await expect(resumesList).toBeVisible()

    // Should contain our mock draft
    const resumeItem = page.getByTestId(`resume-draft-1`)
    await expect(resumeItem).toBeVisible()
    await expect(resumeItem).toContainText('Frontend Engineer')
  })

  test('has new resume button', async ({ page }) => {
    await page.goto('/resumes')

    const newResumeBtn = page.getByTestId('new-resume-btn')
    await expect(newResumeBtn).toBeVisible()
  })

  test('shows empty state when no resumes', async ({ page }) => {
    // Override job_drafts mock to return empty
    await page.route('**/rest/v1/job_drafts*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    })

    await page.goto('/resumes')

    await expect(page.getByTestId('resumes-empty')).toBeVisible()
    await expect(page.getByText('No resumes yet')).toBeVisible()
  })
})

test.describe('Resume Builder Editor', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthState(page)

    // Set up comprehensive mocks for the builder
    await page.route('**/rest/v1/resumes*', async (route) => {
      const url = route.request().url()
      const method = route.request().method()

      // Single resume fetch with related data
      if (url.includes('id=eq.resume-1') || url.includes('resume-1')) {
        const resumeWithBullets = {
          ...MOCK_RESUMES[0],
          parsedContent: JSON.parse(MOCK_RESUMES[0].content),
          bullets: MOCK_BULLETS_WITH_POSITIONS.slice(0, 2).map((b) => ({
            id: b.id,
            current_text: b.current_text,
            category: b.category,
            position: b.position,
          })),
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(method === 'GET' ? resumeWithBullets : [resumeWithBullets]),
        })
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_RESUMES),
        })
      }
    })

    await page.route('**/rest/v1/bullets*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_BULLETS_WITH_POSITIONS),
      })
    })

    await page.route('**/rest/v1/runs*', async (route) => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify([{ id: 'run-' + Date.now() }]),
      })
    })
  })

  test('displays resume builder page', async ({ page }) => {
    await page.goto('/resumes/resume-1/edit')

    // Should see builder
    await expect(page.getByTestId('resume-builder')).toBeVisible()
  })

  test('shows export PDF button', async ({ page }) => {
    await page.goto('/resumes/resume-1/edit')

    const exportBtn = page.getByTestId('export-pdf')
    await expect(exportBtn).toBeVisible()
    await expect(exportBtn).toContainText('Export PDF')
  })

  test('shows toggle preview button', async ({ page }) => {
    await page.goto('/resumes/resume-1/edit')

    const toggleBtn = page.getByTestId('toggle-preview')
    await expect(toggleBtn).toBeVisible()
  })

  test('can toggle preview mode', async ({ page }) => {
    await page.goto('/resumes/resume-1/edit')

    const toggleBtn = page.getByTestId('toggle-preview')
    await expect(toggleBtn).toContainText('Full Preview')

    // Click to toggle to preview mode
    await toggleBtn.click()

    // Button text should change
    await expect(toggleBtn).toContainText('Edit Mode')
  })

  test('shows done button', async ({ page }) => {
    await page.goto('/resumes/resume-1/edit')

    const doneBtn = page.getByTestId('done-editing')
    await expect(doneBtn).toBeVisible()
    await expect(doneBtn).toContainText('Done')
  })

  test('shows template selector', async ({ page }) => {
    await page.goto('/resumes/resume-1/edit')

    const templateSelector = page.getByTestId('template-selector')
    await expect(templateSelector).toBeVisible()
  })

  test('shows resume preview', async ({ page }) => {
    await page.goto('/resumes/resume-1/edit')

    const preview = page.getByTestId('builder-preview')
    await expect(preview).toBeVisible()
  })

  test('shows builder editor panel', async ({ page }) => {
    await page.goto('/resumes/resume-1/edit')

    const editor = page.getByTestId('builder-editor')
    await expect(editor).toBeVisible()
  })

  test('shows error state for non-existent resume', async ({ page }) => {
    // Override to return 404-like empty response
    await page.route('**/rest/v1/resumes*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(null),
      })
    })

    await page.goto('/resumes/non-existent-id/edit')

    // Should show error
    await expect(page.getByTestId('builder-error')).toBeVisible()
  })

  test('export PDF triggers print dialog', async ({ page }) => {
    await page.goto('/resumes/resume-1/edit')

    // Listen for print event
    let printCalled = false
    await page.evaluate(() => {
      window.print = () => {
        window.__printCalled = true
      }
    })

    // Click export
    const exportBtn = page.getByTestId('export-pdf')
    await exportBtn.click()

    // Verify print was called
    printCalled = await page.evaluate(() => window.__printCalled === true)
    expect(printCalled).toBe(true)
  })

  test('done button navigates to resume view', async ({ page }) => {
    await page.goto('/resumes/resume-1/edit')

    const doneBtn = page.getByTestId('done-editing')
    await doneBtn.click()

    // Should navigate to resume view (not edit)
    await expect(page).toHaveURL(/\/resumes\/resume-1(?!\/edit)/)
  })
})
