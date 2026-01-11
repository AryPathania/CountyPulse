import { useState, Fragment } from 'react'
import type { Run } from '@odie/db'
import { RunDetails } from './RunDetails'
import './RunsList.css'

export interface RunsListProps {
  runs: Run[]
  loading?: boolean
  error?: Error | null
}

/**
 * Displays a table of runs with expandable rows for details.
 */
export function RunsList({ runs, loading, error }: RunsListProps) {
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null)

  const toggleExpand = (runId: string) => {
    setExpandedRunId((prev) => (prev === runId ? null : runId))
  }

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp)
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  const formatLatency = (ms: number | null): string => {
    if (ms === null) return 'N/A'
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(2)}s`
  }

  const formatTokens = (tokensIn: number | null, tokensOut: number | null): string => {
    if (tokensIn === null && tokensOut === null) return 'N/A'
    const inStr = tokensIn !== null ? tokensIn.toLocaleString() : '?'
    const outStr = tokensOut !== null ? tokensOut.toLocaleString() : '?'
    return `${inStr} / ${outStr}`
  }

  if (loading) {
    return (
      <div className="runs-list runs-list--loading" data-testid="runs-list-loading">
        <p>Loading runs...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="runs-list runs-list--error" data-testid="runs-list-error">
        <p>Failed to load runs: {error.message}</p>
      </div>
    )
  }

  if (runs.length === 0) {
    return (
      <div className="runs-list runs-list--empty" data-testid="runs-list-empty">
        <p>No runs found</p>
      </div>
    )
  }

  return (
    <div className="runs-list" data-testid="runs-list">
      <table className="runs-list__table">
        <thead>
          <tr>
            <th className="runs-list__th">Type</th>
            <th className="runs-list__th">Status</th>
            <th className="runs-list__th">Latency</th>
            <th className="runs-list__th">Tokens (in/out)</th>
            <th className="runs-list__th">Time</th>
            <th className="runs-list__th">Actions</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            <Fragment key={run.id}>
              <tr
                className={`runs-list__row ${expandedRunId === run.id ? 'runs-list__row--expanded' : ''}`}
                data-testid={`run-row-${run.id}`}
              >
                <td className="runs-list__td">
                  <span
                    className="runs-list__type-badge"
                    data-testid={`run-type-${run.id}`}
                  >
                    {run.type}
                  </span>
                </td>
                <td className="runs-list__td">
                  <span
                    className={`runs-list__status ${run.success ? 'runs-list__status--success' : 'runs-list__status--failure'}`}
                    data-testid={`run-status-${run.id}`}
                  >
                    {run.success ? 'Success' : 'Failure'}
                  </span>
                </td>
                <td className="runs-list__td" data-testid={`run-latency-${run.id}`}>
                  {formatLatency(run.latency_ms)}
                </td>
                <td className="runs-list__td" data-testid={`run-tokens-${run.id}`}>
                  {formatTokens(run.tokens_in, run.tokens_out)}
                </td>
                <td className="runs-list__td" data-testid={`run-time-${run.id}`}>
                  {formatTimestamp(run.created_at)}
                </td>
                <td className="runs-list__td">
                  <button
                    className="runs-list__expand-btn"
                    onClick={() => toggleExpand(run.id)}
                    aria-expanded={expandedRunId === run.id}
                    data-testid={`run-expand-${run.id}`}
                  >
                    {expandedRunId === run.id ? 'Hide' : 'Details'}
                  </button>
                </td>
              </tr>
              {expandedRunId === run.id && (
                <tr
                  className="runs-list__details-row"
                  data-testid={`run-details-row-${run.id}`}
                >
                  <td colSpan={6}>
                    <RunDetails run={run} />
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}
