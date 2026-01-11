import { test, expect } from './fixtures/auth'
import { mockAuthState } from './fixtures/auth'
import { setupApiMocks, MOCK_BULLETS_WITH_POSITIONS } from './fixtures/mock-data'

test.describe('Bullets Library', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthState(page)
    await setupApiMocks(page)
  })

  test('displays bullets page with list', async ({ page }) => {
    await page.goto('/bullets')

    // Should see bullets page
    await expect(page.getByTestId('bullets-page')).toBeVisible()
    await expect(page.getByText('Bullets Library')).toBeVisible()

    // Should see bullets list
    await expect(page.getByTestId('bullets-list')).toBeVisible()
    await expect(page.getByTestId('bullets-list-items')).toBeVisible()
  })

  test('displays bullet count', async ({ page }) => {
    await page.goto('/bullets')

    // Should show correct count
    const countText = page.getByTestId('bullets-list-count')
    await expect(countText).toBeVisible()
    await expect(countText).toContainText(`${MOCK_BULLETS_WITH_POSITIONS.length}`)
  })

  test('can filter bullets', async ({ page }) => {
    await page.goto('/bullets')

    const filterInput = page.getByTestId('bullets-list-filter')
    await expect(filterInput).toBeVisible()

    // Filter by company name
    await filterInput.fill('Tech Corp')

    // Count should update to show filtered results
    const countText = page.getByTestId('bullets-list-count')
    await expect(countText).toContainText('filtered')
  })

  test('can clear filter', async ({ page }) => {
    await page.goto('/bullets')

    const filterInput = page.getByTestId('bullets-list-filter')
    await filterInput.fill('Tech Corp')

    // Clear button should appear
    const clearButton = page.getByTestId('bullets-list-filter-clear')
    await expect(clearButton).toBeVisible()

    // Click clear
    await clearButton.click()

    // Filter should be empty
    await expect(filterInput).toHaveValue('')
  })

  test('can select a bullet to edit', async ({ page }) => {
    await page.goto('/bullets')

    // Click on first bullet
    const firstBullet = MOCK_BULLETS_WITH_POSITIONS[0]
    const bulletSelect = page.getByTestId(`bullet-select-${firstBullet.id}`)
    await bulletSelect.click()

    // Editor should show the bullet content
    const editor = page.getByTestId('bullet-editor')
    await expect(editor).toBeVisible()

    // Should show bullet text in editor
    const textArea = page.getByTestId('bullet-editor-text')
    await expect(textArea).toHaveValue(firstBullet.current_text)
  })

  test('can edit bullet text', async ({ page }) => {
    await page.goto('/bullets')

    // Select first bullet
    const firstBullet = MOCK_BULLETS_WITH_POSITIONS[0]
    await page.getByTestId(`bullet-select-${firstBullet.id}`).click()

    // Edit the text
    const textArea = page.getByTestId('bullet-editor-text')
    await textArea.clear()
    await textArea.fill('Updated bullet text for testing')

    // Save button should be enabled
    const saveButton = page.getByTestId('bullet-editor-save')
    await expect(saveButton).toBeEnabled()

    // Click save
    await saveButton.click()

    // Should show saving state momentarily (button might be disabled during save)
    // After save, editor should still show the bullet
    await expect(page.getByTestId('bullet-editor')).toBeVisible()
  })

  test('can cancel editing', async ({ page }) => {
    await page.goto('/bullets')

    // Select first bullet
    const firstBullet = MOCK_BULLETS_WITH_POSITIONS[0]
    await page.getByTestId(`bullet-select-${firstBullet.id}`).click()

    // Click cancel
    const cancelButton = page.getByTestId('bullet-editor-cancel')
    await cancelButton.click()

    // Should show empty editor state
    await expect(page.getByTestId('bullet-editor-empty')).toBeVisible()
  })

  test('shows position context in bullet list', async ({ page }) => {
    await page.goto('/bullets')

    // First bullet should show company name
    const firstBulletItem = page.getByTestId(`bullet-item-${MOCK_BULLETS_WITH_POSITIONS[0].id}`)
    await expect(firstBulletItem).toContainText('Tech Corp')
    await expect(firstBulletItem).toContainText('Senior Software Engineer')
  })

  test('shows edited indicator for edited bullets', async ({ page }) => {
    await page.goto('/bullets')

    // Bullets marked as edited should show indicator
    // Our mock data has was_edited: true
    const editedIndicator = page.getByTestId('bullet-edited-indicator').first()
    await expect(editedIndicator).toBeVisible()
    await expect(editedIndicator).toContainText('Edited')
  })

  test('can delete a bullet', async ({ page }) => {
    // Set up dialog handler before navigation
    page.on('dialog', async (dialog) => {
      expect(dialog.type()).toBe('confirm')
      await dialog.accept()
    })

    await page.goto('/bullets')

    // Click delete on first bullet
    const firstBullet = MOCK_BULLETS_WITH_POSITIONS[0]
    const deleteButton = page.getByTestId(`bullet-delete-${firstBullet.id}`)
    await deleteButton.click()

    // Confirmation dialog should have been handled
    // After deletion, the bullet should be removed from the list
    // (In our mock, we return 204 No Content)
  })

  test('shows empty state when no bullets', async ({ page }) => {
    // Override the bullets mock to return empty
    await page.route('**/rest/v1/bullets*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    })

    await page.goto('/bullets')

    // Should show empty state
    await expect(page.getByTestId('bullets-list-empty')).toBeVisible()
    await expect(page.getByText('No bullets yet')).toBeVisible()
  })

  test('editor shows category field', async ({ page }) => {
    await page.goto('/bullets')

    // Select a bullet
    const firstBullet = MOCK_BULLETS_WITH_POSITIONS[0]
    await page.getByTestId(`bullet-select-${firstBullet.id}`).click()

    // Category field should be visible
    const categoryInput = page.getByTestId('bullet-editor-category')
    await expect(categoryInput).toBeVisible()
    await expect(categoryInput).toHaveValue(firstBullet.category || '')
  })
})
