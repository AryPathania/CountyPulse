import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import React from 'react'

const { mockCheckBetaAccess } = vi.hoisted(() => ({
  mockCheckBetaAccess: vi.fn(),
}))

const mockUseAuth = vi.fn()

vi.mock('@odie/db', () => ({
  checkBetaAccess: mockCheckBetaAccess,
}))

vi.mock('../../components/auth/AuthProvider', () => ({
  useAuth: () => mockUseAuth(),
}))

import { useAccess } from '../../hooks/useAccess'

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

describe('useAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns hasAccess=true when checkBetaAccess resolves true', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'user-1' } })
    mockCheckBetaAccess.mockResolvedValue(true)

    const { result } = renderHook(() => useAccess(), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.hasAccess).toBe(true)
    expect(mockCheckBetaAccess).toHaveBeenCalled()
  })

  it('returns hasAccess=false when checkBetaAccess resolves false', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'user-2' } })
    mockCheckBetaAccess.mockResolvedValue(false)

    const { result } = renderHook(() => useAccess(), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.hasAccess).toBe(false)
  })

  it('returns isLoading=true while query is pending', () => {
    mockUseAuth.mockReturnValue({ user: { id: 'user-3' } })
    mockCheckBetaAccess.mockReturnValue(new Promise(() => {})) // never resolves

    const { result } = renderHook(() => useAccess(), { wrapper: createWrapper() })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.hasAccess).toBe(false)
  })

  it('does not call checkBetaAccess when no user is present', () => {
    mockUseAuth.mockReturnValue({ user: null })

    const { result } = renderHook(() => useAccess(), { wrapper: createWrapper() })

    expect(mockCheckBetaAccess).not.toHaveBeenCalled()
    // When disabled, isLoading is false and data is undefined so hasAccess is false
    expect(result.current.hasAccess).toBe(false)
  })

  it('returns hasAccess=false when checkBetaAccess throws', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'user-4' } })
    mockCheckBetaAccess.mockRejectedValue(new Error('Network error'))

    const { result } = renderHook(() => useAccess(), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    // data is undefined on error, so hasAccess = (undefined === true) = false
    expect(result.current.hasAccess).toBe(false)
  })
})
