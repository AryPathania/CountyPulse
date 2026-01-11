/* eslint-disable react-hooks/rules-of-hooks */
// Note: Playwright's `use` function is NOT a React hook, but ESLint flags it.
import { test as base, expect, type Page } from '@playwright/test'

/**
 * Mock authentication state for E2E tests.
 * Since Supabase auth uses magic links, we mock the auth state
 * via route interception and localStorage injection.
 */
export interface MockUser {
  id: string
  email: string
}

export const TEST_USER: MockUser = {
  id: 'e2e-test-user-id',
  email: 'test@example.com',
}

/**
 * Create a mock Supabase session object.
 */
function createMockSession(user: MockUser) {
  const now = Date.now()
  return {
    access_token: 'mock-access-token-' + now,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(now / 1000) + 3600,
    refresh_token: 'mock-refresh-token',
    user: {
      id: user.id,
      aud: 'authenticated',
      role: 'authenticated',
      email: user.email,
      email_confirmed_at: new Date().toISOString(),
      phone: null,
      confirmation_sent_at: null,
      confirmed_at: new Date().toISOString(),
      last_sign_in_at: new Date().toISOString(),
      app_metadata: { provider: 'email', providers: ['email'] },
      user_metadata: {},
      identities: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  }
}

/**
 * Full auth setup: set up API mocks for Supabase auth.
 * This must be called BEFORE navigating to any page.
 */
export async function mockAuthState(page: Page, user: MockUser = TEST_USER) {
  const session = createMockSession(user)

  // Mock ALL auth-related Supabase endpoints
  // The key is to mock the session refresh endpoint since Supabase calls this on init
  await page.route('**/auth/v1/**', async (route) => {
    const url = route.request().url()
    const method = route.request().method()

    // Token refresh / session validation
    if (url.includes('/token')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(session),
      })
      return
    }

    // Get user
    if (url.includes('/user') && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(session.user),
      })
      return
    }

    // Logout
    if (url.includes('/logout')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({}),
      })
      return
    }

    // Default: continue with the request
    await route.continue()
  })

  // The key fix: inject the session into localStorage BEFORE the app loads
  // Supabase checks localStorage first for existing session
  await page.addInitScript(
    ({ session }) => {
      // Supabase storage key pattern: sb-<project-ref>-auth-token
      const projectRef = 'cgpgnoixxghrwmfhmmqc'
      const storageKey = `sb-${projectRef}-auth-token`

      // Store session in the format Supabase expects
      window.localStorage.setItem(storageKey, JSON.stringify(session))
    },
    { session }
  )
}

/**
 * Clear auth state from browser.
 */
export async function clearAuthState(page: Page) {
  await page.evaluate(() => {
    const keys = Object.keys(localStorage).filter(
      (k) => k.includes('supabase') || k.includes('auth') || k.startsWith('sb-')
    )
    keys.forEach((key) => localStorage.removeItem(key))
  })
}

/**
 * Extended test fixture with authenticated page.
 */
export const test = base.extend<{
  authenticatedPage: Page
}>({
  authenticatedPage: async ({ page }, use) => {
    await mockAuthState(page)
    await use(page)
  },
})

export { expect }
