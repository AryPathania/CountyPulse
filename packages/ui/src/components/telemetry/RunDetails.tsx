import type { Run } from '@odie/db'
import './RunDetails.css'

export interface RunDetailsProps {
  run: Run
}

/**
 * Displays full details of a single run including input/output JSON.
 */
export function RunDetails({ run }: RunDetailsProps) {
  const formatJson = (data: unknown): string => {
    if (data === null || data === undefined) {
      return 'null'
    }
    try {
      return JSON.stringify(data, null, 2)
    } catch {
      return String(data)
    }
  }

  return (
    <div className="run-details" data-testid="run-details">
      <div className="run-details__section">
        <h4 className="run-details__label">Run ID</h4>
        <code className="run-details__value" data-testid="run-details-id">
          {run.id}
        </code>
      </div>

      <div className="run-details__section">
        <h4 className="run-details__label">Model</h4>
        <span className="run-details__value" data-testid="run-details-model">
          {run.model || 'N/A'}
        </span>
      </div>

      {run.prompt_id && (
        <div className="run-details__section">
          <h4 className="run-details__label">Prompt ID</h4>
          <code className="run-details__value" data-testid="run-details-prompt-id">
            {run.prompt_id}
          </code>
        </div>
      )}

      <div className="run-details__section">
        <h4 className="run-details__label">Input</h4>
        <pre className="run-details__json" data-testid="run-details-input">
          {formatJson(run.input)}
        </pre>
      </div>

      <div className="run-details__section">
        <h4 className="run-details__label">Output</h4>
        <pre className="run-details__json" data-testid="run-details-output">
          {formatJson(run.output)}
        </pre>
      </div>
    </div>
  )
}
