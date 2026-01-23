import { describe, it, expect } from 'vitest'
import { toPostgresDate } from '@odie/shared'

describe('toPostgresDate', () => {
  it('should convert YYYY-MM format to YYYY-MM-01', () => {
    expect(toPostgresDate('2024-03')).toBe('2024-03-01')
    expect(toPostgresDate('2023-12')).toBe('2023-12-01')
    expect(toPostgresDate('2020-01')).toBe('2020-01-01')
  })

  it('should return null for null input', () => {
    expect(toPostgresDate(null)).toBe(null)
  })

  it('should return null for undefined input', () => {
    expect(toPostgresDate(undefined)).toBe(null)
  })

  it('should return null for empty string', () => {
    expect(toPostgresDate('')).toBe(null)
  })

  it('should pass through YYYY-MM-DD format unchanged', () => {
    expect(toPostgresDate('2024-03-15')).toBe('2024-03-15')
    expect(toPostgresDate('2023-12-31')).toBe('2023-12-31')
  })

  it('should pass through other formats unchanged', () => {
    // Let PostgreSQL handle validation for unexpected formats
    expect(toPostgresDate('March 2024')).toBe('March 2024')
    expect(toPostgresDate('2024')).toBe('2024')
  })
})
