/**
 * Shared authentication utilities for Supabase edge functions.
 */

/**
 * Extract the JWT token from an Authorization header.
 * Removes the "Bearer " prefix from the header value.
 *
 * @param header - The Authorization header value (e.g., "Bearer eyJ...")
 * @returns The JWT token without the "Bearer " prefix
 *
 * @example
 * extractBearerToken("Bearer eyJhbGciOiJIUzI1NiIs...") // returns "eyJhbGciOiJIUzI1NiIs..."
 */
export function extractBearerToken(header: string): string {
  return header.replace('Bearer ', '')
}
