import { supabase } from '@odie/db'
import type {
  ChatMessage,
  InterviewStepResponse,
  InterviewPosition,
  InterviewBullet,
} from '@odie/shared'
import { InterviewStepResponseSchema } from '@odie/shared'

export interface InterviewServiceConfig {
  useMock?: boolean
}

export interface InterviewResult {
  response: string
  extractedPosition?: InterviewPosition
  extractedBullets?: InterviewBullet[]
  shouldContinue: boolean
}

/**
 * Mock responses for deterministic testing
 */
const MOCK_RESPONSES: Record<number, InterviewStepResponse> = {
  0: {
    response: "Hi! I'm Odie, your AI career coach. I'll help you build a comprehensive profile for your resume. Let's start with your most recent position. What company are you working at or did you last work at, and what's your title?",
    shouldContinue: true,
  },
  1: {
    response: "Great! You worked at Acme Corp as a Software Engineer. When did you start and end this role? And what city was it in?",
    extractedPosition: {
      company: 'Acme Corp',
      title: 'Software Engineer',
    },
    shouldContinue: true,
  },
  2: {
    response: "Perfect, I have that noted. Now tell me about 3-6 key achievements or projects from this role. What was one impactful project you worked on? Include any metrics like time saved, users impacted, or revenue generated.",
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
    response: "Excellent! That's a strong accomplishment. You reduced API latency by 40% and improved user engagement. What other achievements would you like to highlight from Acme Corp?",
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
    response: "Two great bullets from Acme Corp! Would you like to add any more achievements from this role, or shall we move on to discuss another position?",
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
    response: "Perfect! I've captured your profile. You have 1 position with 2 strong STAR-format bullets. Your bullets showcase Backend and Leadership skills. Would you like to add another position, or are we done for now?",
    shouldContinue: true,
  },
  6: {
    response: "Great! Your interview is complete. I've captured:\n\n**Acme Corp - Software Engineer** (Jan 2022 - Jan 2024)\n- 2 bullets showcasing Backend and Leadership skills\n\nYou can now view and edit your bullets in the Bullets Library, or start drafting a tailored resume.",
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
    body: { messages },
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
export function getInitialMessage(): ChatMessage {
  return {
    id: 'initial',
    role: 'assistant',
    content: MOCK_RESPONSES[0].response,
    timestamp: new Date().toISOString(),
  }
}
