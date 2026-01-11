import { useState, useMemo } from 'react'
import { useAuth } from '../components/auth/AuthProvider'
import { Navigation } from '../components/layout'
import { RunsList } from '../components/telemetry'
import { useRecentRuns, type RunType } from '../queries/runs'
import './TelemetryPage.css'

type FilterType = 'all' | RunType

const FILTER_OPTIONS: { value: FilterType; label: string }[] = [
  { value: 'all', label: 'All Types' },
  { value: 'interview', label: 'Interview' },
  { value: 'embed', label: 'Embed' },
  { value: 'draft', label: 'Draft' },
  { value: 'export', label: 'Export' },
  { value: 'bullet_gen', label: 'Bullet Gen' },
]

/**
 * Telemetry Dashboard page.
 * Displays recent LLM runs with filtering and expandable details.
 */
export function TelemetryPage() {
  const { user } = useAuth()
  const [filter, setFilter] = useState<FilterType>('all')

  const {
    data: runs = [],
    isLoading,
    error,
  } = useRecentRuns(user?.id, 100)

  // Filter runs client-side based on selected type
  const filteredRuns = useMemo(() => {
    if (filter === 'all') return runs
    return runs.filter((run) => run.type === filter)
  }, [runs, filter])

  // Calculate summary stats
  const stats = useMemo(() => {
    const total = filteredRuns.length
    const successful = filteredRuns.filter((r) => r.success).length
    const failed = total - successful
    const avgLatency =
      filteredRuns.length > 0
        ? Math.round(
            filteredRuns.reduce((sum, r) => sum + (r.latency_ms ?? 0), 0) /
              filteredRuns.length
          )
        : 0
    const totalTokensIn = filteredRuns.reduce(
      (sum, r) => sum + (r.tokens_in ?? 0),
      0
    )
    const totalTokensOut = filteredRuns.reduce(
      (sum, r) => sum + (r.tokens_out ?? 0),
      0
    )

    return { total, successful, failed, avgLatency, totalTokensIn, totalTokensOut }
  }, [filteredRuns])

  return (
    <div className="telemetry-page" data-testid="telemetry-page">
      <Navigation />

      <header className="telemetry-page__header">
        <h1 className="telemetry-page__title">Telemetry Dashboard</h1>
        <p className="telemetry-page__subtitle">
          Monitor LLM runs and performance metrics
        </p>
      </header>

      <div className="telemetry-page__content">
        {/* Stats Summary */}
        <section className="telemetry-page__stats" data-testid="telemetry-stats">
          <div className="telemetry-page__stat" data-testid="stat-total">
            <span className="telemetry-page__stat-value">{stats.total}</span>
            <span className="telemetry-page__stat-label">Total Runs</span>
          </div>
          <div className="telemetry-page__stat" data-testid="stat-successful">
            <span className="telemetry-page__stat-value telemetry-page__stat-value--success">
              {stats.successful}
            </span>
            <span className="telemetry-page__stat-label">Successful</span>
          </div>
          <div className="telemetry-page__stat" data-testid="stat-failed">
            <span className="telemetry-page__stat-value telemetry-page__stat-value--error">
              {stats.failed}
            </span>
            <span className="telemetry-page__stat-label">Failed</span>
          </div>
          <div className="telemetry-page__stat" data-testid="stat-avg-latency">
            <span className="telemetry-page__stat-value">{stats.avgLatency}ms</span>
            <span className="telemetry-page__stat-label">Avg Latency</span>
          </div>
          <div className="telemetry-page__stat" data-testid="stat-tokens">
            <span className="telemetry-page__stat-value">
              {stats.totalTokensIn.toLocaleString()} / {stats.totalTokensOut.toLocaleString()}
            </span>
            <span className="telemetry-page__stat-label">Tokens (in/out)</span>
          </div>
        </section>

        {/* Filter Controls */}
        <section className="telemetry-page__filters">
          <label htmlFor="type-filter" className="telemetry-page__filter-label">
            Filter by type:
          </label>
          <select
            id="type-filter"
            className="telemetry-page__filter-select"
            value={filter}
            onChange={(e) => setFilter(e.target.value as FilterType)}
            data-testid="telemetry-filter"
          >
            {FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </section>

        {/* Runs List */}
        <section className="telemetry-page__runs">
          <RunsList
            runs={filteredRuns}
            loading={isLoading}
            error={error instanceof Error ? error : null}
          />
        </section>
      </div>
    </div>
  )
}
