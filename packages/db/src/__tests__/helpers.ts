import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types'

// Service role client — bypasses RLS for test isolation
export const testDb = createClient<Database>(
  process.env.SUPABASE_URL ?? 'http://localhost:54321',
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
)

/**
 * Create a real auth user via the admin API so FK constraints are satisfied.
 * Returns the user's UUID. Call `deleteTestUser` in afterEach to clean up.
 */
export async function createTestUser(): Promise<string> {
  const email = `test-${crypto.randomUUID()}@odie-integration-test.invalid`
  const { data, error } = await testDb.auth.admin.createUser({
    email,
    email_confirm: true,
    password: crypto.randomUUID(),
  })
  if (error) throw new Error(`createTestUser failed: ${error.message}`)
  return data.user.id
}

/**
 * Delete all application rows for the user then delete the auth user itself.
 * Call in afterEach — not afterAll — so tests are fully isolated.
 */
export async function cleanupTestUser(userId: string) {
  // Delete application rows first (FK children before parent)
  await testDb.from('candidate_profiles').delete().eq('user_id', userId)
  await testDb.from('bullets').delete().eq('user_id', userId)
  await testDb.from('positions').delete().eq('user_id', userId)
  await testDb.from('resumes').delete().eq('user_id', userId)

  // Delete the auth user
  const { error } = await testDb.auth.admin.deleteUser(userId)
  if (error) {
    // Log but don't throw — cleanup failure shouldn't fail the test that already passed
    console.warn(`cleanupTestUser: failed to delete auth user ${userId}: ${error.message}`)
  }
}
