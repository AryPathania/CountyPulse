import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const { mockUpsertProfile } = vi.hoisted(() => ({
  mockUpsertProfile: vi.fn(),
}))

vi.mock('@odie/db', () => ({
  upsertProfile: mockUpsertProfile,
}))

import { useProfileSave } from '../../hooks/useProfileSave'
import type { ProfileFormData } from '@odie/shared'

const USER_ID = 'user-123'

const baseData: ProfileFormData = {
  displayName: 'Alice Smith',
  headline: 'Engineer',
  summary: 'Building things',
  phone: '555-1234',
  location: 'NYC',
  links: [{ label: 'GitHub', url: 'https://github.com/alice' }],
}

describe('useProfileSave', () => {
  beforeEach(() => {
    mockUpsertProfile.mockReset()
    mockUpsertProfile.mockResolvedValue({})
  })

  it('calls upsertProfile with all profile fields', async () => {
    const { result } = renderHook(() => useProfileSave(USER_ID))

    await act(async () => {
      await result.current.save(baseData)
    })

    expect(mockUpsertProfile).toHaveBeenCalledWith(USER_ID, {
      display_name: 'Alice Smith',
      headline: 'Engineer',
      summary: 'Building things',
      phone: '555-1234',
      location: 'NYC',
      links: [{ label: 'GitHub', url: 'https://github.com/alice' }],
    })
  })

  it('isSaving is true during save, false after', async () => {
    let resolveUpsert!: () => void
    mockUpsertProfile.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveUpsert = resolve
      }),
    )

    const { result } = renderHook(() => useProfileSave(USER_ID))

    expect(result.current.isSaving).toBe(false)

    let savePromise: Promise<void>
    act(() => {
      savePromise = result.current.save(baseData)
    })

    expect(result.current.isSaving).toBe(true)

    await act(async () => {
      resolveUpsert()
      await savePromise
    })

    expect(result.current.isSaving).toBe(false)
  })

  it('sets error when save throws', async () => {
    mockUpsertProfile.mockRejectedValue(new Error('Network error'))

    const { result } = renderHook(() => useProfileSave(USER_ID))

    await act(async () => {
      await result.current.save(baseData).catch(() => {})
    })

    expect(result.current.error).toBe('Network error')
    expect(result.current.isSaving).toBe(false)
  })

  it('clears error on next successful save', async () => {
    mockUpsertProfile.mockRejectedValueOnce(new Error('First error'))

    const { result } = renderHook(() => useProfileSave(USER_ID))

    await act(async () => {
      await result.current.save(baseData).catch(() => {})
    })

    expect(result.current.error).toBe('First error')

    mockUpsertProfile.mockResolvedValue({})

    await act(async () => {
      await result.current.save(baseData)
    })

    expect(result.current.error).toBeNull()
  })

  it('sets generic error message when thrown value is not an Error', async () => {
    mockUpsertProfile.mockRejectedValue('plain string error')

    const { result } = renderHook(() => useProfileSave(USER_ID))

    await act(async () => {
      await result.current.save(baseData).catch(() => {})
    })

    expect(result.current.error).toBe('Failed to save profile')
  })

  it('succeeds when user has no existing profile row (upsert creates it)', async () => {
    mockUpsertProfile.mockResolvedValue({})

    const { result } = renderHook(() => useProfileSave(USER_ID))

    await act(async () => {
      await result.current.save(baseData)
    })

    expect(mockUpsertProfile).toHaveBeenCalledWith(USER_ID, {
      display_name: 'Alice Smith',
      headline: 'Engineer',
      summary: 'Building things',
      phone: '555-1234',
      location: 'NYC',
      links: [{ label: 'GitHub', url: 'https://github.com/alice' }],
    })
    expect(result.current.error).toBeNull()
  })

  it('surfaces error when upsert fails', async () => {
    mockUpsertProfile.mockRejectedValue(new Error('upsert failed'))

    const { result } = renderHook(() => useProfileSave(USER_ID))

    await act(async () => {
      await result.current.save(baseData).catch(() => {})
    })

    expect(result.current.error).toBe('upsert failed')
  })
})
