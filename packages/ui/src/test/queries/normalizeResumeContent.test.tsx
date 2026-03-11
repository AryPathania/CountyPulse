import { describe, it, expect } from 'vitest'
import { normalizeResumeContent } from '@odie/db'
import type { ResumeContent, SubSectionData } from '@odie/db'

describe('normalizeResumeContent', () => {
  it('returns content unchanged when no position items exist', () => {
    const content: ResumeContent = {
      sections: [
        {
          id: 'experience',
          title: 'Experience',
          items: [
            { type: 'bullet', bulletId: 'b-1' },
            { type: 'subsection', subsectionId: 'sub-1' },
          ],
          subsections: [{ id: 'sub-1', title: 'Engineer' }],
        },
      ],
    }

    const result = normalizeResumeContent(content)

    // Should return the exact same reference (no normalization needed)
    expect(result).toBe(content)
  })

  it('converts position item to subsection item', () => {
    const content: ResumeContent = {
      sections: [
        {
          id: 'experience',
          title: 'Experience',
          items: [
            { type: 'position' as unknown as 'subsection', positionId: 'pos-1' } as unknown as ResumeContent['sections'][0]['items'][0],
          ],
        },
      ],
    }

    const result = normalizeResumeContent(content)

    expect(result.sections[0].items).toEqual([
      { type: 'subsection', subsectionId: 'sub-pos-1' },
    ])
  })

  it('adds SubSectionData entry with correct id, title, and positionId', () => {
    const content: ResumeContent = {
      sections: [
        {
          id: 'experience',
          title: 'Experience',
          items: [
            { type: 'position', positionId: 'pos-1' } as never,
          ],
        },
      ],
    }

    const result = normalizeResumeContent(content)

    const subsections = result.sections[0].subsections!
    expect(subsections).toHaveLength(1)
    expect(subsections[0]).toEqual({
      id: 'sub-pos-1',
      title: '',
      positionId: 'pos-1',
    })
  })

  it('handles multiple position items across multiple sections', () => {
    const content: ResumeContent = {
      sections: [
        {
          id: 'experience',
          title: 'Experience',
          items: [
            { type: 'position', positionId: 'pos-1' } as never,
            { type: 'bullet', bulletId: 'b-1' },
            { type: 'position', positionId: 'pos-2' } as never,
          ],
        },
        {
          id: 'education',
          title: 'Education',
          items: [
            { type: 'position', positionId: 'pos-3' } as never,
          ],
        },
      ],
    }

    const result = normalizeResumeContent(content)

    // Section 1: two position items converted
    expect(result.sections[0].items).toEqual([
      { type: 'subsection', subsectionId: 'sub-pos-1' },
      { type: 'bullet', bulletId: 'b-1' },
      { type: 'subsection', subsectionId: 'sub-pos-2' },
    ])
    expect(result.sections[0].subsections).toHaveLength(2)
    expect(result.sections[0].subsections![0].id).toBe('sub-pos-1')
    expect(result.sections[0].subsections![1].id).toBe('sub-pos-2')

    // Section 2: one position item converted
    expect(result.sections[1].items).toEqual([
      { type: 'subsection', subsectionId: 'sub-pos-3' },
    ])
    expect(result.sections[1].subsections).toHaveLength(1)
    expect(result.sections[1].subsections![0].id).toBe('sub-pos-3')
  })

  it('preserves existing bullet items unchanged', () => {
    const content: ResumeContent = {
      sections: [
        {
          id: 'experience',
          title: 'Experience',
          items: [
            { type: 'bullet', bulletId: 'b-1' },
            { type: 'position', positionId: 'pos-1' } as never,
            { type: 'bullet', bulletId: 'b-2' },
          ],
        },
      ],
    }

    const result = normalizeResumeContent(content)

    const bulletItems = result.sections[0].items.filter((i) => i.type === 'bullet')
    expect(bulletItems).toEqual([
      { type: 'bullet', bulletId: 'b-1' },
      { type: 'bullet', bulletId: 'b-2' },
    ])
  })

  it('preserves existing subsections when adding new ones from position items', () => {
    const existingSubsection: SubSectionData = {
      id: 'sub-existing',
      title: 'Existing Role',
      subtitle: 'Existing Corp',
      startDate: '2020-01-01',
    }

    const content: ResumeContent = {
      sections: [
        {
          id: 'experience',
          title: 'Experience',
          items: [
            { type: 'subsection', subsectionId: 'sub-existing' },
            { type: 'position', positionId: 'pos-new' } as never,
          ],
          subsections: [existingSubsection],
        },
      ],
    }

    const result = normalizeResumeContent(content)

    const subsections = result.sections[0].subsections!
    expect(subsections).toHaveLength(2)
    expect(subsections[0]).toEqual(existingSubsection)
    expect(subsections[1]).toEqual({
      id: 'sub-pos-new',
      title: '',
      positionId: 'pos-new',
    })
  })
})
