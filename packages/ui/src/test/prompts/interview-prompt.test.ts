import { describe, it, expect } from 'vitest'
import {
  buildInterviewPrompt,
  DEFAULT_INTERVIEW_CONFIG,
  INTERVIEW_PROMPT_ID,
  type InterviewConfig,
} from '../../../../../supabase/functions/_shared/prompts/interview'

/** Helper to build a config with specific overrides. */
function configWith(overrides: Partial<InterviewConfig>): InterviewConfig {
  return { ...DEFAULT_INTERVIEW_CONFIG, ...overrides }
}

describe('buildInterviewPrompt', () => {
  it('returns a non-empty string with default config', () => {
    const prompt = buildInterviewPrompt(DEFAULT_INTERVIEW_CONFIG)
    expect(prompt).toBeTruthy()
    expect(typeof prompt).toBe('string')
    expect(prompt.length).toBeGreaterThan(100)
  })

  it('contains all required sections', () => {
    const prompt = buildInterviewPrompt(DEFAULT_INTERVIEW_CONFIG)

    // Persona
    expect(prompt).toContain('You are Odie')
    // Critical rules
    expect(prompt).toContain('ABSOLUTE RULES')
    // Strategy
    expect(prompt).toContain('Interview Strategy')
    // Approach
    expect(prompt).toContain('Interview Approach')
    // Few-shot examples
    expect(prompt).toContain('Example Conversations')
    // Anti-patterns
    expect(prompt).toContain('Things You Must NEVER Do')
    // Internal reasoning
    expect(prompt).toContain('Internal Reasoning')
    // Professional language
    expect(prompt).toContain('Professional Language')
    // Data extraction
    expect(prompt).toContain('Internal Data Extraction')
    // Output format
    expect(prompt).toContain('Response Format')
  })

  describe('metricsEmphasis config', () => {
    it('high emphasis contains "Metrics are essential"', () => {
      const prompt = buildInterviewPrompt(configWith({ metricsEmphasis: 'high' }))
      expect(prompt).toContain('Metrics are essential')
    })

    it('medium emphasis contains "Metrics are valuable but optional"', () => {
      const prompt = buildInterviewPrompt(configWith({ metricsEmphasis: 'medium' }))
      expect(prompt).toContain('Metrics are valuable but optional')
    })

    it('low emphasis contains "Focus on the narrative"', () => {
      const prompt = buildInterviewPrompt(configWith({ metricsEmphasis: 'low' }))
      expect(prompt).toContain('Focus on the narrative')
    })
  })

  describe('followUpDepth config', () => {
    it('depth 3 produces "at least 3 follow-up questions"', () => {
      const prompt = buildInterviewPrompt(configWith({ followUpDepth: 3 }))
      expect(prompt).toContain('at least 3 follow-up questions')
    })

    it('depth 5 produces "at least 5 follow-up questions"', () => {
      const prompt = buildInterviewPrompt(configWith({ followUpDepth: 5 }))
      expect(prompt).toContain('at least 5 follow-up questions')
    })
  })

  describe('explorationStyle config', () => {
    it('focused style contains "Stay closely on the current topic"', () => {
      const prompt = buildInterviewPrompt(configWith({ explorationStyle: 'focused' }))
      expect(prompt).toContain('Stay closely on the current topic')
    })

    it('exploratory style contains "Actively look for tangential topics"', () => {
      const prompt = buildInterviewPrompt(configWith({ explorationStyle: 'exploratory' }))
      expect(prompt).toContain('Actively look for tangential topics')
    })

    it('balanced style contains "note interesting tangents"', () => {
      const prompt = buildInterviewPrompt(configWith({ explorationStyle: 'balanced' }))
      expect(prompt).toContain('note interesting tangents')
    })
  })

  describe('minBulletsPerPosition config', () => {
    it('value 4 produces "At least 4 achievement details"', () => {
      const prompt = buildInterviewPrompt(configWith({ minBulletsPerPosition: 4 }))
      expect(prompt).toContain('At least 4 achievement details')
    })

    it('value 6 produces "At least 6 achievement details"', () => {
      const prompt = buildInterviewPrompt(configWith({ minBulletsPerPosition: 6 }))
      expect(prompt).toContain('At least 6 achievement details')
    })
  })

  it('contains anti-pattern examples (forbidden phrases)', () => {
    const prompt = buildInterviewPrompt(DEFAULT_INTERVIEW_CONFIG)
    expect(prompt).toContain("I'll create a bullet point")
  })
})

describe('INTERVIEW_PROMPT_ID', () => {
  it('equals "interview_v3"', () => {
    expect(INTERVIEW_PROMPT_ID).toBe('interview_v3')
  })
})

describe('DEFAULT_INTERVIEW_CONFIG', () => {
  it('has expected default values', () => {
    expect(DEFAULT_INTERVIEW_CONFIG.metricsEmphasis).toBe('high')
    expect(DEFAULT_INTERVIEW_CONFIG.followUpDepth).toBe(3)
    expect(DEFAULT_INTERVIEW_CONFIG.explorationStyle).toBe('exploratory')
    expect(DEFAULT_INTERVIEW_CONFIG.minBulletsPerPosition).toBe(4)
    expect(DEFAULT_INTERVIEW_CONFIG.maxMessagesInContext).toBe(20)
    expect(DEFAULT_INTERVIEW_CONFIG.temperature).toBe(0.7)
    expect(DEFAULT_INTERVIEW_CONFIG.maxTokens).toBe(2000)
  })
})
