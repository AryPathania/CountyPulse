import { test, expect, mockAuthState } from './fixtures/auth'
import { MOCK_JOB_DRAFTS, MOCK_BULLETS_WITH_POSITIONS } from './fixtures/mock-data'

const MOCK_REQUIREMENTS = [
  { description: 'React experience required', category: 'technical', importance: 'must_have' },
  { description: 'Team leadership skills', category: 'soft_skill', importance: 'must_have' },
  { description: 'GraphQL knowledge', category: 'technical', importance: 'nice_to_have' },
]

// Pre-computed hashes for requirement descriptions using hashRequirementDescription()
const _HASH_REACT = '-swdzu4'    // hashRequirementDescription('React experience required')
const HASH_LEADERSHIP = '-pz8gkm' // hashRequirementDescription('Team leadership skills')
const HASH_GRAPHQL = '82z6cn'     // hashRequirementDescription('GraphQL knowledge')

const REFINE_RESPONSE_DEFAULT = {
  refinedRequirements: [
    { requirementIndex: 0, status: 'covered', reasoning: 'Strong React experience', evidenceBulletIds: [], evidenceEntryIds: [] },
    { requirementIndex: 1, status: 'gap', reasoning: 'No leadership evidence', evidenceBulletIds: [], evidenceEntryIds: [] },
    { requirementIndex: 2, status: 'gap', reasoning: 'No GraphQL evidence', evidenceBulletIds: [], evidenceEntryIds: [] },
  ],
  recommendedBulletIds: [],
  fitSummary: 'Test candidate assessment',
  bulletTexts: {},
}

function setupGapAnalysisMocks(
  page: import('@playwright/test').Page,
  options?: {
    refineOverride?: object | 'error'
    gapAnalysisOverride?: object
  }
) {
  return Promise.all([
    // Mock job draft with JD text
    page.route('**/rest/v1/job_drafts*', async (route) => {
      const method = route.request().method()
      if (method === 'PATCH') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_JOB_DRAFTS[0]) })
      } else {
        const gapAnalysis = options?.gapAnalysisOverride ?? MOCK_JOB_DRAFTS[0].gap_analysis
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ...MOCK_JOB_DRAFTS[0],
            jd_text: 'We need a React engineer with leadership skills and GraphQL knowledge.',
            gap_analysis: gapAnalysis,
            bullets: MOCK_BULLETS_WITH_POSITIONS.slice(0, 2),
          }),
        })
      }
    }),

    page.route('**/rest/v1/bullets*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_BULLETS_WITH_POSITIONS) })
    }),

    page.route('**/rest/v1/resumes*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    }),

    // Mock parse-jd edge function
    page.route('**/functions/v1/parse-jd', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          jobTitle: 'Frontend Engineer',
          company: 'New Company',
          requirements: MOCK_REQUIREMENTS,
        }),
      })
    }),

    // Mock embed edge function
    page.route('**/functions/v1/embed', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          embeddings: MOCK_REQUIREMENTS.map(() => Array(1536).fill(0.01)),
        }),
      })
    }),

    // Mock refine-analysis edge function
    page.route('**/functions/v1/refine-analysis', async (route) => {
      if (options?.refineOverride === 'error') {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal Server Error' }),
        })
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(options?.refineOverride ?? REFINE_RESPONSE_DEFAULT),
        })
      }
    }),

    // Mock match_items RPC -- first requirement matches, others don't
    page.route('**/rest/v1/rpc/match_items*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{
          id: 'bullet-3',
          source_type: 'bullet',
          content_text: 'Built React frontend for analytics dashboard with real-time updates',
          category: 'Technical',
          similarity: 0.89,
        }]),
      })
    }),
  ])
}

test.describe('Gap Analysis on Draft Page', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthState(page)
  })

  test('renders gap analysis after draft loads', async ({ page }) => {
    await setupGapAnalysisMocks(page)
    await page.goto('/resumes/draft-1')

    await expect(page.getByTestId('draft-page')).toBeVisible()
    await expect(page.getByTestId('gap-analysis')).toBeVisible({ timeout: 10000 })
  })

  test('shows requirements summary', async ({ page }) => {
    await setupGapAnalysisMocks(page)
    await page.goto('/resumes/draft-1')

    await expect(page.getByTestId('gap-summary')).toBeVisible({ timeout: 10000 })
    await expect(page.getByTestId('gap-summary')).toContainText('requirements covered')
  })

  test('displays covered items with badge', async ({ page }) => {
    await setupGapAnalysisMocks(page)
    await page.goto('/resumes/draft-1')

    await expect(page.getByTestId('gap-analysis')).toBeVisible({ timeout: 10000 })
    const coveredItems = page.getByTestId('covered-item')
    await expect(coveredItems.first()).toBeVisible()
    await expect(coveredItems.first()).toContainText('Covered')
  })

  test('partially covered items show Partial badge', async ({ page }) => {
    // Use refine response with a partially_covered item
    const refineWithPartial = {
      refinedRequirements: [
        { requirementIndex: 0, status: 'covered', reasoning: 'Strong React experience', evidenceBulletIds: [], evidenceEntryIds: [] },
        { requirementIndex: 1, status: 'partially_covered', reasoning: 'Some leadership evidence but not enough', evidenceBulletIds: [], evidenceEntryIds: [] },
        { requirementIndex: 2, status: 'gap', reasoning: 'No GraphQL evidence', evidenceBulletIds: [], evidenceEntryIds: [] },
      ],
      recommendedBulletIds: [],
      fitSummary: 'Partial coverage assessment',
      bulletTexts: {},
    }
    // Provide gap_analysis with partiallyCovered so stored data includes it
    const gapAnalysisWithPartial = {
      ...MOCK_JOB_DRAFTS[0].gap_analysis,
      partiallyCovered: [
        {
          requirement: { description: 'Team leadership skills', category: 'soft_skill', importance: 'must_have' },
          reasoning: 'Some leadership evidence but not enough',
          evidenceBullets: [],
        },
      ],
      gaps: [
        { description: 'GraphQL knowledge', category: 'technical', importance: 'nice_to_have' },
      ],
      triageDecisions: {},
      ignoredRequirements: [],
    }

    await setupGapAnalysisMocks(page, {
      refineOverride: refineWithPartial,
      gapAnalysisOverride: gapAnalysisWithPartial,
    })
    await page.goto('/resumes/draft-1')

    await expect(page.getByTestId('gap-analysis')).toBeVisible({ timeout: 10000 })
    const partialItems = page.getByTestId('partial-item')
    await expect(partialItems.first()).toBeVisible()
    await expect(partialItems.first()).toContainText('Partial')
  })

  test('clicking partial item description shows reasoning text', async ({ page }) => {
    const gapAnalysisWithPartial = {
      ...MOCK_JOB_DRAFTS[0].gap_analysis,
      partiallyCovered: [
        {
          requirement: { description: 'Team leadership skills', category: 'soft_skill', importance: 'must_have' },
          reasoning: 'Some leadership evidence but not enough',
          evidenceBullets: [],
        },
      ],
      gaps: [
        { description: 'GraphQL knowledge', category: 'technical', importance: 'nice_to_have' },
      ],
      triageDecisions: {},
      ignoredRequirements: [],
    }

    await setupGapAnalysisMocks(page, { gapAnalysisOverride: gapAnalysisWithPartial })
    await page.goto('/resumes/draft-1')

    await expect(page.getByTestId('gap-analysis')).toBeVisible({ timeout: 10000 })
    const partialItem = page.getByTestId('partial-item').first()
    await expect(partialItem).toBeVisible()

    // Click the description to expand
    await partialItem.locator('.gap-analysis__description').click()

    // Verify reasoning text appears
    await expect(partialItem.locator('.gap-analysis__reasoning')).toContainText('Some leadership evidence but not enough')
  })

  test('interview for gaps button navigates to interview', async ({ page }) => {
    // Pre-triage all items so the button is enabled
    // Gap items: 'Team leadership skills' and 'GraphQL knowledge'
    const gapAnalysisTriaged = {
      ...MOCK_JOB_DRAFTS[0].gap_analysis,
      partiallyCovered: [],
      triageDecisions: {
        [HASH_LEADERSHIP]: 'interview',
        [HASH_GRAPHQL]: 'interview',
      },
      ignoredRequirements: [],
    }

    await setupGapAnalysisMocks(page, { gapAnalysisOverride: gapAnalysisTriaged })
    await page.goto('/resumes/draft-1')

    const interviewBtn = page.getByTestId('interview-for-gaps')
    await expect(interviewBtn).toBeVisible({ timeout: 10000 })
    await expect(interviewBtn).toBeEnabled()

    await interviewBtn.click()
    await expect(page).toHaveURL('/interview')
  })

  test('create resume button is visible alongside gap analysis', async ({ page }) => {
    await setupGapAnalysisMocks(page)
    await page.goto('/resumes/draft-1')

    await expect(page.getByTestId('gap-analysis')).toBeVisible({ timeout: 10000 })
    await expect(page.getByTestId('create-resume-btn')).toBeVisible()
  })

  test('shows job title and company', async ({ page }) => {
    await setupGapAnalysisMocks(page)
    await page.goto('/resumes/draft-1')

    await expect(page.getByRole('heading', { name: MOCK_JOB_DRAFTS[0].job_title, level: 1 })).toBeVisible()
    await expect(page.getByText(MOCK_JOB_DRAFTS[0].company).first()).toBeVisible()
  })

  test('triage "Not a Gap" moves gap item to Triaged section with Ignored badge', async ({ page }) => {
    await setupGapAnalysisMocks(page)
    await page.goto('/resumes/draft-1')

    await expect(page.getByTestId('gap-analysis')).toBeVisible({ timeout: 10000 })

    // There should be gap items in the "Needs Your Input" section
    const gapItems = page.getByTestId('gap-item')
    await expect(gapItems.first()).toBeVisible()

    // Click the "Not a Gap" button on the first gap item
    const firstGapItem = gapItems.first()
    await firstGapItem.getByTestId('triage-ignore').click()

    // Verify the item appears in the Triaged section with "Ignored" badge
    const triagedItems = page.getByTestId('triaged-item')
    await expect(triagedItems.first()).toBeVisible()
    await expect(triagedItems.first()).toContainText('Ignored')
  })

  test('triage Add to Interview moves item to Triaged section with Interview badge', async ({ page }) => {
    await setupGapAnalysisMocks(page)
    await page.goto('/resumes/draft-1')

    await expect(page.getByTestId('gap-analysis')).toBeVisible({ timeout: 10000 })

    // There should be gap items in the "Needs Your Input" section
    const gapItems = page.getByTestId('gap-item')
    await expect(gapItems.first()).toBeVisible()

    // Click the "Add to Interview" button on the first gap item
    const firstGapItem = gapItems.first()
    await firstGapItem.getByTestId('triage-interview').click()

    // Verify the item appears in the Triaged section with "Interview" badge
    const triagedItems = page.getByTestId('triaged-item')
    await expect(triagedItems.first()).toBeVisible()
    await expect(triagedItems.first()).toContainText('Interview')
  })

  test('Create Resume button blocked until all items triaged, unblocks after', async ({ page }) => {
    await setupGapAnalysisMocks(page)
    await page.goto('/resumes/draft-1')

    await expect(page.getByTestId('gap-analysis')).toBeVisible({ timeout: 10000 })

    // Create Resume button should be disabled when untriaged items exist
    const createBtn = page.getByTestId('create-resume-btn')
    await expect(createBtn).toBeDisabled()

    // Triage all gap items — only "Not a Gap" and "Add to Interview" buttons available
    const gapItems = page.getByTestId('gap-item')
    const gapCount = await gapItems.count()

    for (let i = 0; i < gapCount; i++) {
      // Always click the first visible gap item since items move to Triaged after click
      const currentGapItem = page.getByTestId('gap-item').first()
      await currentGapItem.getByTestId('triage-ignore').click()
    }

    // After all items are triaged, the button should be enabled
    await expect(createBtn).toBeEnabled()
  })

  test('refine-analysis failure falls back to mechanical results gracefully', async ({ page }) => {
    // Use gap_analysis stored data with refineFailed flag
    const gapAnalysisWithRefineFailed = {
      ...MOCK_JOB_DRAFTS[0].gap_analysis,
      partiallyCovered: [],
      triageDecisions: {},
      ignoredRequirements: [],
      refineFailed: true,
    }

    await setupGapAnalysisMocks(page, {
      refineOverride: 'error',
      gapAnalysisOverride: gapAnalysisWithRefineFailed,
    })
    await page.goto('/resumes/draft-1')

    // Page should still show gap analysis results (mechanical fallback)
    await expect(page.getByTestId('gap-analysis')).toBeVisible({ timeout: 10000 })

    // The refine-failed notice should be visible
    await expect(page.getByTestId('refine-failed-notice')).toBeVisible()
    await expect(page.getByTestId('refine-failed-notice')).toContainText('Enhanced analysis unavailable')

    // Gap items should still render (mechanical results)
    const gapItems = page.getByTestId('gap-item')
    await expect(gapItems.first()).toBeVisible()
  })
})
