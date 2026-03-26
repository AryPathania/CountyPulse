import { test, expect } from './fixtures/auth'
import { mockAuthState } from './fixtures/auth'
import { setupApiMocks, MOCK_RESUMES, MOCK_BULLETS_WITH_POSITIONS, MOCK_POSITIONS } from './fixtures/mock-data'

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

    const candidateInfo = {
      displayName: 'Test User',
      email: 'test@example.com',
      headline: null,
      summary: null,
      phone: '555-123-4567',
      location: 'San Francisco, CA',
      links: [
        { label: 'LinkedIn', url: 'https://linkedin.com/in/testuser' },
        { label: 'GitHub', url: 'https://github.com/testuser' },
      ],
    }

    // Set up comprehensive mocks for the builder
    await page.route('**/rest/v1/resumes*', async (route) => {
      const url = route.request().url()
      const method = route.request().method()

      // Single resume fetch with related data
      if (url.includes('id=eq.resume-1') || url.includes('resume-1')) {
        const resumeWithBullets = {
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
          candidateInfo,
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

    await page.route('**/rest/v1/candidate_profiles*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          display_name: 'Test User',
          headline: null,
          summary: null,
          phone: '555-123-4567',
          location: 'San Francisco, CA',
          links: [
            { label: 'LinkedIn', url: 'https://linkedin.com/in/testuser' },
            { label: 'GitHub', url: 'https://github.com/testuser' },
          ],
        }),
      })
    })

    await page.route('**/rest/v1/positions*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_POSITIONS),
      })
    })

    await page.route('**/rest/v1/profile_entries*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
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

  test('shows sub-section headers in editor', async ({ page }) => {
    await page.goto('/resumes/resume-1/edit')

    const subsection = page.getByTestId('subsection-sub-pos-1')
    await expect(subsection).toBeVisible()
    await expect(subsection).toContainText('Senior Software Engineer')
    await expect(subsection).toContainText('Tech Corp')
  })

  test('shows user display name in preview, not resume name', async ({ page }) => {
    await page.goto('/resumes/resume-1/edit')

    const preview = page.getByTestId('builder-preview')
    await expect(preview).toBeVisible()

    // The preview should show the candidate display name, not the resume name as the main header
    await expect(preview.locator('.classic-template__name')).toContainText('Test User')
  })

  test('shows contact info in preview header', async ({ page }) => {
    await page.goto('/resumes/resume-1/edit')

    const contact = page.getByTestId('template-contact')
    await expect(contact).toBeVisible()

    // Email should be present
    await expect(contact).toContainText('test@example.com')

    // LinkedIn should render as a link
    const linkedinLink = contact.locator('a[href="https://linkedin.com/in/testuser"]')
    await expect(linkedinLink).toBeVisible()
    await expect(linkedinLink).toContainText('LinkedIn')
  })

  test('shows bullet palette with available bullets', async ({ page }) => {
    await page.goto('/resumes/resume-1/edit')

    const palette = page.getByTestId('bullet-palette')
    await expect(palette).toBeVisible()

    // bullet-1 and bullet-2 are used in the resume; only bullet-3 is available
    const count = page.getByTestId('bullet-palette-count')
    await expect(count).toHaveText('1')
  })

  test('hides used bullets from palette', async ({ page }) => {
    await page.goto('/resumes/resume-1/edit')

    // bullet-3 is unused, should be in the palette
    await expect(page.getByTestId('palette-bullet-bullet-3')).toBeVisible()

    // bullet-1 is used in the resume, should NOT appear in palette
    await expect(page.getByTestId('palette-bullet-bullet-1')).not.toBeVisible()
  })

  test('remove button removes bullet from section', async ({ page }) => {
    await page.goto('/resumes/resume-1/edit')

    // Initially the palette count should be 1 (only bullet-3 is unused)
    const count = page.getByTestId('bullet-palette-count')
    await expect(count).toHaveText('1')

    // Click remove on bullet-1
    const removeBtn = page.getByTestId('remove-bullet-bullet-1')
    await removeBtn.click()

    // After removing, palette count should increase to 2
    await expect(count).toHaveText('2')
  })

  test('can add a sub-section', async ({ page }) => {
    await page.goto('/resumes/resume-1/edit')

    // Wait for the section to load with content
    const sectionEl = page.getByTestId('section-section-experience')
    await expect(sectionEl).toBeVisible()

    // Click "Add Sub-Section" button
    const addBtn = page.getByTestId('add-subsection-section-experience')
    await addBtn.click()

    // "New Sub-Section" text should appear after clicking add
    await expect(sectionEl.getByText('New Sub-Section')).toBeVisible()
  })

  test('textItems render as comma-separated list in template preview', async ({ page }) => {
    await page.goto('/resumes/resume-1/edit')

    const subsection = page.getByTestId('template-subsection-sub-skills-hard')
    await expect(subsection).toBeVisible()
    await expect(subsection).toContainText('Technical Skills')
    await expect(subsection).toContainText('React, TypeScript, AWS, Docker')
  })

  test('textItems render in builder editor', async ({ page }) => {
    await page.goto('/resumes/resume-1/edit')

    const subsection = page.getByTestId('subsection-sub-skills-hard')
    await expect(subsection).toBeVisible()
    await expect(subsection).toContainText('React, TypeScript, AWS, Docker')
  })

  test('Add Section button opens dropdown', async ({ page }) => {
    await page.goto('/resumes/resume-1/edit')

    const addBtn = page.getByTestId('add-section-btn')
    await expect(addBtn).toBeVisible()
    await addBtn.click()

    const dropdown = page.getByTestId('add-section-dropdown')
    await expect(dropdown).toBeVisible()

    // "Projects" should be a suggested option
    await expect(page.getByTestId('add-section-option-Projects')).toBeVisible()
  })

  test('can add a custom section', async ({ page }) => {
    await page.goto('/resumes/resume-1/edit')

    // Open add-section dropdown
    await page.getByTestId('add-section-btn').click()
    await expect(page.getByTestId('add-section-dropdown')).toBeVisible()

    // Click custom section button
    await page.getByTestId('add-section-custom-btn').click()

    // Fill in custom section name
    const nameInput = page.getByTestId('add-section-custom-name')
    await expect(nameInput).toBeVisible()
    await nameInput.fill('Certifications')

    // Confirm
    await page.getByTestId('add-section-custom-confirm').click()

    // A section with title "Certifications" should appear in the editor
    await expect(page.getByText('Certifications')).toBeVisible()
  })

  test('can rename a section', async ({ page }) => {
    await page.goto('/resumes/resume-1/edit')

    // Click the section title to enter edit mode
    const titleEl = page.getByTestId('section-title-section-experience')
    await expect(titleEl).toBeVisible()
    await titleEl.click()

    // The input should appear
    const titleInput = page.getByTestId('section-title-input-section-experience')
    await expect(titleInput).toBeVisible()

    // Clear and type new name
    await titleInput.clear()
    await titleInput.fill('Work Experience')
    await titleInput.press('Enter')

    // The section title should now show the new name
    await expect(page.getByTestId('section-title-section-experience')).toContainText('Work Experience')
  })

  test('can delete a section', async ({ page }) => {
    await page.goto('/resumes/resume-1/edit')

    // Both sections should be visible (Experience + Skills)
    await expect(page.getByTestId('section-section-experience')).toBeVisible()
    await expect(page.getByTestId('section-section-skills')).toBeVisible()

    // Auto-accept the confirm dialog
    page.on('dialog', (dialog) => dialog.accept())

    // Click delete on the skills section
    await page.getByTestId('delete-section-section-skills').click()

    // Skills section should be removed
    await expect(page.getByTestId('section-section-skills')).not.toBeVisible()

    // Add section button should still exist
    await expect(page.getByTestId('add-section-btn')).toBeVisible()
  })

  test('displays only end date when start date is missing (Bug 3 regression)', async ({ page }) => {
    // Override resume mock with a subsection that has no startDate
    const resumeWithEndDateOnly = {
      ...MOCK_RESUMES[0],
      content: {
        sections: [
          {
            id: 'section-experience',
            title: 'Experience',
            subsections: [
              {
                id: 'sub-pos-endonly',
                title: 'Contract Developer',
                subtitle: 'Freelance',
                startDate: undefined,
                endDate: '2021-12-01',
                location: 'Remote',
              },
            ],
            items: [
              { type: 'subsection', subsectionId: 'sub-pos-endonly' },
              { type: 'bullet', bulletId: 'bullet-1' },
            ],
          },
        ],
      },
    }

    await page.route('**/rest/v1/resumes*', async (route) => {
      const method = route.request().method()
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ...resumeWithEndDateOnly,
            parsedContent: resumeWithEndDateOnly.content,
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
            candidateInfo: {
              displayName: 'Test User',
              email: 'test@example.com',
              headline: null,
              summary: null,
              phone: '555-123-4567',
              location: 'San Francisco, CA',
              links: [],
            },
          }),
        })
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([resumeWithEndDateOnly]),
        })
      }
    })

    await page.goto('/resumes/resume-1/edit')

    // Wait for the builder to load
    await expect(page.getByTestId('resume-builder')).toBeVisible()

    // The preview should show "Dec 2021" for the end-date-only subsection
    const preview = page.getByTestId('builder-preview')
    await expect(preview).toBeVisible()

    // Should show "Dec 2021" somewhere in the preview
    await expect(preview.getByText('Dec 2021')).toBeVisible()

    // Should NOT show "Present" anywhere for this subsection
    // (The old bug showed "Present - Dec 2021")
    const subsectionMeta = preview.locator('[data-testid="template-subsection-sub-pos-endonly"]')
    if (await subsectionMeta.isVisible()) {
      await expect(subsectionMeta).not.toContainText('Present')
    }
  })
})
