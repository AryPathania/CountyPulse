import { supabase } from '@odie/db'
import type {
  ChatMessage,
  InterviewStepResponse,
  InterviewPosition,
  InterviewBullet,
  ProfileEntryCategory,
} from '@odie/shared'
import { InterviewStepResponseSchema } from '@odie/shared'

export interface InterviewServiceConfig {
  useMock?: boolean
  context?: { mode: string; [key: string]: unknown }
}

export interface ExtractedEntry {
  category: ProfileEntryCategory
  title: string
  subtitle?: string | null
  startDate?: string | null
  endDate?: string | null
  location?: string | null
}

export interface InterviewResult {
  response: string
  extractedPosition?: InterviewPosition
  extractedBullets?: InterviewBullet[]
  shouldContinue: boolean
  extractedEntries?: ExtractedEntry[] | null
}

/**
 * Mock responses for deterministic testing
 */
const MOCK_RESPONSES: Record<number, InterviewStepResponse> = {
  0: {
    response: "Hi! I'm Odie, and I'm really excited to learn about your career. I'd love to start with what you're doing now or your most recent role — what company are you at, and what's your title?",
    shouldContinue: true,
  },
  1: {
    response: "Acme Corp, nice! And Software Engineer — that covers a lot of ground. When did you start there, and are you still in that role? And where is the team based?",
    extractedPosition: {
      company: 'Acme Corp',
      title: 'Software Engineer',
    },
    shouldContinue: true,
  },
  2: {
    response: "Got it — two years in San Francisco. That's a solid stint. I'd love to hear about the work itself. What's a project or accomplishment from Acme Corp that you're especially proud of?",
    extractedPosition: {
      company: 'Acme Corp',
      title: 'Software Engineer',
      location: 'San Francisco',
      startDate: '2022-01',
      endDate: '2024-01',
    },
    shouldContinue: true,
  },
  3: {
    response: "A 40% latency reduction is really impressive! I'd love to understand the technical side — what was causing the bottleneck, and what approach did you take to fix it? Do you remember what the response times were before and after?",
    extractedBullets: [
      {
        text: 'Reduced API response latency by 40% through implementing Redis caching and query optimization, resulting in 25% improvement in user engagement metrics',
        category: 'Backend',
        hardSkills: ['Redis', 'SQL', 'Performance Optimization'],
        softSkills: ['Problem Solving'],
        metrics: { value: '40%', type: 'latency' },
      },
    ],
    shouldContinue: true,
  },
  4: {
    response: "Migrating from a monolith to microservices is a huge undertaking — going from 2-hour deploys to 15 minutes must have changed how the whole team worked. How large was the engineering team, and what was your specific role in driving that migration?",
    extractedBullets: [
      {
        text: 'Led migration of legacy monolith to microservices architecture, reducing deployment time from 2 hours to 15 minutes and enabling 10x faster feature releases',
        category: 'Leadership',
        hardSkills: ['Microservices', 'Docker', 'CI/CD'],
        softSkills: ['Leadership', 'Technical Communication'],
        metrics: { value: '10x', type: 'deployment' },
      },
    ],
    shouldContinue: true,
  },
  5: {
    response: "Those are two really strong accomplishments. I'm curious — was there anything else at Acme Corp that you're proud of? Maybe something involving mentoring, a difficult technical challenge, or a project that had a big impact on customers?",
    shouldContinue: true,
  },
  6: {
    response: "Thanks so much for sharing all of that! We covered your time at Acme Corp as a Software Engineer, including your API performance work and the microservices migration. Is there anything else you'd like to add about your career, or are you happy to wrap up?",
    shouldContinue: false,
  },
}

// Start at 1 because index 0 is used by getInitialMessage
let mockMessageCount = 1

/**
 * Reset mock state (for testing)
 */
export function resetMockState(): void {
  mockMessageCount = 1
}

/**
 * Send a message in the interview and get the AI response
 */
export async function sendInterviewMessage(
  messages: ChatMessage[],
  config: InterviewServiceConfig = {}
): Promise<InterviewResult> {
  const { useMock = false } = config

  if (useMock) {
    return getMockResponse()
  }

  // Get current session for auth
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    throw new Error('Not authenticated')
  }

  // Call the interview edge function
  const response = await supabase.functions.invoke('interview', {
    body: { messages, context: config.context },
  })

  if (response.error) {
    throw new Error(response.error.message || 'Interview request failed')
  }

  // Validate the response with Zod
  const parsed = InterviewStepResponseSchema.safeParse(response.data)
  if (!parsed.success) {
    console.error('Invalid interview response:', parsed.error)
    throw new Error('Invalid response format from interview service')
  }

  return {
    response: parsed.data.response,
    extractedPosition: parsed.data.extractedPosition,
    extractedBullets: parsed.data.extractedBullets,
    shouldContinue: parsed.data.shouldContinue,
    extractedEntries: parsed.data.extractedEntries,
  }
}

/**
 * Get mock response for deterministic testing
 */
function getMockResponse(): InterviewResult {
  const response = MOCK_RESPONSES[mockMessageCount] || MOCK_RESPONSES[6]
  mockMessageCount++

  return {
    response: response.response,
    extractedPosition: response.extractedPosition,
    extractedBullets: response.extractedBullets,
    shouldContinue: response.shouldContinue,
  }
}

/**
 * Get the initial greeting message from Odie
 */
export function getInitialMessage(context?: { mode: string; [key: string]: unknown }): ChatMessage {
  let content = MOCK_RESPONSES[0].response

  if (context?.mode === 'resume') {
    content = "Hi! I've had a chance to review your resume, and I can see you have some impressive experience. I'd love to dig deeper into a few areas. First, let me confirm — does the experience I've pulled from your resume look accurate, or is there anything you'd like to correct or add?"
  } else if (context?.mode === 'gaps') {
    content = "Hi! I've been looking at the job you're interested in, and I noticed a few areas where we might be able to strengthen your profile. I'd love to explore your experience in those areas — sometimes people have relevant accomplishments they haven't thought to highlight. Ready to dive in?"
  }

  return {
    id: 'initial',
    role: 'assistant',
    content,
    timestamp: new Date().toISOString(),
  }
}
