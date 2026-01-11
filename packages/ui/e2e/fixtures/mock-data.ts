import type { Page } from '@playwright/test'
import { TEST_USER } from './auth'

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

export const MOCK_JOB_DRAFTS = [
  {
    id: 'draft-1',
    user_id: TEST_USER.id,
    job_title: 'Frontend Engineer',
    company: 'New Company',
    jd_text: 'We are looking for a skilled frontend engineer...',
    jd_embedding: null,
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
    content: JSON.stringify({
      sections: [
        {
          id: 'section-experience',
          title: 'Experience',
          type: 'experience',
          items: [
            { bulletId: 'bullet-1', positionId: 'pos-1' },
            { bulletId: 'bullet-2', positionId: 'pos-1' },
          ],
        },
      ],
    }),
    pdf_url: null,
    created_at: '2024-01-15T00:00:00Z',
    updated_at: '2024-01-15T00:00:00Z',
  },
]

/**
 * Set up API mocks for Supabase REST API.
 */
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
      // Return updated bullet
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
      const body = route.request().postDataJSON()
      const newBullet = {
        id: 'bullet-new-' + Date.now(),
        ...body,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify([newBullet]),
      })
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
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_JOB_DRAFTS),
    })
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
      const body = route.request().postDataJSON()
      const newResume = {
        id: 'resume-new-' + Date.now(),
        ...body,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify([newResume]),
      })
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

  // Mock user profile
  await page.route('**/rest/v1/user_profiles*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: TEST_USER.id,
          email: TEST_USER.email,
          full_name: 'Test User',
          linkedin_url: null,
          github_url: null,
          portfolio_url: null,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      ]),
    })
  })

  // Mock RPC calls (like match_bullets)
  await page.route('**/rest/v1/rpc/match_bullets*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_BULLETS.slice(0, 2).map((b) => b.id)),
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
