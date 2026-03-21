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

  authTest('Bug 1 regression: education entries saved to profile_entries on resume upload', async ({ page }) => {
    // Track POST requests to profile_entries
    const profileEntryPosts: Array<Record<string, unknown>> = []

    // Override uploaded_resumes to handle hash-check GET (null = no dup) and POST (create)
    await page.route('**/rest/v1/uploaded_resumes*', async (route) => {
      const method = route.request().method()
      const url = route.request().url()

      if (method === 'GET' && url.includes('file_hash')) {
        // getUploadedResumeByHash returns null (no duplicate)
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(null),
        })
      } else if (method === 'POST') {
        const body = route.request().postDataJSON()
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'uploaded-resume-1',
            ...body,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }),
        })
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        })
      }
    })

    // Override positions to handle POST (createPosition returns single object)
    await page.route('**/rest/v1/positions*', async (route) => {
      const method = route.request().method()
      if (method === 'POST') {
        const body = route.request().postDataJSON()
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'pos-new-1',
            ...body,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }),
        })
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        })
      }
    })

    // Override bullets to handle POST and PATCH (embeddings update)
    await page.route('**/rest/v1/bullets*', async (route) => {
      const method = route.request().method()
      if (method === 'POST') {
        const body = route.request().postDataJSON()
        const items = Array.isArray(body) ? body : [body]
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify(items.map((item: Record<string, unknown>, i: number) => ({
            id: `bullet-new-${i}`,
            ...item,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }))),
        })
      } else if (method === 'PATCH') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        })
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        })
      }
    })

    // Override profile_entries to track POSTs and return empty for GET
    await page.route('**/rest/v1/profile_entries*', async (route) => {
      const method = route.request().method()
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        })
      } else if (method === 'POST') {
        const body = route.request().postDataJSON()
        const items = Array.isArray(body) ? body : [body]
        profileEntryPosts.push(...items)
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify(items.map((item: Record<string, unknown>, i: number) => ({
            id: `entry-new-${i}`,
            ...item,
            text_items: [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }))),
        })
      } else if (method === 'PATCH') {
        // embedItems PATCHes embedding column after creating entries
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        })
      } else {
        await route.continue()
      }
    })

    // Mock storage upload
    await page.route('**/storage/v1/object/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ Key: 'resumes/test.pdf' }),
      })
    })

    // Mock extract-pdf edge function (client-side extraction will fail in E2E)
    await page.route('**/functions/v1/extract-pdf', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ text: 'mock resume text with enough content to pass the 50 char minimum threshold check' }),
      })
    })

    // Mock parse-resume edge function with education data
    await page.route('**/functions/v1/parse-resume', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          positions: [{
            company: 'Tech Corp',
            title: 'Engineer',
            startDate: '2020-01',
            endDate: '2022-01',
            bullets: [{
              originalText: 'Built things',
              classification: 'strong',
              quality: 'good',
            }],
          }],
          education: [{
            institution: 'Stanford University',
            degree: 'B.S.',
            field: 'Computer Science',
            graduationDate: '2022-06',
          }],
          skills: { hard: ['React'], soft: ['Leadership'] },
        }),
      })
    })

    // Mock embed edge function
    await page.route('**/functions/v1/embed', async (route) => {
      const body = route.request().postDataJSON()
      const count = body.texts?.length ?? 1
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          embeddings: Array.from({ length: count }, () => Array.from({ length: 1536 }, () => 0)),
        }),
      })
    })

    // Mock runs POST
    await page.route('**/rest/v1/runs*', async (route) => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify([{ id: 'run-1' }]),
      })
    })

    await page.goto('/upload-resume')
    await authExpect(page.getByTestId('upload-dropzone')).toBeVisible()

    // Upload a fake PDF
    const fileInput = page.getByTestId('file-input')
    await fileInput.setInputFiles({
      name: 'resume.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('fake pdf content'),
    })

    // Wait for processing to complete (results page shows up)
    await authExpect(page.getByTestId('upload-results')).toBeVisible({ timeout: 15000 })

    // Assert education was saved to profile_entries
    authExpect(profileEntryPosts.length).toBeGreaterThan(0)

    const educationEntry = profileEntryPosts.find(
      (entry) => entry.category === 'education'
    )
    authExpect(educationEntry).toBeTruthy()
    authExpect(String(educationEntry!.title)).toMatch(/B\.S\.|Computer Science/)
    authExpect(educationEntry!.subtitle).toBe('Stanford University')
  })
})
