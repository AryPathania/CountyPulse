import { http, HttpResponse } from 'msw'

export const authHandlers = [
  // Mock Supabase auth.signInWithOtp
  http.post('*/auth/v1/otp', () => {
    return HttpResponse.json({}, { status: 200 })
  }),

  // Mock Supabase auth.signOut
  http.post('*/auth/v1/logout', () => {
    return HttpResponse.json({}, { status: 200 })
  }),

  // Mock Supabase auth.getSession
  http.get('*/auth/v1/session', () => {
    return HttpResponse.json({
      data: {
        session: {
          user: {
            id: 'test-user-id',
            email: 'test@example.com',
          },
        },
      },
      error: null,
    })
  }),

  // Mock Supabase auth.getUser
  http.get('*/auth/v1/user', () => {
    return HttpResponse.json({
      data: {
        user: {
          id: 'test-user-id',
          email: 'test@example.com',
        },
      },
      error: null,
    })
  }),
] 