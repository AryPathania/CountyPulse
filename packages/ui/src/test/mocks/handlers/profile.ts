import { http, HttpResponse } from 'msw'

const mockProfile = {
  user_id: 'test-user-id',
  display_name: 'Test User',
  headline: 'Senior Software Engineer',
  summary: 'Experienced engineer.',
  phone: '(555) 123-4567',
  location: 'San Francisco, CA',
  links: [
    { label: 'LinkedIn', url: 'https://linkedin.com/in/janedoe' },
    { label: 'GitHub', url: 'https://github.com/janedoe' },
  ],
  profile_completed_at: '2024-01-01T00:00:00.000Z',
  profile_version: 1,
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z',
}

/**
 * Returns an MSW handler override that responds with `data` for GET candidate_profiles.
 * Use with `server.use(withProfile(data))` in individual tests that need profile data.
 */
export function withUserProfile(data: Partial<typeof mockProfile>) {
  return http.get('*/rest/v1/candidate_profiles', () => HttpResponse.json([{ ...mockProfile, ...data }]))
}

/**
 * Returns an MSW handler override that responds with `data` for GET candidate_profiles.
 * Use with `server.use(withCandidateProfile(data))` in individual tests that need candidate profile data.
 * @deprecated Use withUserProfile instead — profiles are now merged into candidate_profiles.
 */
export function withCandidateProfile(data: Partial<typeof mockProfile>) {
  return http.get('*/rest/v1/candidate_profiles', () => HttpResponse.json([{ ...mockProfile, ...data }]))
}

export const profileHandlers = [
  // Mock candidate_profiles select — returns 0 rows by default; tests that need data call withUserProfile()
  http.get('*/rest/v1/candidate_profiles', () => HttpResponse.json([])),

  // Mock candidate_profiles insert/upsert
  http.post('*/rest/v1/candidate_profiles', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json([{ ...mockProfile, ...body }])
  }),

  // Mock candidate_profiles update
  http.patch('*/rest/v1/candidate_profiles', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json([{ ...mockProfile, ...body }])
  }),
]
