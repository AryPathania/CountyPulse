import { describe, it, expect } from 'vitest'
import { accessKeys } from '../../hooks/useAccess'

describe('accessKeys', () => {
  it('generates correct query key for a user', () => {
    expect(accessKeys.byUser('user-123')).toEqual(['access', 'user-123'])
  })

  it('generates different keys for different users', () => {
    const key1 = accessKeys.byUser('user-1')
    const key2 = accessKeys.byUser('user-2')
    expect(key1).not.toEqual(key2)
  })
})
