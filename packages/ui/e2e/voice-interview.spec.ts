import { test, expect } from './fixtures/auth'
import { mockAuthState, TEST_USER } from './fixtures/auth'
import { setupApiMocks } from './fixtures/mock-data'

/**
 * E2E tests for the voice interview feature.
 * Tests voice controls UI, toggles, voice picker, and recording indicator.
 *
 * Note: Actual audio recording/playback cannot be fully tested in E2E
 * since browser permissions and audio APIs are sandboxed. These tests
 * focus on the UI state and interactions.
 */
test.describe('Voice Interview Controls', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthState(page)
    await setupApiMocks(page)

    // Mock the interview endpoint
    await page.route('**/functions/v1/interview*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          response: 'Great! Tell me about your experience.',
          extractedPosition: null,
          extractedBullets: [],
          shouldContinue: true,
        }),
      })
    })

    // Mock transcribe endpoint (for voice input)
    await page.route('**/functions/v1/transcribe*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          text: 'I worked at Acme Corp as a software engineer.',
        }),
      })
    })

    // Mock speak endpoint (for voice output)
    await page.route('**/functions/v1/speak*', async (route) => {
      // Return a mock audio blob
      await route.fulfill({
        status: 200,
        contentType: 'audio/mpeg',
        body: Buffer.from('mock audio data'),
      })
    })
  })

  test('voice controls appear on interview page', async ({ page }) => {
    await page.goto('/interview')

    // Wait for the page to load
    await expect(page.getByTestId('interview-page')).toBeVisible()
    await expect(page.getByTestId('interview-chat')).toBeVisible()

    // Voice controls should be visible
    await expect(page.getByTestId('voice-controls')).toBeVisible()
    await expect(page.getByTestId('voice-input-toggle')).toBeVisible()
    await expect(page.getByTestId('voice-output-toggle')).toBeVisible()
    await expect(page.getByTestId('voice-picker')).toBeVisible()
  })

  test('voice input toggle changes state', async ({ page }) => {
    await page.goto('/interview')

    await expect(page.getByTestId('voice-controls')).toBeVisible()

    // Initially voice input should be off
    const inputToggle = page.getByTestId('voice-input-toggle')
    await expect(inputToggle).toHaveAttribute('aria-pressed', 'false')

    // Mic button should NOT be visible when voice input is off
    await expect(page.getByTestId('mic-button')).not.toBeVisible()

    // Click to enable voice input
    await inputToggle.click()

    // Now input should be on
    await expect(inputToggle).toHaveAttribute('aria-pressed', 'true')

    // Mic button should now be visible
    await expect(page.getByTestId('mic-button')).toBeVisible()

    // Click again to disable
    await inputToggle.click()

    // Input should be off again
    await expect(inputToggle).toHaveAttribute('aria-pressed', 'false')

    // Mic button should be hidden again
    await expect(page.getByTestId('mic-button')).not.toBeVisible()
  })

  test('voice output toggle changes state', async ({ page }) => {
    await page.goto('/interview')

    await expect(page.getByTestId('voice-controls')).toBeVisible()

    // Initially voice output should be off
    const outputToggle = page.getByTestId('voice-output-toggle')
    await expect(outputToggle).toHaveAttribute('aria-pressed', 'false')

    // Voice picker should be disabled when output is off
    const voicePicker = page.getByTestId('voice-picker')
    await expect(voicePicker).toBeDisabled()

    // Click to enable voice output
    await outputToggle.click()

    // Now output should be on
    await expect(outputToggle).toHaveAttribute('aria-pressed', 'true')

    // Voice picker should be enabled
    await expect(voicePicker).not.toBeDisabled()

    // Click again to disable
    await outputToggle.click()

    // Output should be off again
    await expect(outputToggle).toHaveAttribute('aria-pressed', 'false')

    // Voice picker should be disabled again
    await expect(voicePicker).toBeDisabled()
  })

  test('voice picker allows voice selection', async ({ page }) => {
    await page.goto('/interview')

    await expect(page.getByTestId('voice-controls')).toBeVisible()

    // Enable voice output first
    await page.getByTestId('voice-output-toggle').click()

    const voicePicker = page.getByTestId('voice-picker')
    await expect(voicePicker).not.toBeDisabled()

    // Default voice should be nova
    await expect(voicePicker).toHaveValue('nova')

    // Select different voices
    await voicePicker.selectOption('alloy')
    await expect(voicePicker).toHaveValue('alloy')

    await voicePicker.selectOption('echo')
    await expect(voicePicker).toHaveValue('echo')

    await voicePicker.selectOption('shimmer')
    await expect(voicePicker).toHaveValue('shimmer')

    await voicePicker.selectOption('fable')
    await expect(voicePicker).toHaveValue('fable')

    await voicePicker.selectOption('onyx')
    await expect(voicePicker).toHaveValue('onyx')

    // Back to nova
    await voicePicker.selectOption('nova')
    await expect(voicePicker).toHaveValue('nova')
  })

  test('voice settings persist across page refresh', async ({ page }) => {
    await page.goto('/interview')

    await expect(page.getByTestId('voice-controls')).toBeVisible()

    // Enable voice input
    const inputToggle = page.getByTestId('voice-input-toggle')
    await inputToggle.click()
    await expect(inputToggle).toHaveAttribute('aria-pressed', 'true')

    // Enable voice output
    const outputToggle = page.getByTestId('voice-output-toggle')
    await outputToggle.click()
    await expect(outputToggle).toHaveAttribute('aria-pressed', 'true')

    // Change voice
    const voicePicker = page.getByTestId('voice-picker')
    await voicePicker.selectOption('shimmer')

    // Wait for localStorage to persist
    await page.waitForTimeout(200)

    // Verify localStorage has the settings
    const storedSettings = await page.evaluate(() => localStorage.getItem('voice-settings'))
    expect(storedSettings).not.toBeNull()
    const parsed = JSON.parse(storedSettings!)
    expect(parsed.inputEnabled).toBe(true)
    expect(parsed.outputEnabled).toBe(true)
    expect(parsed.voice).toBe('shimmer')

    // Refresh the page
    await page.reload()

    // Wait for page to load
    await expect(page.getByTestId('voice-controls')).toBeVisible()

    // Settings should be restored
    await expect(page.getByTestId('voice-input-toggle')).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByTestId('voice-output-toggle')).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByTestId('voice-picker')).toHaveValue('shimmer')
  })

  test('mic button is visible only when voice input is enabled', async ({ page }) => {
    await page.goto('/interview')

    await expect(page.getByTestId('voice-controls')).toBeVisible()

    // Mic button should not exist when voice input is off
    await expect(page.getByTestId('mic-button')).not.toBeVisible()

    // Enable voice input
    await page.getByTestId('voice-input-toggle').click()

    // Mic button should now be visible
    await expect(page.getByTestId('mic-button')).toBeVisible()

    // Disable voice input
    await page.getByTestId('voice-input-toggle').click()

    // Mic button should be hidden again
    await expect(page.getByTestId('mic-button')).not.toBeVisible()
  })

  test('voice controls have proper accessibility attributes', async ({ page }) => {
    await page.goto('/interview')

    await expect(page.getByTestId('voice-controls')).toBeVisible()

    // Check input toggle accessibility
    const inputToggle = page.getByTestId('voice-input-toggle')
    await expect(inputToggle).toHaveAttribute('type', 'button')
    await expect(inputToggle).toHaveAttribute('aria-pressed')
    await expect(inputToggle).toHaveAttribute('title', 'Toggle voice input')

    // Check output toggle accessibility
    const outputToggle = page.getByTestId('voice-output-toggle')
    await expect(outputToggle).toHaveAttribute('type', 'button')
    await expect(outputToggle).toHaveAttribute('aria-pressed')
    await expect(outputToggle).toHaveAttribute('title', 'Toggle voice output')

    // Check voice picker has label
    const voicePicker = page.getByTestId('voice-picker')
    const pickerId = await voicePicker.getAttribute('id')
    expect(pickerId).toBe('voice-picker')

    // Enable input to show mic button
    await inputToggle.click()

    // Check mic button accessibility
    const micButton = page.getByTestId('mic-button')
    await expect(micButton).toHaveAttribute('type', 'button')
    await expect(micButton).toHaveAttribute('aria-label')
  })
})

test.describe('Voice Input UI States', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthState(page)
    await setupApiMocks(page)

    // Mock the interview endpoint
    await page.route('**/functions/v1/interview*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          response: 'Great! Tell me more.',
          extractedPosition: null,
          extractedBullets: [],
          shouldContinue: true,
        }),
      })
    })
  })

  test('mic button aria-label changes based on recording state', async ({ page }) => {
    await page.goto('/interview')

    await expect(page.getByTestId('voice-controls')).toBeVisible()

    // Enable voice input
    await page.getByTestId('voice-input-toggle').click()

    const micButton = page.getByTestId('mic-button')
    await expect(micButton).toBeVisible()

    // Initially should show "Start recording"
    await expect(micButton).toHaveAttribute('aria-label', 'Start recording')
  })
})

test.describe('Voice Output UI', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthState(page)
    await setupApiMocks(page)

    // Mock the interview endpoint
    await page.route('**/functions/v1/interview*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          response: 'Great experience! What were your main responsibilities?',
          extractedPosition: null,
          extractedBullets: [],
          shouldContinue: true,
        }),
      })
    })

    // Mock speak endpoint
    await page.route('**/functions/v1/speak*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'audio/mpeg',
        body: Buffer.from('mock audio data'),
      })
    })
  })

  test('voice picker contains all expected voices', async ({ page }) => {
    await page.goto('/interview')

    await expect(page.getByTestId('voice-controls')).toBeVisible()

    // Enable voice output to make picker active
    await page.getByTestId('voice-output-toggle').click()

    const voicePicker = page.getByTestId('voice-picker')
    await expect(voicePicker).not.toBeDisabled()

    // Check all expected options exist
    const options = voicePicker.locator('option')
    await expect(options).toHaveCount(6)

    // Verify each voice option - use toHaveAttribute for option elements
    await expect(options.nth(0)).toHaveAttribute('value', 'alloy')
    await expect(options.nth(0)).toHaveText('Alloy')

    await expect(options.nth(1)).toHaveAttribute('value', 'echo')
    await expect(options.nth(1)).toHaveText('Echo')

    await expect(options.nth(2)).toHaveAttribute('value', 'fable')
    await expect(options.nth(2)).toHaveText('Fable')

    await expect(options.nth(3)).toHaveAttribute('value', 'onyx')
    await expect(options.nth(3)).toHaveText('Onyx')

    await expect(options.nth(4)).toHaveAttribute('value', 'nova')
    await expect(options.nth(4)).toHaveText('Nova')

    await expect(options.nth(5)).toHaveAttribute('value', 'shimmer')
    await expect(options.nth(5)).toHaveText('Shimmer')
  })
})

test.describe('Voice Settings Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthState(page)
    await setupApiMocks(page)

    // Mock the interview endpoint
    await page.route('**/functions/v1/interview*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          response: 'Thanks for sharing!',
          extractedPosition: null,
          extractedBullets: [],
          shouldContinue: true,
        }),
      })
    })
  })

  test('voice settings persist after navigating away and back', async ({ page }) => {
    await page.goto('/interview')

    await expect(page.getByTestId('voice-controls')).toBeVisible()

    // Configure voice settings
    await page.getByTestId('voice-input-toggle').click()
    await page.getByTestId('voice-output-toggle').click()
    await page.getByTestId('voice-picker').selectOption('echo')

    // Wait for persistence
    await page.waitForTimeout(200)

    // Navigate to bullets page
    await page.getByTestId('nav-link-bullets').click()
    await expect(page).toHaveURL('/bullets')

    // Navigate back to interview
    await page.goto('/interview')

    // Settings should be preserved
    await expect(page.getByTestId('voice-input-toggle')).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByTestId('voice-output-toggle')).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByTestId('voice-picker')).toHaveValue('echo')
  })
})
