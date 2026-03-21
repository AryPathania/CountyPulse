import { z } from 'zod'
import { ResumeEducationSchema, SkillsSchema } from './resume-parse'
import { ProfileEntryCategorySchema } from './profile'

/**
 * Interview contract schemas for LLM output validation
 * Used by the interview pipeline to parse and validate structured responses
 */

// Position extracted from interview conversation
export const PositionSchema = z.object({
  company: z.string().min(1),
  title: z.string().min(1),
  location: z.string().nullish(), // LLM may return null
  startDate: z.string().nullish(), // YYYY-MM format, LLM may return null
  endDate: z.string().nullish(), // YYYY-MM format or null for current
})

export type InterviewPosition = z.infer<typeof PositionSchema>

// Individual bullet point with STAR format elements
export const BulletSchema = z.object({
  text: z.string().min(10), // STAR bullet text
  category: z.string().nullish(), // e.g., "Leadership", "Frontend", "Backend"
  hardSkills: z.array(z.string()).default([]),
  softSkills: z.array(z.string()).default([]),
  metrics: z.object({
    value: z.string().nullish(), // e.g., "40%", "$2M", "10k users"
    type: z.string().nullish(), // e.g., "latency", "revenue", "adoption"
  }).nullish(), // LLM may return null for entire metrics object
  assumptions: z.string().nullish(), // When LLM made assumptions due to vague input
})

export type InterviewBullet = z.infer<typeof BulletSchema>

// Position with its associated bullets
export const PositionWithBulletsSchema = z.object({
  position: PositionSchema,
  bullets: z.array(BulletSchema),
})

export type PositionWithBullets = z.infer<typeof PositionWithBulletsSchema>

// Complete interview output from LLM
export const InterviewOutputSchema = z.object({
  positions: z.array(PositionWithBulletsSchema),
  isComplete: z.boolean().default(false), // True when interview is finished
  nextQuestion: z.string().nullish(), // Follow-up question if more info needed
})

export type InterviewOutput = z.infer<typeof InterviewOutputSchema>

// Chat message types for the interview UI
export const MessageRoleSchema = z.enum(['user', 'assistant', 'system'])
export type MessageRole = z.infer<typeof MessageRoleSchema>

export const ChatMessageSchema = z.object({
  id: z.string(),
  role: MessageRoleSchema,
  content: z.string(),
  timestamp: z.string(), // ISO timestamp
})

export type ChatMessage = z.infer<typeof ChatMessageSchema>

// Interview state for tracking progress
export const InterviewStateSchema = z.object({
  messages: z.array(ChatMessageSchema),
  currentPositionIndex: z.number().default(0),
  extractedData: InterviewOutputSchema.nullish(), // LLM may return null
  status: z.enum(['in_progress', 'completed', 'error']).default('in_progress'),
})

export type InterviewState = z.infer<typeof InterviewStateSchema>

// Shared schema for extracted profile entries (education, certs, awards, etc.)
export const ExtractedEntrySchema = z.object({
  category: ProfileEntryCategorySchema,
  title: z.string(),
  subtitle: z.string().nullish(),
  startDate: z.string().nullish(),
  endDate: z.string().nullish(),
  location: z.string().nullish(),
})

export type ExtractedEntry = z.infer<typeof ExtractedEntrySchema>

// LLM prompt for interview step
export const InterviewStepResponseSchema = z.object({
  response: z.string(), // Message to show user
  extractedPosition: PositionSchema.nullable(), // If position was just captured (null when none)
  extractedBullets: z.array(BulletSchema).nullable(), // If bullets were just captured (null when none)
  shouldContinue: z.boolean().default(true), // False when interview should end
  extractedEntries: z.array(ExtractedEntrySchema).nullable().default(null),
})

export type InterviewStepResponse = z.infer<typeof InterviewStepResponseSchema>

// Extracted data from interview session
export const ExtractedInterviewDataSchema = z.object({
  positions: z.array(PositionWithBulletsSchema),
  entries: z.array(ExtractedEntrySchema).default([]),
})

export type ExtractedInterviewData = z.infer<typeof ExtractedInterviewDataSchema>

// Interview context schemas for different interview modes

// Blank context: no prior data, start from scratch
export const BlankContextSchema = z.object({
  mode: z.literal('blank'),
})

export type BlankContext = z.infer<typeof BlankContextSchema>

// Resume context: pre-populated from parsed resume data
export const ResumeContextSchema = z.object({
  mode: z.literal('resume'),
  strongBullets: z.array(BulletSchema),
  weakBullets: z.array(z.object({
    originalText: z.string(),
    suggestedQuestion: z.string(),
  })),
  positions: z.array(PositionSchema),
  skills: SkillsSchema,
  education: z.array(ResumeEducationSchema).default([]),
})

export type ResumeContext = z.infer<typeof ResumeContextSchema>

// Gap context: fill gaps between resume and job description
export const GapContextSchema = z.object({
  mode: z.literal('gaps'),
  gaps: z.array(z.object({
    requirement: z.string(),
    category: z.string(),
    importance: z.enum(['must_have', 'nice_to_have']),
  })),
  existingBulletSummary: z.string(),
  jobTitle: z.string(),
  company: z.string().nullish(),
})

export type GapContext = z.infer<typeof GapContextSchema>

// Discriminated union of all interview context modes
export const InterviewContextSchema = z.discriminatedUnion('mode', [
  BlankContextSchema,
  ResumeContextSchema,
  GapContextSchema,
])

export type InterviewContext = z.infer<typeof InterviewContextSchema>

// Interview configuration for tuning prompt behavior
export const InterviewConfigSchema = z.object({
  metricsEmphasis: z.enum(['low', 'medium', 'high']).default('high'),
  followUpDepth: z.number().min(1).max(10).default(3),
  explorationStyle: z.enum(['focused', 'balanced', 'exploratory']).default('exploratory'),
  minBulletsPerPosition: z.number().min(1).max(10).default(4),
  maxMessagesInContext: z.number().min(5).max(100).default(20),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().min(500).max(4000).default(2000),
  context: InterviewContextSchema.default({ mode: 'blank' }),
})

export type InterviewConfig = z.infer<typeof InterviewConfigSchema>
