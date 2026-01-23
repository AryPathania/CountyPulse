/**
 * Date utilities for converting between interview format and database format.
 * Interview extracts dates as "YYYY-MM", PostgreSQL requires "YYYY-MM-DD".
 */

/**
 * Convert "YYYY-MM" format to PostgreSQL-compatible "YYYY-MM-DD" format.
 * Appends "-01" to use the first day of the month.
 *
 * @param dateString - Date in "YYYY-MM" format, or null/undefined
 * @returns Date in "YYYY-MM-01" format, or null if input is null/undefined/empty
 *
 * @example
 * toPostgresDate("2024-03") // returns "2024-03-01"
 * toPostgresDate(null)       // returns null
 * toPostgresDate(undefined)  // returns null
 * toPostgresDate("2024-03-15") // returns "2024-03-15" (already full date)
 */
export function toPostgresDate(dateString: string | null | undefined): string | null {
  if (!dateString) {
    return null
  }

  // If already in YYYY-MM-DD format, return as-is
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return dateString
  }

  // If in YYYY-MM format, append -01
  if (/^\d{4}-\d{2}$/.test(dateString)) {
    return `${dateString}-01`
  }

  // Return as-is for any other format (let PostgreSQL handle validation)
  return dateString
}
