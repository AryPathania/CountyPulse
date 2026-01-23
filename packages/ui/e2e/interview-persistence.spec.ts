import { test, expect } from './fixtures/auth'
import { mockAuthState, TEST_USER } from './fixtures/auth'
import { setupApiMocks, MOCK_BULLETS_WITH_POSITIONS } from './fixtures/mock-data'

/**
 * E2E tests for interview state persistence features.
 * Tests localStorage persistence across page navigation and refresh.
 */
test.describe('Interview Persistence', () => {
  const STORAGE_KEY = `odie_interview_state_${TEST_USER.id}`

  test.beforeEach(async ({ page }) => {
    await mockAuthState(page)
    await setupApiMocks(page)

    // Mock the interview endpoint
    await page.route('**/functions/v1/interview*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          response: 'Great! Tell me about your responsibilities at Acme Corp.',
          extractedPosition: {
            company: 'Acme Corp',
            title: 'Software Engineer',
          },
          extractedBullets: [],
          shouldContinue: true,
        }),
      })
    })

    // Mock position creation
    await page.route('**/rest/v1/positions*', async (route) => {
      const method = route.request().method()
      if (method === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify([{
            id: 'pos-new-' + Date.now(),
            user_id: TEST_USER.id,
            company: 'Acme Corp',
            title: 'Software Engineer',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }]),
        })
      } else {
        await route.continue()
      }
    })
  })

  test('persistence notice is visible during interview', async ({ page }) => {
    await page.goto('/interview')

    // Wait for the page to load
    await expect(page.getByTestId('interview-page')).toBeVisible()
    await expect(page.getByTestId('interview-chat')).toBeVisible()

    // Should show persistence notice
    const notice = page.getByTestId('persistence-notice')
    await expect(notice).toBeVisible()
    await expect(notice).toContainText('Your progress is saved in this browser only')
  })

  test('interview state persists across page refresh', async ({ page }) => {
    await page.goto('/interview')

    // Wait for initial load
    await expect(page.getByTestId('interview-chat')).toBeVisible()

    // Type a message
    const input = page.getByTestId('interview-input')
    await input.fill('I worked at Acme Corp as a Software Engineer')
    await page.getByTestId('interview-send').click()

    // Wait for message to appear
    await expect(page.getByText('I worked at Acme Corp as a Software Engineer')).toBeVisible()

    // Wait for state to be saved to localStorage
    await page.waitForTimeout(500)

    // Verify localStorage has data
    const storageData = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)
    expect(storageData).not.toBeNull()
    const parsed = JSON.parse(storageData!)
    expect(parsed.messages.length).toBeGreaterThan(0)

    // Refresh the page
    await page.reload()

    // Wait for hydration
    await expect(page.getByTestId('interview-chat')).toBeVisible()

    // The user message should still be there after refresh
    await expect(page.getByText('I worked at Acme Corp as a Software Engineer')).toBeVisible()
  })

  test('interview state persists after navigating away and back', async ({ page }) => {
    await page.goto('/interview')

    // Wait for initial load
    await expect(page.getByTestId('interview-chat')).toBeVisible()

    // Type a message
    const input = page.getByTestId('interview-input')
    await input.fill('I worked at Acme Corp')
    await page.getByTestId('interview-send').click()

    // Wait for message
    await expect(page.getByText('I worked at Acme Corp')).toBeVisible()

    // Wait for localStorage save
    await page.waitForTimeout(500)

    // Navigate to bullets page
    await page.getByTestId('nav-link-bullets').click()
    await expect(page).toHaveURL('/bullets')
    await expect(page.getByTestId('bullets-page')).toBeVisible()

    // Navigate back to interview
    await page.goto('/interview')

    // Wait for hydration
    await expect(page.getByTestId('interview-chat')).toBeVisible()

    // The user message should still be there
    await expect(page.getByText('I worked at Acme Corp')).toBeVisible()
  })

  test('storage is cleared after interview completion', async ({ page }) => {
    // Set up mock response for complete interview
    await page.route('**/functions/v1/interview*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          response: 'Thanks for sharing! Interview complete.',
          extractedPosition: null,
          extractedBullets: [],
          shouldContinue: false,
        }),
      })
    })

    await page.goto('/interview')

    // Wait for load
    await expect(page.getByTestId('interview-chat')).toBeVisible()

    // Click End Interview to complete
    await page.getByTestId('interview-end').click()

    // Wait for complete state
    await expect(page.getByTestId('interview-complete')).toBeVisible()

    // Accept dialog if any (for finishing)
    page.on('dialog', async (dialog) => {
      await dialog.accept()
    })

    // Click Save & Continue
    await page.getByTestId('interview-finish').click()

    // Wait for navigation
    await expect(page).toHaveURL('/bullets')

    // Verify localStorage is cleared
    const storageData = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)
    expect(storageData).toBeNull()
  })
})

test.describe('Draft Bullets During Interview', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthState(page)
    await setupApiMocks(page)
  })

  test('draft badge visible on draft bullets in bullets list', async ({ page }) => {
    // Override bullets mock to include a draft bullet
    const draftBullets = [
      ...MOCK_BULLETS_WITH_POSITIONS,
      {
        id: 'bullet-draft-1',
        user_id: TEST_USER.id,
        position_id: 'pos-1',
        original_text: 'Draft bullet from interview',
        current_text: 'Draft bullet from interview',
        category: 'Technical',
        hard_skills: ['React'],
        soft_skills: null,
        was_edited: false,
        is_draft: true,
        embedding: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        position: {
          id: 'pos-1',
          company: 'Draft Corp',
          title: 'Developer',
        },
      },
    ]

    await page.route('**/rest/v1/bullets*', async (route) => {
      const method = route.request().method()
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(draftBullets),
        })
      } else {
        await route.continue()
      }
    })

    await page.goto('/bullets')

    // Should see bullets page
    await expect(page.getByTestId('bullets-page')).toBeVisible()
    await expect(page.getByTestId('bullets-list')).toBeVisible()

    // Should see draft badge
    const draftBadge = page.getByTestId('draft-badge')
    await expect(draftBadge).toBeVisible()
    await expect(draftBadge).toContainText('Draft')
  })

  test('finalized bullets do not show draft badge', async ({ page }) => {
    // Only finalized bullets (no is_draft: true)
    await page.goto('/bullets')

    await expect(page.getByTestId('bullets-page')).toBeVisible()
    await expect(page.getByTestId('bullets-list')).toBeVisible()

    // Should NOT see any draft badges
    const draftBadges = page.getByTestId('draft-badge')
    await expect(draftBadges).toHaveCount(0)
  })
})

test.describe('Interview Cancel Behavior', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthState(page)
    await setupApiMocks(page)
  })

  test('cancel clears localStorage and navigates home', async ({ page }) => {
    const STORAGE_KEY = `odie_interview_state_${TEST_USER.id}`

    // Pre-populate localStorage with interview state
    await page.addInitScript(({ key }) => {
      const mockState = {
        messages: [
          { role: 'assistant', content: 'Hello!' },
          { role: 'user', content: 'I worked somewhere' },
        ],
        extractedData: { positions: [] },
        savedBulletIds: [],
        savedPositionIds: [],
        lastUpdated: new Date().toISOString(),
      }
      localStorage.setItem(key, JSON.stringify(mockState))
    }, { key: STORAGE_KEY })

    await page.goto('/interview')

    // Wait for page
    await expect(page.getByTestId('interview-chat')).toBeVisible()

    // Handle the confirm dialog
    page.on('dialog', async (dialog) => {
      expect(dialog.type()).toBe('confirm')
      expect(dialog.message()).toContain('cancel the interview')
      await dialog.accept()
    })

    // Click cancel
    await page.getByTestId('interview-cancel').click()

    // Should navigate to home
    await expect(page).toHaveURL('/')

    // localStorage should be cleared
    const storageData = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)
    expect(storageData).toBeNull()
  })

  test('cancel declined keeps state and stays on page', async ({ page }) => {
    await page.goto('/interview')

    await expect(page.getByTestId('interview-chat')).toBeVisible()

    // Handle the confirm dialog - decline
    page.on('dialog', async (dialog) => {
      await dialog.dismiss()
    })

    // Click cancel
    await page.getByTestId('interview-cancel').click()

    // Should still be on interview page
    await expect(page).toHaveURL('/interview')
    await expect(page.getByTestId('interview-chat')).toBeVisible()
  })
})
