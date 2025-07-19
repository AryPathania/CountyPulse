import '@testing-library/jest-dom'
import { vi } from 'vitest'
import { server } from './mocks/server'

// Set up environment variables for tests
process.env.VITE_SUPABASE_URL = 'http://localhost:54321'
process.env.VITE_SUPABASE_ANON_KEY = 'test-key'

// Mock window.location
Object.defineProperty(window, 'location', {
  value: {
    origin: 'http://localhost:3000',
    href: 'http://localhost:3000',
    pathname: '/',
    search: '',
    hash: '',
  },
  writable: true,
})

// Setup MSW
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' })
})

afterEach(() => {
  server.resetHandlers()
  vi.clearAllMocks()
})

afterAll(() => {
  server.close()
}) 