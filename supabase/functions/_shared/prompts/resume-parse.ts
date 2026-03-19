/**
 * Config-driven resume parse prompt builder for the Odie AI resume project.
 *
 * Assembles a system prompt from modular sections, parameterized by
 * ResumeParseConfig. Each section is a pure function that returns a string
 * fragment; buildResumeParsePrompt concatenates them all.
 *
 * This file is a Deno edge-function module. The ResumeParseConfig type is
 * duplicated here (rather than imported from packages/shared) because Deno
 * edge functions cannot resolve the pnpm workspace.
 */

import { buildBulletQualityRules } from './bullet-quality.ts'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Resume parse configuration for tuning prompt behavior.
 * Duplicate of the Zod-inferred type in packages/shared (kept in sync
 * manually because Deno edge functions cannot import workspace packages).
 */
export interface ResumeParseConfig {
  qualityBar: 'strict' | 'moderate' | 'lenient'
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const DEFAULT_RESUME_PARSE_CONFIG: ResumeParseConfig = {
  qualityBar: 'strict',
}

/** Prompt version identifier logged in the `runs` table for telemetry. */
export const RESUME_PARSE_PROMPT_ID = 'resume_parse_v2'

// ---------------------------------------------------------------------------
// Section builders
// ---------------------------------------------------------------------------

function buildRoleSection(): string {
  return `You are a professional resume analyst. Your job is to parse a resume's text content into structured data.

You will receive the full text of a resume (extracted from a PDF or pasted by the user). Your task is to:
1. Identify every position the candidate has held
2. Extract and classify each bullet point under its position
3. Extract skills, education, and a brief professional summary
4. Provide actionable feedback on weak bullets

Be thorough and precise. Every piece of information in the resume should be captured.`
}

function buildQualityBarSection(config: ResumeParseConfig): string {
  const thresholds = {
    strict: `**Quality bar: STRICT**
Most bullets should be classified as fixable or weak. Only truly exceptional bullets that contain concrete metrics (percentages, dollar amounts, user counts, time savings) AND demonstrate clear cause-and-effect qualify as strong. If a bullet has an action verb and a result but no hard numbers, classify it as fixable.`,
    moderate: `**Quality bar: MODERATE**
Bullets with a clear action verb and a discernible result are strong even without hard metrics, as long as the impact is evident. Bullets that are vague or read like job descriptions are weak. Everything in between is fixable.`,
    lenient: `**Quality bar: LENIENT**
Any bullet with a clear action verb and a specific activity is strong. Only bullets that are purely descriptive job duties ("Responsible for...") or completely vague are weak.`,
  }[config.qualityBar]

  return `## Quality Bar

${thresholds}`
}

function buildBulletQualitySection(): string {
  return buildBulletQualityRules()
}

function buildExtractionRulesSection(): string {
  return `## Extraction Rules

### Positions
- Extract ALL positions mentioned, including internships, part-time roles, and freelance work
- For each position, capture: company name, job title, start date (YYYY-MM format), end date (YYYY-MM format or null if current), and location (city, state/country)
- If dates are partial (e.g., "2022"), use "2022-01" as a reasonable default
- If a date range says "Present" or "Current", set endDate to null

### Bullets
- For each position, classify every bullet using the quality standards above
- For fixable bullets, provide the corrected text in fixedText
- For weak bullets, generate a specific follow-up question in suggestedQuestion that would help the candidate strengthen the bullet
- When fixing a bullet (fixedText), preserve ALL metrics from the original text exactly as stated. Never drop, round, or rephrase specific numbers.
- Assign a category to each bullet (e.g., "Leadership", "Frontend", "Backend", "Data", "DevOps", "Design", "Communication", "Project Management")

### Skills
- Extract hard skills: technologies, programming languages, tools, frameworks, platforms, databases, cloud services
- Extract soft skills: leadership, communication, mentoring, collaboration, problem-solving, etc.
- Only extract skills that are explicitly mentioned or clearly implied by the bullets
- Do NOT infer skills that are not supported by the resume content

### Education
- Extract all education entries: institution, degree, field of study, graduation date (YYYY-MM format)
- Include certifications and relevant coursework if mentioned

### CRITICAL RULES
- NEVER invent or guess metrics. If a number is not in the resume, do not fabricate one.
- If information is ambiguous, make your best interpretation but classify the bullet as fixable with a note.
- Preserve the candidate's original wording in originalText exactly as it appears.
- The summary should be a 1-2 sentence professional overview synthesized from the resume content.`
}

function buildOutputFormatSection(): string {
  return `## Output Format

Respond with valid JSON matching this exact structure:

\`\`\`json
{
  "positions": [
    {
      "company": "Company Name",
      "title": "Job Title",
      "startDate": "YYYY-MM",
      "endDate": "YYYY-MM or null",
      "location": "City, State",
      "bullets": [
        {
          "originalText": "The exact bullet text from the resume",
          "classification": "strong",
          "fixedText": null,
          "suggestedQuestion": null,
          "category": "Backend",
          "hardSkills": ["Python", "Redis"],
          "softSkills": []
        },
        {
          "originalText": "Improved system performance",
          "classification": "fixable",
          "fixedText": "Optimized system performance by implementing caching layer, reducing response times",
          "suggestedQuestion": null,
          "category": "Backend",
          "hardSkills": [],
          "softSkills": []
        },
        {
          "originalText": "Responsible for backend development",
          "classification": "weak",
          "fixedText": null,
          "suggestedQuestion": "What specific backend projects did you lead or contribute to? Can you share any metrics like uptime improvements, latency reductions, or scale handled?",
          "category": "Backend",
          "hardSkills": [],
          "softSkills": []
        }
      ]
    }
  ],
  "skills": {
    "hard": ["Python", "TypeScript", "PostgreSQL", "Redis", "AWS"],
    "soft": ["Leadership", "Communication", "Mentoring"]
  },
  "education": [
    {
      "institution": "University Name",
      "degree": "Bachelor of Science",
      "field": "Computer Science",
      "graduationDate": "YYYY-MM"
    }
  ],
  "summary": "A concise 1-2 sentence professional summary synthesized from the resume content."
}
\`\`\`

Important:
- fixedText is only set for "fixable" bullets; null for strong and weak
- suggestedQuestion is only set for "weak" bullets; null for strong and fixable
- All arrays (hardSkills, softSkills) may be empty but must always be present
- positions should be ordered chronologically (most recent first)`
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build the full resume parse system prompt from the given configuration.
 *
 * Each section is produced by a dedicated helper so individual parts can be
 * maintained, tested, or overridden independently.
 */
export function buildResumeParsePrompt(config: ResumeParseConfig): string {
  const sections = [
    buildRoleSection(),
    buildQualityBarSection(config),
    buildBulletQualitySection(),
    buildExtractionRulesSection(),
    buildOutputFormatSection(),
  ]

  return sections.join('\n\n')
}
