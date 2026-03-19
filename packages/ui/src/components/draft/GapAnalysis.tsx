import { useState } from 'react'
import type { InterviewContext, CoveredRequirement, GapRequirement } from '@odie/shared'
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
  gaps: GapRequirement[]
  totalRequirements: number
  coveredCount: number
  interviewContext: InterviewContext | null
}

export function GapAnalysis({
  jobTitle,
  company,
  covered,
  gaps,
  totalRequirements,
  coveredCount,
  interviewContext,
}: GapAnalysisProps) {
  const [expandedReq, setExpandedReq] = useState<number | null>(null)

  return (
    <div className="gap-analysis" data-testid="gap-analysis">
      <div className="gap-analysis__header">
        <h3 className="gap-analysis__title">
          Requirements Analysis: {jobTitle}{company ? ` at ${company}` : ''}
        </h3>
        <p className="gap-analysis__summary" data-testid="gap-summary">
          {coveredCount}/{totalRequirements} requirements covered
          {gaps.length > 0 && `, ${gaps.length} gaps`}
        </p>
      </div>

      {gaps.length > 0 && (
        <div className="gap-analysis__section">
          <h4 className="gap-analysis__section-title gap-analysis__section-title--gap">
            Gaps ({gaps.length})
          </h4>
          <ul className="gap-analysis__list">
            {gaps.map((g, i) => (
              <li key={`gap-${i}`} className="gap-analysis__item gap-analysis__item--gap" data-testid="gap-item">
                <span className={`gap-analysis__badge gap-analysis__badge--${g.skillMatch ? 'partial' : 'gap'}`}>
                  {g.skillMatch ? 'Partial' : 'Gap'}
                </span>
                <span className="gap-analysis__description">{g.requirement.description}</span>
                <span className="gap-analysis__category">{g.requirement.category}</span>
                {g.skillMatch && (
                  <span className="gap-analysis__skill-match" data-testid="skill-match">
                    Skill match: {g.skillMatch}
                  </span>
                )}
                {g.requirement.importance === 'must_have' && (
                  <span className="gap-analysis__importance">Required</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {covered.length > 0 && (
        <div className="gap-analysis__section">
          <h4 className="gap-analysis__section-title gap-analysis__section-title--covered">
            Covered ({covered.length})
          </h4>
          <ul className="gap-analysis__list">
            {covered.map((c, i) => (
              <li
                key={`covered-${i}`}
                className="gap-analysis__item gap-analysis__item--covered"
                onClick={() => setExpandedReq(expandedReq === i ? null : i)}
                data-testid="covered-item"
              >
                <span className="gap-analysis__badge gap-analysis__badge--covered">Covered</span>
                <span className="gap-analysis__description">{c.requirement.description}</span>
                <span className="gap-analysis__match-count">
                  {c.matchedBullets.length} match{c.matchedBullets.length !== 1 ? 'es' : ''}
                </span>
                {expandedReq === i && (
                  <ul className="gap-analysis__matches">
                    {c.matchedBullets.map((b) => (
                      <li key={b.id} className="gap-analysis__match">
                        {b.text}
                        <span className="gap-analysis__similarity">
                          {Math.round(b.similarity * 100)}%
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {interviewContext && gaps.length > 0 && (
        <div className="gap-analysis__actions">
          <StartInterviewButton
            context={interviewContext}
            label="Interview for Gaps"
            data-testid="interview-for-gaps"
          />
        </div>
      )}
    </div>
  )
}
