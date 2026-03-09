import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { buildContextWindow } from '../../../../../supabase/functions/_shared/prompts/context'

interface ContextMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

/** Create a numbered list of alternating user/assistant messages. */
function makeMessages(count: number): ContextMessage[] {
  return Array.from({ length: count }, (_, i) => ({
    role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
    content: `Message ${i + 1}`,
  }))
}

describe('buildContextWindow', () => {
  const originalFetch = globalThis.fetch
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockFetch = vi.fn()
    globalThis.fetch = mockFetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  describe('short conversations (within limit)', () => {
    it('returns messages unchanged when length equals maxMessages', async () => {
      const messages = makeMessages(10)
      const result = await buildContextWindow(messages, 10, 'fake-key')
      expect(result).toEqual(messages)
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('returns messages unchanged when length is below maxMessages', async () => {
      const messages = makeMessages(5)
      const result = await buildContextWindow(messages, 10, 'fake-key')
      expect(result).toEqual(messages)
      expect(mockFetch).not.toHaveBeenCalled()
    })
  })

  describe('long conversations (exceeds limit)', () => {
    const maxMessages = 8

    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [{ message: { content: 'Summary of conversation...' } }],
          }),
      })
    })

    it('result length is at most maxMessages', async () => {
      const messages = makeMessages(15)
      const result = await buildContextWindow(messages, maxMessages, 'fake-key')
      expect(result.length).toBeLessThanOrEqual(maxMessages)
    })

    it('preserves the first 2 messages (head)', async () => {
      const messages = makeMessages(15)
      const result = await buildContextWindow(messages, maxMessages, 'fake-key')
      expect(result[0]).toEqual(messages[0])
      expect(result[1]).toEqual(messages[1])
    })

    it('preserves the last (maxMessages - 3) messages (tail)', async () => {
      const messages = makeMessages(15)
      const tailLength = maxMessages - 3 // 5
      const result = await buildContextWindow(messages, maxMessages, 'fake-key')
      const expectedTail = messages.slice(messages.length - tailLength)
      const actualTail = result.slice(3)
      expect(actualTail).toEqual(expectedTail)
    })

    it('injects a system summary message at index 2', async () => {
      const messages = makeMessages(15)
      const result = await buildContextWindow(messages, maxMessages, 'fake-key')
      const summaryMsg = result[2]
      expect(summaryMsg.role).toBe('system')
      expect(summaryMsg.content).toContain('[Summary of earlier conversation]')
      expect(summaryMsg.content).toContain('Summary of conversation...')
    })
  })

  describe('summary message format', () => {
    it('contains "[Summary of earlier conversation]" prefix', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [{ message: { content: 'Discussed engineering role at Acme Corp.' } }],
          }),
      })

      const messages = makeMessages(12)
      const result = await buildContextWindow(messages, 6, 'fake-key')
      const summaryMsg = result[2]
      expect(summaryMsg.content).toMatch(/^\[Summary of earlier conversation\]:/)
    })
  })

  describe('fetch call details', () => {
    it('calls OpenAI with gpt-4o-mini model', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [{ message: { content: 'A summary' } }],
          }),
      })

      const messages = makeMessages(12)
      await buildContextWindow(messages, 6, 'test-api-key')

      expect(mockFetch).toHaveBeenCalledTimes(1)
      const [url, options] = mockFetch.mock.calls[0]
      expect(url).toBe('https://api.openai.com/v1/chat/completions')

      const body = JSON.parse(options.body)
      expect(body.model).toBe('gpt-4o-mini')
      expect(options.headers['Authorization']).toBe('Bearer test-api-key')
    })
  })

  describe('fallback on fetch failure', () => {
    it('uses truncation fallback when response is not ok', async () => {
      mockFetch.mockResolvedValue({ ok: false })

      const messages = makeMessages(12)
      const result = await buildContextWindow(messages, 6, 'fake-key')

      // Should still return a valid windowed array
      expect(result.length).toBeLessThanOrEqual(6)
      // Head preserved
      expect(result[0]).toEqual(messages[0])
      expect(result[1]).toEqual(messages[1])
      // Summary message still injected (with fallback content)
      expect(result[2].role).toBe('system')
      expect(result[2].content).toContain('[Summary of earlier conversation]')
    })

    it('fallback summary contains truncated message content', async () => {
      mockFetch.mockResolvedValue({ ok: false })

      const messages = makeMessages(12)
      const result = await buildContextWindow(messages, 6, 'fake-key')
      const summaryContent = result[2].content

      // Fallback summarizes first 3 dropped messages with role prefixes
      // Dropped messages start at index 2
      expect(summaryContent).toContain('user:')
    })
  })
})
