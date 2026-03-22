import { describe, it, expect } from 'vitest'
import { buildSectionEntries, buildEducationEntries, buildSkillsEntries } from '@odie/db'

describe('buildSectionEntries', () => {
  it('returns empty items and subsections for empty array', () => {
    const result = buildSectionEntries([])
    expect(result.items).toEqual([])
    expect(result.subsections).toEqual([])
  })

  it('creates one subsection item per entry', () => {
    const result = buildSectionEntries([
      { id: 'a', title: 'Entry A' },
      { id: 'b', title: 'Entry B', subtitle: 'Sub B' },
    ])
    expect(result.items).toEqual([
      { type: 'subsection', subsectionId: 'a' },
      { type: 'subsection', subsectionId: 'b' },
    ])
    expect(result.subsections).toHaveLength(2)
    expect(result.subsections[0]).toEqual({ id: 'a', title: 'Entry A' })
    expect(result.subsections[1]).toEqual({ id: 'b', title: 'Entry B', subtitle: 'Sub B' })
  })

  it('preserves textItems in subsections', () => {
    const result = buildSectionEntries([
      { id: 'skills', title: 'Languages', textItems: ['Python', 'Go'] },
    ])
    expect(result.subsections[0].textItems).toEqual(['Python', 'Go'])
  })

  it('preserves optional fields', () => {
    const result = buildSectionEntries([
      { id: 'x', title: 'T', subtitle: 'S', startDate: '2020-01', endDate: '2024-05', location: 'NYC' },
    ])
    const sub = result.subsections[0]
    expect(sub.startDate).toBe('2020-01')
    expect(sub.endDate).toBe('2024-05')
    expect(sub.location).toBe('NYC')
    expect(sub.subtitle).toBe('S')
  })
})

describe('buildEducationEntries', () => {
  it('returns empty for empty array', () => {
    const result = buildEducationEntries([])
    expect(result.items).toEqual([])
    expect(result.subsections).toEqual([])
  })

  it('creates title from degree + field', () => {
    const result = buildEducationEntries([
      { institution: 'MIT', degree: 'BS', field: 'Computer Science', graduationDate: '2020-05' },
    ])
    expect(result.subsections[0].title).toBe('BS in Computer Science')
    expect(result.subsections[0].subtitle).toBe('MIT')
    expect(result.subsections[0].endDate).toBe('2020-05')
    expect(result.subsections[0].id).toBe('edu-0')
  })

  it('uses degree only when field is missing', () => {
    const result = buildEducationEntries([
      { institution: 'Harvard', degree: 'MBA' },
    ])
    expect(result.subsections[0].title).toBe('MBA')
  })

  it('falls back to institution when degree and field are missing', () => {
    const result = buildEducationEntries([
      { institution: 'Stanford' },
    ])
    expect(result.subsections[0].title).toBe('Stanford')
    expect(result.subsections[0].subtitle).toBeUndefined()
  })

  it('handles multiple entries with sequential IDs', () => {
    const result = buildEducationEntries([
      { institution: 'A', degree: 'BS', field: 'Math' },
      { institution: 'B', degree: 'MS', field: 'Physics' },
    ])
    expect(result.items).toHaveLength(2)
    expect(result.subsections[0].id).toBe('edu-0')
    expect(result.subsections[1].id).toBe('edu-1')
  })

  it('converts null graduationDate to undefined', () => {
    const result = buildEducationEntries([
      { institution: 'X', graduationDate: null },
    ])
    expect(result.subsections[0].endDate).toBeUndefined()
  })
})

describe('buildSkillsEntries', () => {
  it('returns empty when both arrays are empty', () => {
    const result = buildSkillsEntries({ hard: [], soft: [] })
    expect(result.items).toEqual([])
    expect(result.subsections).toEqual([])
  })

  it('creates Technical Skills entry for hard skills only', () => {
    const result = buildSkillsEntries({ hard: ['Python', 'React'], soft: [] })
    expect(result.subsections).toHaveLength(1)
    expect(result.subsections[0].title).toBe('Technical Skills')
    expect(result.subsections[0].textItems).toEqual(['Python', 'React'])
    expect(result.subsections[0].id).toBe('skills-hard')
  })

  it('creates Interpersonal Skills entry for soft skills only', () => {
    const result = buildSkillsEntries({ hard: [], soft: ['Leadership', 'Communication'] })
    expect(result.subsections).toHaveLength(1)
    expect(result.subsections[0].title).toBe('Interpersonal Skills')
    expect(result.subsections[0].id).toBe('skills-soft')
  })

  it('creates both entries when both categories have skills', () => {
    const result = buildSkillsEntries({
      hard: ['TypeScript'],
      soft: ['Teamwork'],
    })
    expect(result.subsections).toHaveLength(2)
    expect(result.subsections[0].title).toBe('Technical Skills')
    expect(result.subsections[1].title).toBe('Interpersonal Skills')
    expect(result.items).toHaveLength(2)
  })
})
