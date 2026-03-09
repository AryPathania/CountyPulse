import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock @odie/db
const mockGetSession = vi.fn()
const mockFunctionsInvoke = vi.fn()

vi.mock('@odie/db', () => ({
  supabase: {
    auth: { getSession: () => mockGetSession() },
    functions: { invoke: (...args: unknown[]) => mockFunctionsInvoke(...args) },
  },
}))

import {
  sendInterviewMessage,
  getInitialMessage,
  resetMockState,
} from '../../services/interview'
import type { ChatMessage } from '@odie/shared'

describe('interview service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMockState()
  })

  const makeMessage = (role: 'user' | 'assistant', content: string): ChatMessage => ({
    id: `msg-${Date.now()}`,
    role,
    content,
    timestamp: new Date().toISOString(),
  })

  describe('getInitialMessage', () => {
    it('returns default greeting for no context', () => {
      const msg = getInitialMessage()
      expect(msg.id).toBe('initial')
      expect(msg.role).toBe('assistant')
      expect(msg.content).toContain("I'm Odie")
      expect(msg.timestamp).toBeTruthy()
    })

    it('returns default greeting for blank context', () => {
      const msg = getInitialMessage({ mode: 'blank' })
      expect(msg.content).toContain("I'm Odie")
    })

    it('returns resume-specific greeting for resume context', () => {
      const msg = getInitialMessage({ mode: 'resume' })
      expect(msg.content).toContain('review your resume')
      expect(msg.content).not.toContain("I'm Odie")
    })

    it('returns gaps-specific greeting for gaps context', () => {
      const msg = getInitialMessage({ mode: 'gaps' })
      expect(msg.content).toContain('strengthen your profile')
      expect(msg.content).not.toContain("I'm Odie")
    })

    it('returns default greeting for unknown context mode', () => {
      const msg = getInitialMessage({ mode: 'unknown' })
      expect(msg.content).toContain("I'm Odie")
    })
  })

  describe('sendInterviewMessage (mock mode)', () => {
    it('returns mock responses in sequence', async () => {
      const messages = [makeMessage('user', 'Hi')]

      const result1 = await sendInterviewMessage(messages, { useMock: true })
      expect(result1.response).toContain('Acme Corp')
      expect(result1.extractedPosition).toBeDefined()
      expect(result1.extractedPosition?.company).toBe('Acme Corp')

      const result2 = await sendInterviewMessage(messages, { useMock: true })
      expect(result2.response).toContain('two years')
      expect(result2.extractedPosition?.location).toBe('San Francisco')
    })

    it('returns shouldContinue false at end of mock conversation', async () => {
      const messages = [makeMessage('user', 'test')]

      // Burn through mock responses to reach the end
      for (let i = 0; i < 5; i++) {
        await sendInterviewMessage(messages, { useMock: true })
      }

      const final = await sendInterviewMessage(messages, { useMock: true })
      expect(final.shouldContinue).toBe(false)
    })

    it('extracts bullets in mock response at step 3', async () => {
      const messages = [makeMessage('user', 'test')]

      // Steps 1, 2 (position extraction), then step 3 (bullets)
      await sendInterviewMessage(messages, { useMock: true })
      await sendInterviewMessage(messages, { useMock: true })
      const result = await sendInterviewMessage(messages, { useMock: true })

      expect(result.extractedBullets).toBeDefined()
      expect(result.extractedBullets).toHaveLength(1)
      expect(result.extractedBullets![0].category).toBe('Backend')
      expect(result.extractedBullets![0].metrics?.value).toBe('40%')
    })

    it('resetMockState resets the counter', async () => {
      const messages = [makeMessage('user', 'test')]

      await sendInterviewMessage(messages, { useMock: true })
      resetMockState()

      const result = await sendInterviewMessage(messages, { useMock: true })
      // Should be back at step 1
      expect(result.response).toContain('Acme Corp')
    })
  })

  describe('sendInterviewMessage (live mode)', () => {
    it('sends messages to edge function and returns parsed response', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: { access_token: 'token' } },
      })

      mockFunctionsInvoke.mockResolvedValue({
        data: {
          response: 'Tell me more about your role',
          extractedPosition: null,
          extractedBullets: null,
          shouldContinue: true,
        },
        error: null,
      })

      const messages = [makeMessage('user', 'I worked at Google')]
      const result = await sendInterviewMessage(messages)

      expect(result.response).toBe('Tell me more about your role')
      expect(result.shouldContinue).toBe(true)
      expect(mockFunctionsInvoke).toHaveBeenCalledWith('interview', {
        body: { messages, context: undefined },
      })
    })

    it('passes context to edge function', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: { access_token: 'token' } },
      })

      mockFunctionsInvoke.mockResolvedValue({
        data: {
          response: 'I see your resume...',
          extractedPosition: null,
          extractedBullets: null,
          shouldContinue: true,
        },
        error: null,
      })

      const context = { mode: 'resume', someData: 'value' }
      const messages = [makeMessage('user', 'Hi')]
      await sendInterviewMessage(messages, { context })

      expect(mockFunctionsInvoke).toHaveBeenCalledWith('interview', {
        body: { messages, context },
      })
    })

    it('throws when not authenticated', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: null },
      })

      const messages = [makeMessage('user', 'test')]

      await expect(sendInterviewMessage(messages)).rejects.toThrow('Not authenticated')
    })

    it('throws when edge function returns error', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: { access_token: 'token' } },
      })

      mockFunctionsInvoke.mockResolvedValue({
        data: null,
        error: { message: 'Function error' },
      })

      const messages = [makeMessage('user', 'test')]

      await expect(sendInterviewMessage(messages)).rejects.toThrow('Function error')
    })

    it('throws on invalid response format', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: { access_token: 'token' } },
      })

      mockFunctionsInvoke.mockResolvedValue({
        data: { invalid: true },
        error: null,
      })

      const messages = [makeMessage('user', 'test')]

      await expect(sendInterviewMessage(messages)).rejects.toThrow(
        'Invalid response format from interview service'
      )
    })
  })
})
