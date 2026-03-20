import { describe, it, expect } from 'vitest'
import { toSubSectionData } from '@odie/db'
import type { ProfileEntry } from '@odie/db'

function makeEntry(overrides: Partial<ProfileEntry> = {}): ProfileEntry {
  return {
    id: 'abc-123',
    user_id: 'user-1',
    category: 'education',
    title: 'B.S. Computer Science',
    subtitle: 'Stanford University',
    start_date: '2018-09',
    end_date: '2022-06',
    location: 'Stanford, CA',
    text_items: ['Dean\'s List', 'Honors Thesis'],
    sort_order: 0,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('toSubSectionData', () => {
  it('maps all fields correctly', () => {
    const entry = makeEntry()
    const result = toSubSectionData(entry)

    expect(result).toEqual({
      id: 'entry-abc-123',
      title: 'B.S. Computer Science',
      subtitle: 'Stanford University',
      startDate: '2018-09',
      endDate: '2022-06',
      location: 'Stanford, CA',
      textItems: ['Dean\'s List', 'Honors Thesis'],
    })
  })

  it('converts all null optional fields to undefined', () => {
    const entry = makeEntry({
      subtitle: null,
      start_date: null,
      end_date: null,
      location: null,
    })
    const result = toSubSectionData(entry)

    expect(result.subtitle).toBeUndefined()
    expect(result.startDate).toBeUndefined()
    expect(result.endDate).toBeUndefined()
    expect(result.location).toBeUndefined()
  })

  it('returns undefined for empty text_items array', () => {
    const entry = makeEntry({ text_items: [] })
    const result = toSubSectionData(entry)

    expect(result.textItems).toBeUndefined()
  })

  it('returns text_items when array is populated', () => {
    const entry = makeEntry({ text_items: ['Python', 'React', 'AWS'] })
    const result = toSubSectionData(entry)

    expect(result.textItems).toEqual(['Python', 'React', 'AWS'])
  })
})
