import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RunDetails } from '../../../components/telemetry/RunDetails'
import type { Run } from '@odie/db'

const mockRun: Run = {
  id: 'run-123',
  user_id: 'user-1',
  type: 'interview',
  prompt_id: 'prompt-abc',
  model: 'gpt-4',
  input: { message: 'Hello', context: { role: 'user' } },
  output: { response: 'Hi there!', tokens: 50 },
  success: true,
  latency_ms: 1500,
  tokens_in: 100,
  tokens_out: 50,
  created_at: '2024-01-15T10:30:00Z',
}

describe('RunDetails', () => {
  it('should render run details container', () => {
    render(<RunDetails run={mockRun} />)

    expect(screen.getByTestId('run-details')).toBeInTheDocument()
  })

  it('should display run ID', () => {
    render(<RunDetails run={mockRun} />)

    expect(screen.getByTestId('run-details-id')).toHaveTextContent('run-123')
  })

  it('should display model name', () => {
    render(<RunDetails run={mockRun} />)

    expect(screen.getByTestId('run-details-model')).toHaveTextContent('gpt-4')
  })

  it('should display prompt ID when present', () => {
    render(<RunDetails run={mockRun} />)

    expect(screen.getByTestId('run-details-prompt-id')).toHaveTextContent('prompt-abc')
  })

  it('should not display prompt ID section when null', () => {
    const runWithoutPrompt: Run = { ...mockRun, prompt_id: null }
    render(<RunDetails run={runWithoutPrompt} />)

    expect(screen.queryByTestId('run-details-prompt-id')).not.toBeInTheDocument()
  })

  it('should display formatted input JSON', () => {
    render(<RunDetails run={mockRun} />)

    const inputElement = screen.getByTestId('run-details-input')
    expect(inputElement).toBeInTheDocument()
    expect(inputElement.textContent).toContain('"message": "Hello"')
    expect(inputElement.textContent).toContain('"role": "user"')
  })

  it('should display formatted output JSON', () => {
    render(<RunDetails run={mockRun} />)

    const outputElement = screen.getByTestId('run-details-output')
    expect(outputElement).toBeInTheDocument()
    expect(outputElement.textContent).toContain('"response": "Hi there!"')
    expect(outputElement.textContent).toContain('"tokens": 50')
  })

  it('should handle null input gracefully', () => {
    const runWithNullInput: Run = { ...mockRun, input: null }
    render(<RunDetails run={runWithNullInput} />)

    expect(screen.getByTestId('run-details-input')).toHaveTextContent('null')
  })

  it('should handle null output gracefully', () => {
    const runWithNullOutput: Run = { ...mockRun, output: null }
    render(<RunDetails run={runWithNullOutput} />)

    expect(screen.getByTestId('run-details-output')).toHaveTextContent('null')
  })

  it('should display N/A when model is null', () => {
    const runWithoutModel: Run = { ...mockRun, model: null }
    render(<RunDetails run={runWithoutModel} />)

    expect(screen.getByTestId('run-details-model')).toHaveTextContent('N/A')
  })

  it('should handle complex nested JSON', () => {
    const complexRun: Run = {
      ...mockRun,
      input: {
        messages: [
          { role: 'system', content: 'You are helpful' },
          { role: 'user', content: 'Hello' },
        ],
        options: { temperature: 0.7, maxTokens: 500 },
      },
    }
    render(<RunDetails run={complexRun} />)

    const inputElement = screen.getByTestId('run-details-input')
    expect(inputElement.textContent).toContain('"role": "system"')
    expect(inputElement.textContent).toContain('"temperature": 0.7')
  })
})
