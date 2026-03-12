import { test, expect } from './fixtures/auth'
import { mockAuthState } from './fixtures/auth'
import { MOCK_RESUMES, MOCK_BULLETS_WITH_POSITIONS, MOCK_POSITIONS } from './fixtures/mock-data'

const CANDIDATE_INFO = {
  displayName: 'Test User',
  email: 'test@example.com',
  headline: 'Senior Software Engineer',
  summary: null,
  phone: '555-123-4567',
  location: 'San Francisco, CA',
  links: [
    { label: 'LinkedIn', url: 'https://linkedin.com/in/testuser' },
    { label: 'GitHub', url: 'https://github.com/testuser' },
  ],
}

const RESUME_WITH_CANDIDATE = {
  ...MOCK_RESUMES[0],
  parsedContent: MOCK_RESUMES[0].content,
  bullets: MOCK_BULLETS_WITH_POSITIONS.slice(0, 2).map((b) => ({
    id: b.id,
    current_text: b.current_text,
    category: b.category,
    position: b.position,
  })),
  positions: MOCK_POSITIONS.map((p) => ({
    id: p.id,
    company: p.company,
    title: p.title,
    start_date: p.start_date,
    end_date: p.end_date,
    location: p.location,
  })),
  candidateInfo: CANDIDATE_INFO,
}

test.describe('Resume Builder — PersonalInfoPanel', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthState(page)

    await page.route('**/rest/v1/resumes*', async (route) => {
      const method = route.request().method()
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(method === 'GET' ? RESUME_WITH_CANDIDATE : [RESUME_WITH_CANDIDATE]),
      })
    })

    await page.route('**/rest/v1/bullets*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_BULLETS_WITH_POSITIONS),
      })
    })

    await page.route('**/rest/v1/positions*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_POSITIONS),
      })
    })

    await page.route('**/rest/v1/candidate_profiles*', async (route) => {
      const method = route.request().method()
      if (method === 'PATCH' || method === 'POST') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) })
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            display_name: 'Test User',
            headline: CANDIDATE_INFO.headline,
            summary: null,
            phone: CANDIDATE_INFO.phone,
            location: CANDIDATE_INFO.location,
            links: CANDIDATE_INFO.links,
          }),
        })
      }
    })

    await page.route('**/rest/v1/runs*', async (route) => {
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify([{}]) })
    })
  })

  test('personal info panel is visible collapsed by default', async ({ page }) => {
    await page.goto('/resumes/resume-1/edit')

    await expect(page.getByTestId('personal-info-panel')).toBeVisible()
    await expect(page.getByTestId('btn-toggle-personal-info')).toBeVisible()

    // ProfileForm should not be visible while collapsed
    await expect(page.getByTestId('profile-form')).not.toBeVisible()

    await page.screenshot({ path: 'e2e-screenshots/personal-info-collapsed.png', fullPage: false })
  })

  test('clicking toggle opens the ProfileForm', async ({ page }) => {
    await page.goto('/resumes/resume-1/edit')

    const toggleBtn = page.getByTestId('btn-toggle-personal-info')
    await expect(toggleBtn).toContainText('▶')

    // Screenshot before opening
    await page.screenshot({ path: 'e2e-screenshots/personal-info-before-open.png', fullPage: false })

    await toggleBtn.click()

    await expect(page.getByTestId('profile-form')).toBeVisible()
    await expect(toggleBtn).toContainText('▼')

    // Screenshot after opening
    await page.screenshot({ path: 'e2e-screenshots/personal-info-after-open.png', fullPage: false })
  })

  test('ProfileForm is pre-filled with candidateInfo values', async ({ page }) => {
    await page.goto('/resumes/resume-1/edit')

    await page.getByTestId('btn-toggle-personal-info').click()

    await expect(page.getByTestId('input-display-name')).toHaveValue('Test User')
    await expect(page.getByTestId('input-headline')).toHaveValue('Senior Software Engineer')
    await expect(page.getByTestId('input-location')).toHaveValue('San Francisco, CA')
    await expect(page.getByTestId('input-phone')).toHaveValue('555-123-4567')
    // Email field is read-only and set from candidateInfo.email
    await expect(page.getByTestId('input-email')).toHaveValue('test@example.com')
  })

  test('editing display name and saving updates the preview header', async ({ page }) => {
    await page.goto('/resumes/resume-1/edit')

    // Screenshot before edit
    await page.screenshot({ path: 'e2e-screenshots/personal-info-preview-before.png', fullPage: false })

    await page.getByTestId('btn-toggle-personal-info').click()

    const nameInput = page.getByTestId('input-display-name')
    await nameInput.clear()
    await nameInput.fill('Updated Name')

    await page.getByTestId('btn-save-profile').click()

    // Wait for save to complete (button returns to non-saving state)
    await expect(page.getByTestId('btn-save-profile')).toContainText('Save')

    // Screenshot after save
    await page.screenshot({ path: 'e2e-screenshots/personal-info-preview-after.png', fullPage: false })

    // The preview header should now reflect the updated name
    const preview = page.getByTestId('builder-preview')
    await expect(preview.locator('.classic-template__name')).toContainText('Updated Name')
  })

  test('closing the panel hides the form', async ({ page }) => {
    await page.goto('/resumes/resume-1/edit')

    const toggleBtn = page.getByTestId('btn-toggle-personal-info')

    // Open
    await toggleBtn.click()
    await expect(page.getByTestId('profile-form')).toBeVisible()

    // Close
    await toggleBtn.click()
    await expect(page.getByTestId('profile-form')).not.toBeVisible()
  })
})
