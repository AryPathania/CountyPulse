import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockRpc } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
}))

vi.mock('../client', () => ({
  supabase: { rpc: mockRpc },
}))

import { checkBetaAccess } from '../queries/access'

describe('checkBetaAccess', () => {
  beforeEach(() => {
    mockRpc.mockReset()
  })

  it('returns true when RPC returns true', async () => {
    mockRpc.mockResolvedValue({ data: true, error: null })

    const result = await checkBetaAccess()

    expect(result).toBe(true)
    expect(mockRpc).toHaveBeenCalledWith('check_beta_access')
  })

  it('returns false when RPC returns false', async () => {
    mockRpc.mockResolvedValue({ data: false, error: null })

    const result = await checkBetaAccess()

    expect(result).toBe(false)
  })

  it('returns false (fail closed) when RPC returns an error', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockRpc.mockResolvedValue({ data: null, error: { message: 'RPC failed' } })

    const result = await checkBetaAccess()

    expect(result).toBe(false)
    expect(consoleSpy).toHaveBeenCalledWith('Beta access check failed:', 'RPC failed')
    consoleSpy.mockRestore()
  })

  it('returns false when RPC returns null data without error', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null })

    const result = await checkBetaAccess()

    expect(result).toBe(false)
  })

  it('returns false when RPC returns a non-boolean truthy value', async () => {
    mockRpc.mockResolvedValue({ data: 'yes', error: null })

    const result = await checkBetaAccess()

    // Strict equality check: data === true, so 'yes' returns false
    expect(result).toBe(false)
  })

  it('returns false (fail closed) when RPC throws a network error', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockRpc.mockRejectedValue(new Error('Network error'))

    const result = await checkBetaAccess()

    expect(result).toBe(false)
    expect(consoleSpy).toHaveBeenCalledWith('Beta access check failed:', 'Network error')
    consoleSpy.mockRestore()
  })
})
