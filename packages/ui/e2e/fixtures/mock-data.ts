import type { Page } from '@playwright/test'
import { TEST_USER } from './auth'

export { TEST_USER }

/**
 * Mock data for E2E tests.
 * These fixtures match the database schema types.
 */

export const MOCK_POSITIONS = [
  {
    id: 'pos-1',
    user_id: TEST_USER.id,
    company: 'Tech Corp',
    title: 'Senior Software Engineer',
    location: 'San Francisco, CA',
    start_date: '2022-01-01',
    end_date: null,
    raw_notes: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'pos-2',
    user_id: TEST_USER.id,
    company: 'Startup Inc',
    title: 'Full Stack Developer',
    location: 'Remote',
    start_date: '2020-03-01',
    end_date: '2021-12-31',
    raw_notes: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
]

export const MOCK_BULLETS = [
  {
    id: 'bullet-1',
    user_id: TEST_USER.id,
    position_id: 'pos-1',
    original_text: 'Led development of microservices architecture',
    current_text: 'Led development of microservices architecture serving 1M+ users',
    category: 'Leadership',
    hard_skills: ['Microservices', 'AWS', 'Docker'],
    soft_skills: ['Leadership', 'Communication'],
    was_edited: true,
    embedding: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'bullet-2',
    user_id: TEST_USER.id,
    position_id: 'pos-1',
    original_text: 'Implemented CI/CD pipelines',
    current_text: 'Implemented CI/CD pipelines reducing deployment time by 80%',
    category: 'Technical',
    hard_skills: ['CI/CD', 'Jenkins', 'GitHub Actions'],
    soft_skills: ['Problem Solving'],
    was_edited: true,
    embedding: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'bullet-3',
    user_id: TEST_USER.id,
    position_id: 'pos-2',
    original_text: 'Built React frontend for analytics dashboard',
    current_text: 'Built React frontend for analytics dashboard with real-time updates',
    category: 'Technical',
    hard_skills: ['React', 'TypeScript', 'WebSockets'],
    soft_skills: null,
    was_edited: true,
    embedding: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
]

export const MOCK_BULLETS_WITH_POSITIONS = MOCK_BULLETS.map((bullet) => ({
  ...bullet,
  position: MOCK_POSITIONS.find((p) => p.id === bullet.position_id) || null,
}))

export const MOCK_GAP_ANALYSIS = {
  jobTitle: 'Frontend Engineer',
  company: 'New Company',
  covered: [
    {
      requirement: { description: 'React experience required', category: 'Frontend', importance: 'must_have' },
      matchedBullets: [
        { id: 'bullet-1', text: 'Built interactive dashboards with React and TypeScript', similarity: 0.92 },
      ],
    },
  ],
  gaps: [
    { description: 'GraphQL knowledge', category: 'Backend', importance: 'nice_to_have' },
    { description: 'Team leadership skills', category: 'Soft Skills', importance: 'must_have', skillMatch: 'Leadership' },
  ],
  partiallyCovered: [] as Array<{
    requirement: { description: string; category: string; importance: string }
    reasoning: string
    evidenceBullets: Array<{ id: string; text: string; similarity: number }>
  }>,
  totalRequirements: 3,
  coveredCount: 1,
  analyzedAt: '2024-01-15T00:00:00Z',
  triageDecisions: {} as Record<string, string>,
  ignoredRequirements: [] as string[],
  refineFailed: false,
}

/** Rich gap analysis mock with partial items for visual verification screenshots.
 * Uses the STORED shape (flat gaps, bulletId/bulletText in covered) matching GapAnalysisStored schema.
 * buildGapDataFromStored() in jd-processing.ts wraps gaps into { requirement } at runtime. */
export const MOCK_GAP_ANALYSIS_RICH = {
  jobTitle: 'Senior Full Stack Engineer',
  company: 'Acme Corp',
  covered: [
    {
      requirement: { description: 'React experience with modern hooks and state management', category: 'technical_skill', importance: 'must_have' as const },
      matchedBullets: [
        { bulletId: 'bullet-1', bulletText: 'Built interactive dashboards with React and TypeScript', similarity: 0.92 },
        { bulletId: 'bullet-2', bulletText: 'Migrated legacy jQuery app to React 18 with hooks and context', similarity: 0.87 },
      ],
    },
    {
      requirement: { description: 'TypeScript proficiency', category: 'technical_skill', importance: 'must_have' as const },
      matchedBullets: [
        { bulletId: 'bullet-1', bulletText: 'Built interactive dashboards with React and TypeScript', similarity: 0.88 },
      ],
    },
  ],
  // Gaps in stored format are FLAT: { description, category, importance, skillMatch? }
  gaps: [
    { description: 'Experience with Kubernetes and container orchestration in production', category: 'technical_skill', importance: 'must_have' as const },
    { description: 'GraphQL API design and implementation', category: 'technical_skill', importance: 'nice_to_have' as const },
    { description: 'AWS Solutions Architect certification or equivalent', category: 'certification', importance: 'nice_to_have' as const },
  ],
  partiallyCovered: [
    {
      requirement: { description: '3+ years working with a variety of programming languages such as Java, Python, C++, Rust, Go, JavaScript', category: 'experience_type', importance: 'must_have' as const },
      reasoning: 'Strong JavaScript and TypeScript evidence, but no mention of Java, Python, C++, Rust, or Go.',
      evidenceBullets: [
        { id: 'bullet-1', text: 'Built interactive dashboards with React and TypeScript', similarity: 0.65 },
      ],
    },
    {
      requirement: { description: 'Cross-functional team leadership and mentoring junior engineers', category: 'leadership', importance: 'must_have' as const },
      reasoning: 'Some collaboration evidence but no direct leadership or mentoring examples.',
      evidenceBullets: [
        { id: 'bullet-3', text: 'Collaborated with product and design teams on feature specs', similarity: 0.55 },
      ],
    },
    {
      requirement: { description: 'CI/CD pipeline setup and maintenance with GitHub Actions or Jenkins', category: 'technical_skill', importance: 'nice_to_have' as const },
      reasoning: 'Mentions deployment but no specific CI/CD pipeline experience.',
      evidenceBullets: [],
    },
  ],
  totalRequirements: 10,
  coveredCount: 2,
  analyzedAt: '2024-01-15T00:00:00Z',
  triageDecisions: {} as Record<string, string>,
  ignoredRequirements: [] as string[],
  fitSummary: 'Strong frontend skills with React and TypeScript. Gaps in infrastructure (Kubernetes, CI/CD) and no leadership evidence. Partial match on language breadth — only JavaScript/TypeScript demonstrated.',
}

export const MOCK_JOB_DRAFTS = [
  {
    id: 'draft-1',
    user_id: TEST_USER.id,
    job_title: 'Frontend Engineer',
    company: 'New Company',
    jd_text: 'We are looking for a skilled frontend engineer...',
    jd_embedding: null,
    parsed_requirements: null,
    gap_analysis: MOCK_GAP_ANALYSIS,
    selected_bullet_ids: null,
    retrieved_bullet_ids: null,
    created_at: '2024-01-15T00:00:00Z',
    updated_at: '2024-01-15T00:00:00Z',
  },
]

export const MOCK_RESUMES = [
  {
    id: 'resume-1',
    user_id: TEST_USER.id,
    job_draft_id: 'draft-1',
    name: 'Frontend Engineer Resume',
    template_id: 'classic_v1',
    content: {
      sections: [
        {
          id: 'section-experience',
          title: 'Experience',
          subsections: [
            {
              id: 'sub-pos-1',
              title: 'Senior Software Engineer',
              subtitle: 'Tech Corp',
              startDate: '2022-01-01',
              endDate: null,
              location: 'San Francisco, CA',
              positionId: 'pos-1',
            },
          ],
          items: [
            { type: 'subsection', subsectionId: 'sub-pos-1' },
            { type: 'bullet', bulletId: 'bullet-1' },
            { type: 'bullet', bulletId: 'bullet-2' },
          ],
        },
        {
          id: 'section-skills',
          title: 'Skills',
          subsections: [
            {
              id: 'sub-skills-hard',
              title: 'Technical Skills',
              textItems: ['React', 'TypeScript', 'AWS', 'Docker'],
            },
          ],
          items: [
            { type: 'subsection', subsectionId: 'sub-skills-hard' },
          ],
        },
      ],
    },
    pdf_url: null,
    created_at: '2024-01-15T00:00:00Z',
    updated_at: '2024-01-15T00:00:00Z',
  },
]

/**
 * Set up API mocks for Supabase REST API.
 */
function mockCreate(route: { request: () => { postDataJSON: () => Record<string, unknown> }; fulfill: (opts: Record<string, unknown>) => Promise<void> }, prefix: string) {
  const body = route.request().postDataJSON()
  return route.fulfill({
    status: 201,
    contentType: 'application/json',
    body: JSON.stringify([{
      id: `${prefix}-new-${Date.now()}`,
      ...body,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }]),
  })
}

export async function setupApiMocks(page: Page) {
  // Mock bullets list
  await page.route('**/rest/v1/bullets*', async (route) => {
    const method = route.request().method()
    const url = route.request().url()

    if (method === 'GET') {
      // Check if it's a query with position join
      if (url.includes('position')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_BULLETS_WITH_POSITIONS),
        })
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_BULLETS),
        })
      }
    } else if (method === 'PATCH') {
      const body = route.request().postDataJSON()
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ ...MOCK_BULLETS[0], ...body }]),
      })
    } else if (method === 'DELETE') {
      await route.fulfill({
        status: 204,
        body: '',
      })
    } else if (method === 'POST') {
      await mockCreate(route, 'bullet')
    } else {
      await route.continue()
    }
  })

  // Mock positions list
  await page.route('**/rest/v1/positions*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_POSITIONS),
    })
  })

  // Mock job drafts
  await page.route('**/rest/v1/job_drafts*', async (route) => {
    const method = route.request().method()

    if (method === 'POST') {
      const body = route.request().postDataJSON()
      const newDraft = {
        ...MOCK_JOB_DRAFTS[0],
        id: 'draft-new-' + Date.now(),
        ...body,
      }
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(newDraft),
      })
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_JOB_DRAFTS),
      })
    }
  })

  // Mock resumes
  await page.route('**/rest/v1/resumes*', async (route) => {
    const method = route.request().method()

    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_RESUMES),
      })
    } else if (method === 'POST') {
      await mockCreate(route, 'resume')
    } else if (method === 'PATCH') {
      const body = route.request().postDataJSON()
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ ...MOCK_RESUMES[0], ...body }]),
      })
    } else {
      await route.continue()
    }
  })

  // Mock candidate profile
  await page.route('**/rest/v1/candidate_profiles*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          user_id: TEST_USER.id,
          display_name: 'Test User',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      ]),
    })
  })

  // Mock uploaded resumes
  await page.route('**/rest/v1/uploaded_resumes*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    })
  })

  // Mock profile entries
  await page.route('**/rest/v1/profile_entries*', async (route) => {
    const method = route.request().method()
    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    } else if (method === 'POST') {
      await mockCreate(route, 'entry')
    } else if (method === 'PATCH') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    } else {
      await route.continue()
    }
  })

  // Beta access mock lives in auth.ts mockAuthState() — no need to duplicate here.

  // Mock RPC calls (unified match_items)
  await page.route('**/rest/v1/rpc/match_items*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_BULLETS.slice(0, 2).map((b) => ({ id: b.id, source_type: 'bullet', content_text: b.current_text, category: b.category, similarity: 0.85 }))),
    })
  })

  // Mock runs/telemetry
  await page.route('**/rest/v1/runs*', async (route) => {
    const method = route.request().method()

    if (method === 'POST') {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify([{ id: 'run-' + Date.now() }]),
      })
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    }
  })
}
