import { test, expect } from '@playwright/test'
import { test as authTest, expect as authExpect, mockAuthState } from './fixtures/auth'
import { setupApiMocks } from './fixtures/mock-data'

test.describe('Resume Upload - Unauthenticated', () => {
  test('redirects to login when unauthenticated', async ({ page }) => {
    await page.goto('/upload-resume')
    await expect(page.getByTestId('login-form')).toBeVisible()
  })
})

authTest.describe('Resume Upload Page', () => {
  authTest.beforeEach(async ({ page }) => {
    await mockAuthState(page)
    await setupApiMocks(page)
  })

  authTest('renders upload page with heading', async ({ page }) => {
    await page.goto('/upload-resume')

    await authExpect(page.getByTestId('resume-upload-page')).toBeVisible()
    await authExpect(page.getByRole('heading', { name: 'Upload Your Resume' })).toBeVisible()
    await authExpect(page.getByText('Upload a PDF resume')).toBeVisible()
  })

  authTest('shows dropzone with file input', async ({ page }) => {
    await page.goto('/upload-resume')

    await authExpect(page.getByTestId('upload-dropzone')).toBeVisible()
    await authExpect(page.getByTestId('file-input')).toBeAttached()
    await authExpect(page.getByText('Choose PDF file')).toBeVisible()
  })

  authTest('file input accepts only PDF files', async ({ page }) => {
    await page.goto('/upload-resume')

    const fileInput = page.getByTestId('file-input')
    await authExpect(fileInput).toHaveAttribute('accept', '.pdf,application/pdf')
  })

  authTest('shows error for non-PDF file', async ({ page }) => {
    await page.goto('/upload-resume')

    const fileInput = page.getByTestId('file-input')

    // Create a fake text file
    await fileInput.setInputFiles({
      name: 'resume.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('not a pdf'),
    })

    await authExpect(page.getByTestId('upload-error')).toBeVisible()
    await authExpect(page.getByTestId('upload-error')).toContainText('PDF')
  })

  authTest('shows navigation bar', async ({ page }) => {
    await page.goto('/upload-resume')

    await authExpect(page.getByTestId('navigation')).toBeVisible()
  })
})
