import { describe, it, expect, afterEach } from 'vitest'
import { getProfile, upsertProfile } from '../queries/candidate-profiles'
import { createTestUser, cleanupTestUser } from './helpers'

describe('getProfile', () => {
  let userId: string

  afterEach(async () => {
    await cleanupTestUser(userId)
  })

  it('returns null when no row exists — does not throw', async () => {
    userId = await createTestUser()
    const result = await getProfile(userId)
    expect(result).toBeNull()
  })

  it('returns the profile with correct fields when a row exists', async () => {
    userId = await createTestUser()
    await upsertProfile(userId, { display_name: 'Jane Doe', headline: 'Engineer' })

    const result = await getProfile(userId)

    expect(result).not.toBeNull()
    expect(result!.user_id).toBe(userId)
    expect(result!.display_name).toBe('Jane Doe')
    expect(result!.headline).toBe('Engineer')
  })
})

describe('upsertProfile', () => {
  let userId: string

  afterEach(async () => {
    await cleanupTestUser(userId)
  })

  it('creates a new row when no row exists and returns the profile', async () => {
    userId = await createTestUser()

    const result = await upsertProfile(userId, { display_name: 'Alice' })

    expect(result).toBeDefined()
    expect(result.user_id).toBe(userId)
    expect(result.display_name).toBe('Alice')
  })

  it('sets profile_completed_at on create', async () => {
    userId = await createTestUser()

    const result = await upsertProfile(userId, { display_name: 'Bob' })

    // profile_completed_at should be set and be a valid recent ISO timestamp
    expect(result.profile_completed_at).not.toBeNull()
    const stamp = new Date(result.profile_completed_at!).getTime()
    expect(Number.isFinite(stamp)).toBe(true)
    // Should be within the last 60 seconds (generous window for remote Supabase clock)
    const now = Date.now()
    expect(now - stamp).toBeLessThan(60_000)
  })

  it('updates an existing row and returns the updated profile', async () => {
    userId = await createTestUser()
    await upsertProfile(userId, { display_name: 'Charlie', headline: 'Original' })

    const updated = await upsertProfile(userId, { display_name: 'Charlie', headline: 'Updated' })

    expect(updated.headline).toBe('Updated')
    expect(updated.user_id).toBe(userId)
  })

  it('stores and round-trips a links array correctly (JSONB)', async () => {
    userId = await createTestUser()
    const links = [
      { label: 'GitHub', url: 'https://github.com/testuser' },
      { label: 'LinkedIn', url: 'https://linkedin.com/in/testuser' },
    ]

    const result = await upsertProfile(userId, { display_name: 'Dana', links })

    // links is stored as JSONB; verify round-trip fidelity
    expect(Array.isArray(result.links)).toBe(true)
    const stored = result.links as typeof links
    expect(stored).toHaveLength(2)
    expect(stored[0].label).toBe('GitHub')
    expect(stored[0].url).toBe('https://github.com/testuser')
    expect(stored[1].label).toBe('LinkedIn')
    expect(stored[1].url).toBe('https://linkedin.com/in/testuser')
  })
})
