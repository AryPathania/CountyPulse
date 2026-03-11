import { describe, it, expect } from 'vitest'
import { groupBulletsByPosition } from '@odie/db'
import type { GroupedBulletsResult } from '@odie/db'

/**
 * Tests for the position-grouping logic extracted from createResumeFromDraft.
 * groupBulletsByPosition is a pure function: no DB calls, fully deterministic.
 */

describe('groupBulletsByPosition', () => {
  it('should group bullets under their position headers in order', () => {
    const bulletIds = ['b1', 'b2', 'b3']
    const bulletRows = [
      { id: 'b1', position_id: 'pos-A' },
      { id: 'b2', position_id: 'pos-A' },
      { id: 'b3', position_id: 'pos-B' },
    ]
    // Positions ordered by start_date desc (pos-A is more recent)
    const orderedPositionIds = ['pos-A', 'pos-B']

    const result = groupBulletsByPosition(bulletIds, bulletRows, orderedPositionIds)

    expect(result.items).toEqual([
      { type: 'subsection', subsectionId: 'sub-pos-A' },
      { type: 'bullet', bulletId: 'b1' },
      { type: 'bullet', bulletId: 'b2' },
      { type: 'subsection', subsectionId: 'sub-pos-B' },
      { type: 'bullet', bulletId: 'b3' },
    ])
    expect(result.subsections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'sub-pos-A', positionId: 'pos-A' }),
        expect.objectContaining({ id: 'sub-pos-B', positionId: 'pos-B' }),
      ])
    )
    expect(result.subsections).toHaveLength(2)
  })

  it('should place orphan bullets (no position_id) at the end', () => {
    const bulletIds = ['b1', 'b2', 'b3']
    const bulletRows = [
      { id: 'b1', position_id: 'pos-A' },
      { id: 'b2', position_id: null },
      { id: 'b3', position_id: null },
    ]
    const orderedPositionIds = ['pos-A']

    const result = groupBulletsByPosition(bulletIds, bulletRows, orderedPositionIds)

    expect(result.items).toEqual([
      { type: 'subsection', subsectionId: 'sub-pos-A' },
      { type: 'bullet', bulletId: 'b1' },
      { type: 'bullet', bulletId: 'b2' },
      { type: 'bullet', bulletId: 'b3' },
    ])
    expect(result.subsections).toHaveLength(1)
    expect(result.subsections[0]).toMatchObject({ id: 'sub-pos-A', positionId: 'pos-A' })
  })

  it('should respect position ordering (start_date desc)', () => {
    const bulletIds = ['b1', 'b2']
    const bulletRows = [
      { id: 'b1', position_id: 'pos-old' },
      { id: 'b2', position_id: 'pos-new' },
    ]
    // pos-new is more recent, comes first
    const orderedPositionIds = ['pos-new', 'pos-old']

    const result = groupBulletsByPosition(bulletIds, bulletRows, orderedPositionIds)

    expect(result.items).toEqual([
      { type: 'subsection', subsectionId: 'sub-pos-new' },
      { type: 'bullet', bulletId: 'b2' },
      { type: 'subsection', subsectionId: 'sub-pos-old' },
      { type: 'bullet', bulletId: 'b1' },
    ])
    expect(result.subsections).toHaveLength(2)
    expect(result.subsections[0]).toMatchObject({ id: 'sub-pos-new', positionId: 'pos-new' })
    expect(result.subsections[1]).toMatchObject({ id: 'sub-pos-old', positionId: 'pos-old' })
  })

  it('should return empty items and subsections when no bulletIds are provided', () => {
    const result: GroupedBulletsResult = groupBulletsByPosition([], [], [])
    expect(result).toEqual({ items: [], subsections: [] })
  })

  it('should handle all orphan bullets (none have positions)', () => {
    const bulletIds = ['b1', 'b2']
    const bulletRows = [
      { id: 'b1', position_id: null },
      { id: 'b2', position_id: null },
    ]

    const result = groupBulletsByPosition(bulletIds, bulletRows, [])

    expect(result.items).toEqual([
      { type: 'bullet', bulletId: 'b1' },
      { type: 'bullet', bulletId: 'b2' },
    ])
    expect(result.subsections).toEqual([])
  })

  it('should preserve bullet order within each position group', () => {
    const bulletIds = ['b3', 'b1', 'b2']
    const bulletRows = [
      { id: 'b1', position_id: 'pos-A' },
      { id: 'b2', position_id: 'pos-A' },
      { id: 'b3', position_id: 'pos-A' },
    ]
    const orderedPositionIds = ['pos-A']

    const result = groupBulletsByPosition(bulletIds, bulletRows, orderedPositionIds)

    // Bullets should appear in the order they were in bulletIds
    expect(result.items).toEqual([
      { type: 'subsection', subsectionId: 'sub-pos-A' },
      { type: 'bullet', bulletId: 'b3' },
      { type: 'bullet', bulletId: 'b1' },
      { type: 'bullet', bulletId: 'b2' },
    ])
    expect(result.subsections).toHaveLength(1)
  })

  it('should skip positions that have no matching bullets', () => {
    const bulletIds = ['b1']
    const bulletRows = [{ id: 'b1', position_id: 'pos-A' }]
    // pos-B is in the ordered list but has no bullets
    const orderedPositionIds = ['pos-A', 'pos-B']

    const result = groupBulletsByPosition(bulletIds, bulletRows, orderedPositionIds)

    // pos-B should not appear since it has no bullets
    expect(result.items).toEqual([
      { type: 'subsection', subsectionId: 'sub-pos-A' },
      { type: 'bullet', bulletId: 'b1' },
    ])
    expect(result.subsections).toHaveLength(1)
    expect(result.subsections[0]).toMatchObject({ id: 'sub-pos-A', positionId: 'pos-A' })
  })

  it('should handle mixed positioned and orphan bullets in original order', () => {
    // Interleaved: orphan, positioned, orphan, positioned
    const bulletIds = ['orphan-1', 'b1', 'orphan-2', 'b2']
    const bulletRows = [
      { id: 'orphan-1', position_id: null },
      { id: 'b1', position_id: 'pos-A' },
      { id: 'orphan-2', position_id: null },
      { id: 'b2', position_id: 'pos-A' },
    ]
    const orderedPositionIds = ['pos-A']

    const result = groupBulletsByPosition(bulletIds, bulletRows, orderedPositionIds)

    // Positioned bullets grouped under their position, orphans at end
    expect(result.items).toEqual([
      { type: 'subsection', subsectionId: 'sub-pos-A' },
      { type: 'bullet', bulletId: 'b1' },
      { type: 'bullet', bulletId: 'b2' },
      { type: 'bullet', bulletId: 'orphan-1' },
      { type: 'bullet', bulletId: 'orphan-2' },
    ])
    expect(result.subsections).toHaveLength(1)
  })

  it('should handle multiple positions with multiple bullets each', () => {
    const bulletIds = ['b1', 'b2', 'b3', 'b4', 'b5']
    const bulletRows = [
      { id: 'b1', position_id: 'pos-A' },
      { id: 'b2', position_id: 'pos-B' },
      { id: 'b3', position_id: 'pos-A' },
      { id: 'b4', position_id: 'pos-B' },
      { id: 'b5', position_id: 'pos-C' },
    ]
    const orderedPositionIds = ['pos-C', 'pos-A', 'pos-B']

    const result = groupBulletsByPosition(bulletIds, bulletRows, orderedPositionIds)

    expect(result.items).toEqual([
      { type: 'subsection', subsectionId: 'sub-pos-C' },
      { type: 'bullet', bulletId: 'b5' },
      { type: 'subsection', subsectionId: 'sub-pos-A' },
      { type: 'bullet', bulletId: 'b1' },
      { type: 'bullet', bulletId: 'b3' },
      { type: 'subsection', subsectionId: 'sub-pos-B' },
      { type: 'bullet', bulletId: 'b2' },
      { type: 'bullet', bulletId: 'b4' },
    ])
    expect(result.subsections).toHaveLength(3)
    expect(result.subsections.map((s) => s.positionId)).toEqual(['pos-C', 'pos-A', 'pos-B'])
  })

  it('should populate subsection details from positionDetails', () => {
    const bulletIds = ['b1']
    const bulletRows = [{ id: 'b1', position_id: 'pos-A' }]
    const orderedPositionIds = ['pos-A']
    const positionDetails = [
      {
        id: 'pos-A',
        company: 'Acme Corp',
        title: 'Engineer',
        start_date: '2023-01-01',
        end_date: '2024-06-01',
        location: 'Remote',
      },
    ]

    const result = groupBulletsByPosition(bulletIds, bulletRows, orderedPositionIds, positionDetails)

    expect(result.subsections).toEqual([
      {
        id: 'sub-pos-A',
        title: 'Engineer',
        subtitle: 'Acme Corp',
        startDate: '2023-01-01',
        endDate: '2024-06-01',
        location: 'Remote',
        positionId: 'pos-A',
      },
    ])
  })
})
