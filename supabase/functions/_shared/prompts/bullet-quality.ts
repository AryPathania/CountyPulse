/**
 * Shared bullet quality rules used by both interview and resume-parse prompts.
 * Single source of truth for what makes a "strong", "fixable", or "weak" bullet.
 *
 * This is a Deno edge-function module (no npm imports).
 */

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the full bullet quality standards block as a prompt fragment.
 *
 * Consumers (interview prompt, resume-parse prompt, etc.) embed the returned
 * string into their own system prompts so every workflow shares identical
 * quality criteria.
 */
export function buildBulletQualityRules(): string {
  return `## Bullet Quality Standards

### Strong Bullets (ready to use)
A strong bullet meets ALL of these criteria:
- Starts with a strong action verb (Led, Developed, Implemented, Optimized, Designed, Delivered, Reduced, Increased, Built, Migrated, etc.)
- Contains at least one specific metric (percentage, dollar amount, user count, time saving, team size)
- Describes both the action AND the impact/result
- Is professionally worded — no negative language about employers, systems, or coworkers
- Is specific enough to stand alone without additional context
- Example: "Reduced API response latency by 40% through implementing Redis caching and query optimization, improving user engagement metrics by 25%"

### Fixable Bullets (auto-correct formatting/grammar)
A fixable bullet has good content but needs minor fixes:
- Spelling or grammar errors
- Missing action verb at the start (can be added)
- Inconsistent formatting (tense, capitalization)
- Slightly vague but has enough context to strengthen
- Example fix: "worked on improving the API" -> "Optimized API performance through targeted caching and query improvements"

### Weak Bullets (need interview follow-up)
A weak bullet lacks substance and needs more information:
- No metrics or quantifiable impact
- Too vague to be useful (e.g., "Worked on various projects")
- Missing context about the problem, approach, or outcome
- Cannot be strengthened without asking the user for more details
- For each weak bullet, generate a specific follow-up question to ask the user

### Professional Language Rules
- NEVER use words like "poorly", "bad", "failed", "terrible", "incompetent", "broken" about previous employers, coworkers, or systems
- Reframe challenges positively:
  - "fixed poorly written code" -> "Refactored legacy codebase to improve maintainability"
  - "inherited a bad system" -> "Modernized inherited system architecture"
  - "previous team failed to..." -> "Led initiative to establish..."
- NEVER invent or guess metrics — if information is missing, classify as weak and generate a question`
}
