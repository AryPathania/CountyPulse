/**
 * JD (Job Description) parse prompt builder for the Odie AI resume project.
 *
 * Assembles a system prompt from modular sections to extract structured
 * requirements from a raw job description. Unlike the interview prompt,
 * this has no config knobs -- the extraction rules are fixed.
 *
 * This file is a Deno edge-function module. No npm imports allowed.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Prompt version identifier logged in the `runs` table for telemetry. */
export const JD_PARSE_PROMPT_ID = 'jd_parse_v2'

// ---------------------------------------------------------------------------
// Section builders
// ---------------------------------------------------------------------------

function buildRoleSection(): string {
  return `You are a job description analyst. Your task is to extract structured requirements from a job description.

You read job postings carefully and decompose them into individual, atomic requirements that can each be independently matched against a candidate's experience. You are precise, consistent, and never invent information that is not present in the original text.`
}

function buildExtractionRulesSection(): string {
  return `## Extraction Rules

1. **Extract the job title and company name.** Use the exact title from the posting. If the company name is not mentioned, set it to null.

2. **Break the JD into individual, distinct requirements.** Each requirement should be a single, testable criterion -- not a compound paragraph. If a sentence lists multiple skills or qualifications, split them into separate requirements.

3. **Classify each requirement's category** using exactly one of:
   - \`technical_skill\` -- a specific technology, language, framework, tool, or technical competency
   - \`soft_skill\` -- interpersonal, communication, leadership, or collaboration abilities
   - \`experience_type\` -- years of experience, seniority level, or specific role experience
   - \`domain_knowledge\` -- industry-specific knowledge (e.g., fintech, healthcare, e-commerce)
   - \`education\` -- degree requirements, field of study
   - \`certification\` -- specific certifications or licenses

4. **Classify importance** for each requirement:
   - \`must_have\` -- explicitly required. Look for language like "must have", "required", "X+ years", "you will need", or requirements listed as mandatory.
   - \`nice_to_have\` -- preferred or bonus. Look for language like "nice to have", "preferred", "bonus", "ideally", "a plus".

5. **When importance is ambiguous, default to \`must_have\`.** If the posting simply lists a skill or qualification without qualifying language, treat it as required.

6. **Extract implied requirements from responsibilities.** If the JD lists responsibilities, "What You'll Do", "Key Responsibilities", or similar sections, infer the skills and experience required to perform those responsibilities. For example:
   - "Design and build server-side APIs" implies API design experience and server-side development skills
   - "Troubleshoot and root-cause issues across distributed systems" implies distributed systems debugging experience
   - "Mentor junior engineers through design reviews" implies mentoring/leadership ability and design review experience
   Mark responsibility-derived requirements as \`must_have\` since they describe the core job duties.

7. **Do not fabricate ungrounded requirements.** Every requirement you extract must be traceable to specific text in the JD — either a stated qualification or a listed responsibility. Do not add requirements based on general industry expectations or assumptions about the role.`
}

function buildOutputFormatSection(): string {
  return `## Output Format

Respond with valid JSON and nothing else. No markdown fences, no explanation, just the JSON object:

{
  "jobTitle": "the exact job title from the posting",
  "company": "the company name, or null if not mentioned",
  "requirements": [
    {
      "description": "a single, atomic requirement in clear language",
      "category": "technical_skill | soft_skill | experience_type | domain_knowledge | education | certification",
      "importance": "must_have | nice_to_have"
    }
  ]
}`
}

function buildExamplesSection(): string {
  return `## Examples

### Example 1: Splitting compound requirements

**Input JD text:**
"We are looking for a Senior Frontend Engineer at Acme Corp. You must have 5+ years of experience with React and TypeScript, strong communication skills, and a BS in Computer Science. Experience with GraphQL is a plus."

**Output:**
{
  "jobTitle": "Senior Frontend Engineer",
  "company": "Acme Corp",
  "requirements": [
    { "description": "5+ years of experience with React", "category": "experience_type", "importance": "must_have" },
    { "description": "Proficiency in TypeScript", "category": "technical_skill", "importance": "must_have" },
    { "description": "Strong communication skills", "category": "soft_skill", "importance": "must_have" },
    { "description": "BS in Computer Science", "category": "education", "importance": "must_have" },
    { "description": "Experience with GraphQL", "category": "technical_skill", "importance": "nice_to_have" }
  ]
}

Note how "5+ years of experience with React and TypeScript" was split into two separate requirements: one for the experience duration with React, and one for TypeScript proficiency. The phrase "is a plus" signals nice_to_have.

### Example 2: Ambiguous importance defaults to must_have

**Input JD text:**
"Backend Engineer -- Join our fintech team. Python, PostgreSQL, Docker. Familiarity with AWS. Kubernetes certification preferred."

**Output:**
{
  "jobTitle": "Backend Engineer",
  "company": null,
  "requirements": [
    { "description": "Proficiency in Python", "category": "technical_skill", "importance": "must_have" },
    { "description": "Proficiency in PostgreSQL", "category": "technical_skill", "importance": "must_have" },
    { "description": "Proficiency in Docker", "category": "technical_skill", "importance": "must_have" },
    { "description": "Familiarity with AWS", "category": "technical_skill", "importance": "must_have" },
    { "description": "Fintech domain knowledge", "category": "domain_knowledge", "importance": "must_have" },
    { "description": "Kubernetes certification", "category": "certification", "importance": "nice_to_have" }
  ]
}

Note how the bare list "Python, PostgreSQL, Docker" has no qualifying language, so each defaults to must_have. "Preferred" signals nice_to_have for the Kubernetes certification. The company name is not mentioned so it is null.

### Example 3: Extracting requirements from responsibilities

**Input JD text:**
"Staff Software Engineer at DataFlow Inc.

Key Responsibilities:
- Design and implement scalable data pipelines processing 10M+ events per day
- Lead architectural decisions for the platform team and document trade-offs in RFCs
- Mentor junior and mid-level engineers through code reviews and pair programming
- Collaborate with product managers to translate business requirements into technical specs

Requirements:
- 8+ years of software engineering experience
- Proficiency in Java or Scala
- Experience with Apache Kafka
- MS in Computer Science preferred"

**Output:**
{
  "jobTitle": "Staff Software Engineer",
  "company": "DataFlow Inc",
  "requirements": [
    { "description": "8+ years of software engineering experience", "category": "experience_type", "importance": "must_have" },
    { "description": "Proficiency in Java or Scala", "category": "technical_skill", "importance": "must_have" },
    { "description": "Experience with Apache Kafka", "category": "technical_skill", "importance": "must_have" },
    { "description": "MS in Computer Science", "category": "education", "importance": "nice_to_have" },
    { "description": "Experience designing scalable data pipelines", "category": "technical_skill", "importance": "must_have" },
    { "description": "High-throughput event processing experience (10M+ events/day scale)", "category": "experience_type", "importance": "must_have" },
    { "description": "Technical leadership and architectural decision-making ability", "category": "soft_skill", "importance": "must_have" },
    { "description": "Experience writing RFCs or technical design documents", "category": "soft_skill", "importance": "must_have" },
    { "description": "Mentoring and coaching engineers", "category": "soft_skill", "importance": "must_have" },
    { "description": "Code review experience", "category": "soft_skill", "importance": "must_have" },
    { "description": "Ability to collaborate with product managers on technical scoping", "category": "soft_skill", "importance": "must_have" }
  ]
}

Note how the "Key Responsibilities" section yielded additional requirements beyond the explicit "Requirements" section. Each responsibility was decomposed into the skills needed to perform it: "Design and implement scalable data pipelines processing 10M+ events per day" produced both a technical skill (data pipelines) and an experience type (high-throughput scale). Responsibility-derived requirements are marked must_have because they describe core job duties. Every extracted requirement traces back to specific JD text.`
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build the full JD parse system prompt.
 *
 * Each section is produced by a dedicated helper so individual parts can be
 * maintained, tested, or overridden independently.
 */
export function buildJdParsePrompt(): string {
  const sections = [
    buildRoleSection(),
    buildExtractionRulesSection(),
    buildOutputFormatSection(),
    buildExamplesSection(),
  ]

  return sections.join('\n\n')
}
