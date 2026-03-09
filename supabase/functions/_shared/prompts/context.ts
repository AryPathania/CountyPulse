/**
 * Context window management for interview conversations.
 *
 * When conversations exceed maxMessages, older messages (between the
 * initial greeting exchange and the recent tail) are summarized via
 * gpt-4o-mini so the model retains awareness of positions and
 * accomplishments discussed earlier without exceeding the token budget.
 *
 * Only `buildContextWindow` is exported. The summarization helper is
 * an internal implementation detail.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ContextMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SUMMARY_PROMPT = `Summarize this interview conversation in 2-3 concise sentences. Include:
- Positions/roles discussed (company names and titles)
- Key accomplishments or projects mentioned
- Any specific metrics or numbers shared
- Topics still being actively explored

Be factual and concise. This summary will be used to maintain context in a longer conversation.`

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Summarize a set of messages using gpt-4o-mini.
 *
 * If the OpenAI call fails for any reason the function falls back to a
 * deterministic truncation so the caller always receives a usable string.
 */
async function summarizeMessages(
  messages: ContextMessage[],
  openaiApiKey: string,
): Promise<string> {
  const conversationText = messages
    .map((m) => `${m.role}: ${m.content}`)
    .join('\n')

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SUMMARY_PROMPT },
        { role: 'user', content: conversationText },
      ],
      temperature: 0.3,
      max_tokens: 300,
    }),
  })

  if (!response.ok) {
    console.error('Summary generation failed, falling back to truncation')
    return messages
      .slice(0, 3)
      .map((m) => `${m.role}: ${m.content.slice(0, 100)}`)
      .join('; ')
  }

  const data = await response.json()
  return data.choices[0].message.content
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build a context window from conversation messages.
 *
 * When the number of messages is within `maxMessages` the array is returned
 * unchanged. Otherwise the function:
 *
 *   1. Keeps the first 2 messages (the greeting exchange that establishes
 *      the conversational frame).
 *   2. Summarizes the "dropped" middle messages into a single system
 *      message via `summarizeMessages`.
 *   3. Keeps the most recent `maxMessages - 3` messages (subtracting 2
 *      for the head and 1 for the injected summary).
 *
 * The returned array length is always <= maxMessages.
 */
export async function buildContextWindow(
  messages: ContextMessage[],
  maxMessages: number,
  openaiApiKey: string,
): Promise<ContextMessage[]> {
  if (messages.length <= maxMessages) return messages

  // Number of recent messages to preserve (head=2, summary=1, rest=tail)
  const tailLength = maxMessages - 3
  const head = messages.slice(0, 2)
  const dropped = messages.slice(2, messages.length - tailLength)
  const tail = messages.slice(messages.length - tailLength)

  const summary = await summarizeMessages(dropped, openaiApiKey)
  const summaryMessage: ContextMessage = {
    role: 'system',
    content: `[Summary of earlier conversation]: ${summary}`,
  }

  return [...head, summaryMessage, ...tail]
}
