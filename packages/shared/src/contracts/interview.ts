import { z } from 'zod'

/**
 * Interview contract schemas for LLM output validation
 * Used by the interview pipeline to parse and validate structured responses
 */

// Position extracted from interview conversation
export const PositionSchema = z.object({
  company: z.string().min(1),
  title: z.string().min(1),
  location: z.string().optional(),
  startDate: z.string().optional(), // YYYY-MM format
  endDate: z.string().optional(), // YYYY-MM format or null for current
})

export type InterviewPosition = z.infer<typeof PositionSchema>

// Individual bullet point with STAR format elements
export const BulletSchema = z.object({
  text: z.string().min(10), // STAR bullet text
  category: z.string().optional(), // e.g., "Leadership", "Frontend", "Backend"
  hardSkills: z.array(z.string()).default([]),
  softSkills: z.array(z.string()).default([]),
  metrics: z.object({
    value: z.string().optional(), // e.g., "40%", "$2M", "10k users"
    type: z.string().optional(), // e.g., "latency", "revenue", "adoption"
  }).optional(),
  assumptions: z.string().optional(), // When LLM made assumptions due to vague input
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
  nextQuestion: z.string().optional(), // Follow-up question if more info needed
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
  extractedData: InterviewOutputSchema.optional(),
  status: z.enum(['in_progress', 'completed', 'error']).default('in_progress'),
})

export type InterviewState = z.infer<typeof InterviewStateSchema>

// LLM prompt for interview step
export const InterviewStepResponseSchema = z.object({
  response: z.string(), // Message to show user
  extractedPosition: PositionSchema.optional(), // If position was just captured
  extractedBullets: z.array(BulletSchema).optional(), // If bullets were just captured
  shouldContinue: z.boolean().default(true), // False when interview should end
})

export type InterviewStepResponse = z.infer<typeof InterviewStepResponseSchema>

// Extracted data from interview session
export const ExtractedInterviewDataSchema = z.object({
  positions: z.array(PositionWithBulletsSchema),
})

export type ExtractedInterviewData = z.infer<typeof ExtractedInterviewDataSchema>
