import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RunsList } from '../../../components/telemetry/RunsList'
import type { Run } from '@odie/db'

const mockRuns: Run[] = [
  {
    id: 'run-1',
    user_id: 'user-1',
    type: 'interview',
    prompt_id: 'prompt-1',
    model: 'gpt-4',
    input: { message: 'Hello' },
    output: { response: 'Hi!' },
    success: true,
    latency_ms: 1500,
    tokens_in: 100,
    tokens_out: 50,
    created_at: '2024-01-15T10:30:00Z',
  },
  {
    id: 'run-2',
    user_id: 'user-1',
    type: 'embed',
    prompt_id: null,
    model: 'text-embedding-3-small',
    input: { text: 'Test text' },
    output: { embedding: [0.1, 0.2, 0.3] },
    success: true,
    latency_ms: 200,
    tokens_in: 10,
    tokens_out: null,
    created_at: '2024-01-15T10:25:00Z',
  },
  {
    id: 'run-3',
    user_id: 'user-1',
    type: 'draft',
    prompt_id: 'prompt-2',
    model: 'gpt-4',
    input: { bullets: ['bullet1', 'bullet2'] },
    output: { error: 'Rate limit exceeded' },
    success: false,
    latency_ms: 500,
    tokens_in: null,
    tokens_out: null,
    created_at: '2024-01-15T10:20:00Z',
  },
]

describe('RunsList', () => {
  it('should render loading state', () => {
    render(<RunsList runs={[]} loading={true} />)

    expect(screen.getByTestId('runs-list-loading')).toBeInTheDocument()
    expect(screen.getByText('Loading runs...')).toBeInTheDocument()
  })

  it('should render error state', () => {
    const error = new Error('Network error')
    render(<RunsList runs={[]} error={error} />)

    expect(screen.getByTestId('runs-list-error')).toBeInTheDocument()
    expect(screen.getByText(/Network error/)).toBeInTheDocument()
  })

  it('should render empty state when no runs', () => {
    render(<RunsList runs={[]} />)

    expect(screen.getByTestId('runs-list-empty')).toBeInTheDocument()
    expect(screen.getByText('No runs found')).toBeInTheDocument()
  })

  it('should render runs list table', () => {
    render(<RunsList runs={mockRuns} />)

    expect(screen.getByTestId('runs-list')).toBeInTheDocument()
    expect(screen.getByRole('table')).toBeInTheDocument()
  })

  it('should display all run rows', () => {
    render(<RunsList runs={mockRuns} />)

    expect(screen.getByTestId('run-row-run-1')).toBeInTheDocument()
    expect(screen.getByTestId('run-row-run-2')).toBeInTheDocument()
    expect(screen.getByTestId('run-row-run-3')).toBeInTheDocument()
  })

  it('should display run types', () => {
    render(<RunsList runs={mockRuns} />)

    expect(screen.getByTestId('run-type-run-1')).toHaveTextContent('interview')
    expect(screen.getByTestId('run-type-run-2')).toHaveTextContent('embed')
    expect(screen.getByTestId('run-type-run-3')).toHaveTextContent('draft')
  })

  it('should display success status with correct styling', () => {
    render(<RunsList runs={mockRuns} />)

    const successStatus = screen.getByTestId('run-status-run-1')
    expect(successStatus).toHaveTextContent('Success')
    expect(successStatus).toHaveClass('runs-list__status--success')
  })

  it('should display failure status with correct styling', () => {
    render(<RunsList runs={mockRuns} />)

    const failureStatus = screen.getByTestId('run-status-run-3')
    expect(failureStatus).toHaveTextContent('Failure')
    expect(failureStatus).toHaveClass('runs-list__status--failure')
  })

  it('should format latency in milliseconds', () => {
    render(<RunsList runs={mockRuns} />)

    expect(screen.getByTestId('run-latency-run-2')).toHaveTextContent('200ms')
  })

  it('should format latency in seconds for values >= 1000ms', () => {
    render(<RunsList runs={mockRuns} />)

    expect(screen.getByTestId('run-latency-run-1')).toHaveTextContent('1.50s')
  })

  it('should display tokens as in/out format', () => {
    render(<RunsList runs={mockRuns} />)

    expect(screen.getByTestId('run-tokens-run-1')).toHaveTextContent('100 / 50')
  })

  it('should handle null tokens gracefully', () => {
    render(<RunsList runs={mockRuns} />)

    // run-3 has null tokens
    expect(screen.getByTestId('run-tokens-run-3')).toHaveTextContent('N/A')
  })

  it('should display partial tokens with question mark', () => {
    render(<RunsList runs={mockRuns} />)

    // run-2 has tokens_in but null tokens_out
    expect(screen.getByTestId('run-tokens-run-2')).toHaveTextContent('10 / ?')
  })

  it('should display formatted timestamp', () => {
    render(<RunsList runs={mockRuns} />)

    const timeCell = screen.getByTestId('run-time-run-1')
    // Check for date components (format may vary by locale)
    expect(timeCell.textContent).toBeTruthy()
  })

  it('should have expand buttons for each row', () => {
    render(<RunsList runs={mockRuns} />)

    expect(screen.getByTestId('run-expand-run-1')).toBeInTheDocument()
    expect(screen.getByTestId('run-expand-run-2')).toBeInTheDocument()
    expect(screen.getByTestId('run-expand-run-3')).toBeInTheDocument()
  })

  it('should toggle details when expand button is clicked', async () => {
    render(<RunsList runs={mockRuns} />)

    // Initially no details row
    expect(screen.queryByTestId('run-details-row-run-1')).not.toBeInTheDocument()

    // Click expand
    await userEvent.click(screen.getByTestId('run-expand-run-1'))

    // Details row should appear
    expect(screen.getByTestId('run-details-row-run-1')).toBeInTheDocument()

    // Button text should change
    expect(screen.getByTestId('run-expand-run-1')).toHaveTextContent('Hide')
  })

  it('should collapse details when hide button is clicked', async () => {
    render(<RunsList runs={mockRuns} />)

    // Expand first
    await userEvent.click(screen.getByTestId('run-expand-run-1'))
    expect(screen.getByTestId('run-details-row-run-1')).toBeInTheDocument()

    // Click again to collapse
    await userEvent.click(screen.getByTestId('run-expand-run-1'))
    expect(screen.queryByTestId('run-details-row-run-1')).not.toBeInTheDocument()
  })

  it('should only expand one row at a time', async () => {
    render(<RunsList runs={mockRuns} />)

    // Expand first row
    await userEvent.click(screen.getByTestId('run-expand-run-1'))
    expect(screen.getByTestId('run-details-row-run-1')).toBeInTheDocument()

    // Expand second row
    await userEvent.click(screen.getByTestId('run-expand-run-2'))

    // First row should collapse, second should expand
    expect(screen.queryByTestId('run-details-row-run-1')).not.toBeInTheDocument()
    expect(screen.getByTestId('run-details-row-run-2')).toBeInTheDocument()
  })

  it('should set aria-expanded attribute correctly', async () => {
    render(<RunsList runs={mockRuns} />)

    const expandBtn = screen.getByTestId('run-expand-run-1')
    expect(expandBtn).toHaveAttribute('aria-expanded', 'false')

    await userEvent.click(expandBtn)
    expect(expandBtn).toHaveAttribute('aria-expanded', 'true')
  })

  it('should apply expanded row styling', async () => {
    render(<RunsList runs={mockRuns} />)

    const row = screen.getByTestId('run-row-run-1')
    expect(row).not.toHaveClass('runs-list__row--expanded')

    await userEvent.click(screen.getByTestId('run-expand-run-1'))
    expect(row).toHaveClass('runs-list__row--expanded')
  })

  it('should handle null latency', () => {
    const runWithNullLatency: Run = {
      ...mockRuns[0],
      id: 'run-null-latency',
      latency_ms: null,
    }
    render(<RunsList runs={[runWithNullLatency]} />)

    expect(screen.getByTestId('run-latency-run-null-latency')).toHaveTextContent('N/A')
  })
})
