import { z } from 'zod'

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

// LLM prompt for interview step
export const InterviewStepResponseSchema = z.object({
  response: z.string(), // Message to show user
  extractedPosition: PositionSchema.nullable(), // If position was just captured (null when none)
  extractedBullets: z.array(BulletSchema).nullable(), // If bullets were just captured (null when none)
  shouldContinue: z.boolean().default(true), // False when interview should end
})

export type InterviewStepResponse = z.infer<typeof InterviewStepResponseSchema>

// Extracted data from interview session
export const ExtractedInterviewDataSchema = z.object({
  positions: z.array(PositionWithBulletsSchema),
})

export type ExtractedInterviewData = z.infer<typeof ExtractedInterviewDataSchema>
