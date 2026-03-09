---
name: prompt-qa
description: Automated prompt quality regression testing. Use when tuning interview prompts to verify behavioral rules are followed.
---

# Prompt QA Skill

## Purpose
Automated regression testing for LLM prompts. Verifies that the interview agent follows behavioral rules by running simulated conversations against the live LLM and checking responses against a rule set.

## When to Use
- After modifying the interview system prompt or config
- When tuning InterviewConfig knobs (metricsEmphasis, followUpDepth, etc.)
- Before deploying prompt changes to production

## Rule Checks
Every LLM response is validated against these rules:

### Hard Rules (must pass)
1. **Ends with question**: Response text must end with a sentence containing "?"
2. **No forbidden words**: Response must NOT contain: "bullet", "STAR", "resume", "extract", "capture", "I'll note", "I'll create", "I'll record", "I've documented"
3. **Valid JSON**: Response must parse as valid JSON matching InterviewStepResponseSchema
4. **shouldContinue logic**: Must be true unless all positions explored AND explicit wrap-up asked

### Soft Rules (warnings, not failures)
1. **Single question**: Response ideally asks one question at a time (not 3+)
2. **Reasonable length**: Response between 50-500 characters
3. **Metrics probing**: When metricsEmphasis is 'high', at least 50% of responses should ask about numbers/metrics

## Test Scenarios

### Scenario 1: Basic Interview Start
User messages: ["I work at Google as a software engineer"]
Expected: Asks about the role (dates, location, or what they work on). Does NOT say "I'll create bullets."

### Scenario 2: Vague Accomplishment
User messages: ["I worked at Google as a SWE", "I improved our system performance"]
Expected: Asks for specifics (what system, what metric, by how much). Does NOT accept vague answer and move on.

### Scenario 3: Metrics Probing
User messages: ["I worked at Google as a SWE", "I built a new caching layer that made things faster"]
Expected: Asks for specific numbers (latency reduction, throughput increase, etc.)

### Scenario 4: Multi-Position Exploration
User messages: ["I worked at Google and then at Meta", "At Google I was a SWE for 2 years"]
Expected: Eventually asks about Meta too. Does NOT set shouldContinue: false after only covering Google.

### Scenario 5: Premature Wrap-up Resistance
User messages: ["I worked at Stripe as an engineer", "I built the billing dashboard", "That's about it"]
Expected: Probes deeper before accepting "that's about it" -- asks about impact, team size, technologies, etc.

## Execution Pattern

When invoked, the prompt-qa process should:

1. Build the prompt using `buildInterviewPrompt(config)` from `supabase/functions/_shared/prompts/interview.ts`
2. For each scenario, send the scripted user messages to the interview edge function (or directly to OpenAI with the system prompt)
3. After each LLM response, run all rule checks
4. Report results:
   - PASS: All hard rules passed
   - WARN: Hard rules passed but soft rule violations
   - FAIL: Any hard rule failed (with details)

## File Locations
- Prompt builder: `supabase/functions/_shared/prompts/interview.ts`
- Config schema: `packages/shared/src/contracts/interview.ts`
- Edge function: `supabase/functions/interview/index.ts`
- Context window: `supabase/functions/_shared/prompts/context.ts`

## Cost Estimate
- ~5 scenarios x 2-3 LLM calls each = 10-15 GPT-4o calls
- Estimated cost: ~$0.05-0.10 per full QA run
- Run on-demand, not in CI
