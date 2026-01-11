import { test, expect } from '@playwright/test'

test.describe('Authentication Flow', () => {
  test('shows login form for unauthenticated users', async ({ page }) => {
    // Navigate to home page without auth
    await page.goto('/')

    // Should see the login form
    await expect(page.getByTestId('login-form')).toBeVisible()
    await expect(page.getByTestId('login-email')).toBeVisible()
    await expect(page.getByTestId('login-submit')).toBeVisible()
  })

  test('shows login form with correct content', async ({ page }) => {
    await page.goto('/')

    // Verify login form content
    await expect(page.getByText('Welcome to Odie')).toBeVisible()
    await expect(page.getByText('Enter your email to get started')).toBeVisible()
    await expect(page.getByPlaceholder('your@email.com')).toBeVisible()
  })

  test('submit button is disabled when email is empty', async ({ page }) => {
    await page.goto('/')

    const submitButton = page.getByTestId('login-submit')
    await expect(submitButton).toBeDisabled()
  })

  test('submit button is enabled when email is entered', async ({ page }) => {
    await page.goto('/')

    const emailInput = page.getByTestId('login-email')
    const submitButton = page.getByTestId('login-submit')

    // Enter email
    await emailInput.fill('test@example.com')

    // Button should be enabled
    await expect(submitButton).toBeEnabled()
  })

  test('shows success message after submitting valid email', async ({ page }) => {
    // Mock the OTP endpoint to simulate successful magic link sending
    await page.route('**/auth/v1/otp*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({}),
      })
    })

    await page.goto('/')

    const emailInput = page.getByTestId('login-email')
    const submitButton = page.getByTestId('login-submit')

    // Fill and submit
    await emailInput.fill('test@example.com')
    await submitButton.click()

    // Should show success state (magic link sent)
    await expect(page.getByTestId('login-success')).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('heading', { name: 'Check Your Email' })).toBeVisible()
    await expect(page.getByText('test@example.com')).toBeVisible()
  })

  test('protected routes redirect to login when unauthenticated', async ({ page }) => {
    // Try to access bullets page
    await page.goto('/bullets')
    await expect(page.getByTestId('login-form')).toBeVisible()

    // Try to access interview page
    await page.goto('/interview')
    await expect(page.getByTestId('login-form')).toBeVisible()

    // Try to access resumes page
    await page.goto('/resumes')
    await expect(page.getByTestId('login-form')).toBeVisible()
  })
})
