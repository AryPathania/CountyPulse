import { http, HttpResponse } from 'msw'

// Mock interview responses for testing
const mockInterviewResponses = [
  {
    response: "Great! You worked at Acme Corp as a Software Engineer. When did you start and end this role?",
    extractedPosition: {
      company: 'Acme Corp',
      title: 'Software Engineer',
    },
    shouldContinue: true,
  },
  {
    response: "Tell me about an impactful project you worked on at Acme Corp.",
    extractedPosition: {
      company: 'Acme Corp',
      title: 'Software Engineer',
      startDate: '2022-01',
      endDate: '2024-01',
    },
    shouldContinue: true,
  },
  {
    response: "Excellent! That's a strong accomplishment.",
    extractedBullets: [
      {
        text: 'Reduced API response latency by 40% through implementing Redis caching',
        category: 'Backend',
        hardSkills: ['Redis', 'SQL'],
        softSkills: ['Problem Solving'],
      },
    ],
    shouldContinue: true,
  },
  {
    response: "Your interview is complete!",
    shouldContinue: false,
  },
]

let messageIndex = 0

export function resetInterviewMock() {
  messageIndex = 0
}

export const interviewHandlers = [
  // Mock interview edge function
  http.post('*/functions/v1/interview', () => {
    const response = mockInterviewResponses[Math.min(messageIndex, mockInterviewResponses.length - 1)]
    messageIndex++
    return HttpResponse.json(response)
  }),

  // Mock positions table insert
  http.post('*/rest/v1/positions*', async ({ request }) => {
    const body = await request.json() as { company: string; title: string }
    return HttpResponse.json({
      id: 'mock-position-id',
      ...body,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
  }),

  // Mock bullets table insert
  http.post('*/rest/v1/bullets*', async ({ request }) => {
    const body = await request.json() as Array<{ original_text: string }>
    if (Array.isArray(body)) {
      return HttpResponse.json(
        body.map((b, i) => ({
          id: `mock-bullet-id-${i}`,
          ...b,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }))
      )
    }
    return HttpResponse.json({
      id: 'mock-bullet-id',
      ...body,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
  }),

  // Mock positions table select
  http.get('*/rest/v1/positions*', () => {
    return HttpResponse.json([])
  }),

  // Mock bullets table select
  http.get('*/rest/v1/bullets*', () => {
    return HttpResponse.json([])
  }),
]
