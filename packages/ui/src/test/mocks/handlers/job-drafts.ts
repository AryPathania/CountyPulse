import { http, HttpResponse } from 'msw'

export const jobDraftsHandlers = [
  // Mock job_drafts table select
  http.get('*/rest/v1/job_drafts*', () => {
    return HttpResponse.json([
      {
        id: 'mock-draft-1',
        user_id: 'test-user-id',
        job_title: 'Software Engineer',
        company: 'Tech Corp',
        jd_text: 'Looking for a skilled software engineer...',
        retrieved_bullet_ids: ['bullet-1', 'bullet-2'],
        selected_bullet_ids: ['bullet-1'],
        created_at: '2024-01-15T00:00:00Z',
      },
    ])
  }),

  // Mock job_drafts table insert
  http.post('*/rest/v1/job_drafts*', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json({
      id: 'mock-draft-new',
      ...body,
      created_at: new Date().toISOString(),
    })
  }),

  // Mock embed edge function
  http.post('*/functions/v1/embed', () => {
    // Return a mock embedding (1536 dimensions)
    const mockEmbedding = new Array(1536).fill(0).map(() => Math.random())
    return HttpResponse.json({ embedding: mockEmbedding })
  }),

  // Mock match_bullets RPC
  http.post('*/rest/v1/rpc/match_bullets', () => {
    return HttpResponse.json([
      { id: 'bullet-1', current_text: 'Led team of 5 engineers', category: 'Leadership', similarity: 0.92 },
      { id: 'bullet-2', current_text: 'Reduced latency by 40%', category: 'Backend', similarity: 0.88 },
      { id: 'bullet-3', current_text: 'Built React dashboard', category: 'Frontend', similarity: 0.85 },
    ])
  }),
]
