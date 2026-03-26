import { useState } from 'react'
import type { InterviewContext, CoveredRequirement, TriageDecision } from '@odie/shared'
import { JD_CATEGORY_LABELS } from '@odie/shared'
import type { PartialCoveredItem, GapItem } from '../../services/jd-processing'
import { hashRequirementDescription } from '../../services/jd-processing'
import { StartInterviewButton } from '../interview/StartInterviewButton'
import './GapAnalysis.css'

// UI-specific covered requirement shape (bullet fields renamed for display)
interface CoveredRequirementDisplay {
  requirement: CoveredRequirement['requirement']
  matchedBullets: Array<{ id: string; text: string; similarity: number }>
}

export interface GapAnalysisProps {
  jobTitle: string
  company: string | null
  covered: CoveredRequirementDisplay[]
  partiallyCovered: PartialCoveredItem[]
  gaps: GapItem[]
  totalRequirements: number
  coveredCount: number
  interviewContext: InterviewContext | null
  triageDecisions: Record<string, TriageDecision>
  onTriageDecision: (requirementDescription: string, decision: TriageDecision) => void
  untriagedCount: number
  fitSummary?: string
  refineFailed?: boolean
}

const BULK_ACTION_THRESHOLD = 8

export function GapAnalysis({
  jobTitle,
  company,
  covered,
  partiallyCovered,
  gaps,
  totalRequirements,
  coveredCount,
  interviewContext,
  triageDecisions,
  onTriageDecision,
  untriagedCount,
  fitSummary,
  refineFailed,
}: GapAnalysisProps) {
  const [expandedReq, setExpandedReq] = useState<string | null>(null)

  // Filter items by triage status for display
  const untriagedGaps = gaps.filter(g => !triageDecisions[hashRequirementDescription(g.requirement.description)])
  const untriagedPartials = partiallyCovered.filter(p => !triageDecisions[hashRequirementDescription(p.requirement.description)])
  const triagedItems = [...gaps, ...partiallyCovered].filter(item => {
    const key = hashRequirementDescription(item.requirement.description)
    return !!triageDecisions[key]
  })

  const handleBulkInterview = () => {
    for (const g of untriagedGaps) {
      onTriageDecision(g.requirement.description, 'interview')
    }
    for (const p of untriagedPartials) {
      onTriageDecision(p.requirement.description, 'interview')
    }
  }

  return (
    <div className="gap-analysis" data-testid="gap-analysis">
      <div className="gap-analysis__header">
        <h3 className="gap-analysis__title">
          Requirements Analysis: {jobTitle}{company ? ` at ${company}` : ''}
        </h3>
        <p className="gap-analysis__summary" data-testid="gap-summary">
          {coveredCount}/{totalRequirements} requirements covered
          {partiallyCovered.length > 0 && `, ${partiallyCovered.length} partial`}
          {gaps.length > 0 && `, ${gaps.length} gap${gaps.length !== 1 ? 's' : ''}`}
        </p>
      </div>

      {refineFailed && (
        <div className="gap-analysis__notice" data-testid="refine-failed-notice">
          Enhanced analysis unavailable — showing basic results.
        </div>
      )}

      {fitSummary && (
        <div className="gap-analysis__fit-summary" data-testid="fit-summary">
          {fitSummary}
        </div>
      )}

      {/* Untriaged items needing action */}
      {(untriagedGaps.length > 0 || untriagedPartials.length > 0) && (
        <div className="gap-analysis__section">
          <div className="gap-analysis__section-header">
            <h4 className="gap-analysis__section-title gap-analysis__section-title--triage">
              Needs Your Input ({untriagedCount})
            </h4>
            {untriagedCount >= BULK_ACTION_THRESHOLD && (
              <button
                className="btn-secondary gap-analysis__bulk-btn"
                onClick={handleBulkInterview}
                data-testid="bulk-interview-btn"
              >
                Send all to interview
              </button>
            )}
          </div>

          <ul className="gap-analysis__list">
            {untriagedPartials.map((p, i) => {
              const key = `partial-${i}`
              const isExpanded = expandedReq === key
              return (
                <li key={key} className="gap-analysis__item gap-analysis__item--partial" data-testid="partial-item">
                  <div
                    className="gap-analysis__item-header"
                    onClick={() => setExpandedReq(isExpanded ? null : key)}
                  >
                    <div className="gap-analysis__item-badges">
                      <span className="gap-analysis__badge gap-analysis__badge--partial">Partial</span>
                      <span className="gap-analysis__category">{JD_CATEGORY_LABELS[p.requirement.category] ?? p.requirement.category}</span>
                      {p.requirement.importance === 'must_have' && (
                        <span className="gap-analysis__importance">Required</span>
                      )}
                      <span className="gap-analysis__chevron">{isExpanded ? '\u25BC' : '\u25B6'}</span>
                    </div>
                    <span className="gap-analysis__description">
                      {p.requirement.description}
                    </span>
                  </div>
                  {isExpanded && (
                    <div className="gap-analysis__detail">
                      <p className="gap-analysis__reasoning">{p.reasoning}</p>
                      {p.evidenceBullets.length > 0 && (
                        <BulletMatchList bullets={p.evidenceBullets} />
                      )}
                    </div>
                  )}
                  <TriageButtons
                    requirementDescription={p.requirement.description}
                    onDecision={onTriageDecision}
                    variant="partial"
                  />
                </li>
              )
            })}

            {untriagedGaps.map((g, i) => (
              <li key={`gap-${i}`} className="gap-analysis__item gap-analysis__item--gap" data-testid="gap-item">
                <div className="gap-analysis__item-header">
                  <div className="gap-analysis__item-badges">
                    <span className="gap-analysis__badge gap-analysis__badge--gap">Gap</span>
                    <span className="gap-analysis__category">{g.requirement.category}</span>
                    {g.requirement.importance === 'must_have' && (
                      <span className="gap-analysis__importance">Required</span>
                    )}
                  </div>
                  <span className="gap-analysis__description">{g.requirement.description}</span>
                </div>
                <TriageButtons
                  requirementDescription={g.requirement.description}
                  onDecision={onTriageDecision}
                  variant="gap"
                />
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Covered items */}
      {covered.length > 0 && (
        <div className="gap-analysis__section">
          <h4 className="gap-analysis__section-title gap-analysis__section-title--covered">
            Covered ({covered.length})
          </h4>
          <ul className="gap-analysis__list">
            {covered.map((c, i) => {
              const key = `covered-${i}`
              const isExpanded = expandedReq === key
              return (
                <li
                  key={key}
                  className="gap-analysis__item gap-analysis__item--covered"
                  data-testid="covered-item"
                >
                  <div
                    className="gap-analysis__item-header"
                    onClick={() => setExpandedReq(isExpanded ? null : key)}
                  >
                    <div className="gap-analysis__item-badges">
                      <span className="gap-analysis__badge gap-analysis__badge--covered">Covered</span>
                      <span className="gap-analysis__match-count">
                        {c.matchedBullets.length} match{c.matchedBullets.length !== 1 ? 'es' : ''}
                      </span>
                      <span className="gap-analysis__chevron">{isExpanded ? '\u25BC' : '\u25B6'}</span>
                    </div>
                    <span className="gap-analysis__description">{c.requirement.description}</span>
                  </div>
                  {isExpanded && (
                    <BulletMatchList bullets={c.matchedBullets} />
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* Triaged items summary */}
      {triagedItems.length > 0 && (
        <div className="gap-analysis__section">
          <h4 className="gap-analysis__section-title gap-analysis__section-title--triaged">
            Triaged ({triagedItems.length})
          </h4>
          <ul className="gap-analysis__list">
            {triagedItems.map((item, i) => {
              const key = hashRequirementDescription(item.requirement.description)
              const decision = triageDecisions[key]
              return (
                <li key={`triaged-${i}`} className="gap-analysis__item gap-analysis__item--triaged" data-testid="triaged-item">
                  <div className="gap-analysis__item-badges">
                    <span className={`gap-analysis__badge gap-analysis__badge--${decision}`}>
                      {decision === 'included' ? 'Already Covered' : decision === 'interview' ? 'Interview' : 'Ignored'}
                    </span>
                  </div>
                  <span className="gap-analysis__description">{item.requirement.description}</span>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* Actions */}
      <div className="gap-analysis__actions">
        {interviewContext && (
          <StartInterviewButton
            context={interviewContext}
            label={`Begin Interview for Gaps${untriagedCount > 0 ? ` (${untriagedCount} items need triage)` : ''}`}
            disabled={untriagedCount > 0}
            data-testid="interview-for-gaps"
          />
        )}
      </div>
    </div>
  )
}

function BulletMatchList({ bullets }: { bullets: Array<{ id: string; text: string; similarity: number }> }) {
  return (
    <ul className="gap-analysis__matches">
      {bullets.map(b => (
        <li key={b.id} className="gap-analysis__match">
          {b.text}
          {b.similarity > 0 && (
            <span className="gap-analysis__similarity">
              {Math.round(b.similarity * 100)}%
            </span>
          )}
        </li>
      ))}
    </ul>
  )
}

function TriageButtons({
  requirementDescription,
  onDecision,
  variant,
}: {
  requirementDescription: string
  onDecision: (desc: string, decision: TriageDecision) => void
  variant: 'partial' | 'gap'
}) {
  return (
    <div className="gap-analysis__triage-buttons" data-testid="triage-buttons">
      <button
        className="btn-secondary btn-sm"
        onClick={() => onDecision(requirementDescription, 'ignored')}
        data-testid="triage-ignore"
      >
        {variant === 'partial' ? 'Already Covered' : 'Not a Gap'}
      </button>
      <button
        className="btn-secondary btn-sm"
        onClick={() => onDecision(requirementDescription, 'interview')}
        data-testid="triage-interview"
      >
        Add to Interview
      </button>
    </div>
  )
}
