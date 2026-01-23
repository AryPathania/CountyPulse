/**
 * Skills parsing and joining utilities.
 * Ensures consistent handling of comma-separated skills across the codebase.
 */

/** Delimiter used when joining skills for display */
export const SKILLS_DELIMITER = ', '

/**
 * Parse a comma-separated string of skills into an array.
 * Handles whitespace and empty values.
 *
 * @param input - Comma-separated skills string
 * @returns Array of trimmed, non-empty skills
 *
 * @example
 * parseSkills("Python, SQL, React") // returns ["Python", "SQL", "React"]
 * parseSkills("Python,SQL,React")   // returns ["Python", "SQL", "React"]
 * parseSkills(" Python , SQL , ")   // returns ["Python", "SQL"]
 * parseSkills("")                   // returns []
 */
export function parseSkills(input: string): string[] {
  return input
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

/**
 * Join an array of skills into a display string.
 * Returns empty string for null/undefined/empty arrays.
 *
 * @param skills - Array of skills, or null/undefined
 * @returns Comma-and-space-separated string of skills
 *
 * @example
 * joinSkills(["Python", "SQL", "React"]) // returns "Python, SQL, React"
 * joinSkills([])                         // returns ""
 * joinSkills(null)                       // returns ""
 * joinSkills(undefined)                  // returns ""
 */
export function joinSkills(skills: string[] | null | undefined): string {
  return skills?.join(SKILLS_DELIMITER) ?? ''
}
