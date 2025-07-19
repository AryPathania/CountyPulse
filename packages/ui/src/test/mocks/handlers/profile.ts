import { http, HttpResponse } from 'msw'

const mockProfile = {
  id: 'profile-id',
  user_id: 'test-user-id',
  display_name: 'Test User',
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z',
  profile_completed_at: '2024-01-01T00:00:00.000Z',
  profile_version: 1,
}

export const profileHandlers = [
  // Mock user_profiles select
  http.get('*/rest/v1/user_profiles', ({ request }) => {
    const url = new URL(request.url)
    const select = url.searchParams.get('select')
    const userId = url.searchParams.get('user_id')
    
    if (userId === 'eq.test-user-id') {
      return HttpResponse.json([mockProfile])
    }
    
    return HttpResponse.json([])
  }),

  // Mock user_profiles insert
  http.post('*/rest/v1/user_profiles', async ({ request }) => {
    const body = await request.json()
    return HttpResponse.json([{ ...mockProfile, ...body }])
  }),

  // Mock user_profiles update
  http.patch('*/rest/v1/user_profiles', async ({ request }) => {
    const body = await request.json()
    return HttpResponse.json([{ ...mockProfile, ...body }])
  }),
] 