import { describe, it, expect, vi } from 'vitest'
import { isUrl } from './fetchJd'

// fetchJd.ts imports supabase from @odie/db; mock the module to isolate isUrl
vi.mock('@odie/db', () => ({
  supabase: { functions: { invoke: vi.fn() } },
}))

describe('isUrl', () => {
  it('returns true for a bare HTTPS URL', () => {
    expect(isUrl('https://job-boards.greenhouse.io/spacex/jobs/123')).toBe(true)
  })

  it('returns true for a bare HTTP URL', () => {
    expect(isUrl('http://example.com/jobs/456')).toBe(true)
  })

  it('returns false for multi-line text that contains a URL', () => {
    expect(isUrl('Software Engineer\nhttps://example.com')).toBe(false)
  })

  it('returns false for plain job description text', () => {
    expect(isUrl('We are looking for a software engineer with 3+ years experience...')).toBe(false)
  })

  it('returns true for URL with trailing whitespace', () => {
    expect(isUrl('  https://greenhouse.io/jobs/789  ')).toBe(true)
  })
})
