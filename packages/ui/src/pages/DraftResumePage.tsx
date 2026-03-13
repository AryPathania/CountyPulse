import { useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Navigation } from '../components/layout'
import { useAuth } from '../components/auth/AuthProvider'
import { useJobDraftWithBullets, useRunGapAnalysis } from '../queries/job-drafts'
import { useCreateResumeFromDraft } from '../queries/resumes'
import { bulletKeys } from '../queries/bullets'
import { buildGapDataFromStored, type GapAnalysisServiceResult } from '../services/jd-processing'
import { GapAnalysis } from '../components/draft/GapAnalysis'
import './DraftResumePage.css'

/**
 * Draft Resume page displays matched bullets for an existing job draft.
 * The draft is always created before navigation (in HomePage).
 * This page only fetches and displays an existing draft by URL param ID.
 */
export function DraftResumePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  // Load existing draft via TanStack Query
  const { data: draft, isLoading, error: loadError } = useJobDraftWithBullets(
    id && id !== 'draft' ? id : undefined
  )

  // Gap analysis mutation
  const gapAnalysis = useRunGapAnalysis()
  const createResume = useCreateResumeFromDraft()

  // Derive gap data from stored column (if available)
  const storedGapData = draft?.gap_analysis
    ? buildGapDataFromStored(draft.id, draft.gap_analysis as Parameters<typeof buildGapDataFromStored>[1])
    : null

  // Staleness detection: compare analyzedAt with bullets cache timestamp
  const bulletsState = queryClient.getQueryState(bulletKeys.lists())
  const isStale = !!(
    storedGapData?.analyzedAt &&
    bulletsState?.dataUpdatedAt &&
    bulletsState.dataUpdatedAt > new Date(storedGapData.analyzedAt).getTime()
  )

  const needsAnalysis = !!draft && (!storedGapData || isStale)
  const isAnalyzing = gapAnalysis.isPending
  const gapData: GapAnalysisServiceResult | null =
    storedGapData && !isStale
      ? storedGapData
      : gapAnalysis.data ?? null

  // Auto-trigger gap analysis when needed
  useEffect(() => {
    if (needsAnalysis && !isAnalyzing && !gapAnalysis.data && draft?.jd_text && user?.id) {
      gapAnalysis.mutate({ userId: user.id, jdText: draft.jd_text, draftId: draft.id })
    }
  }, [needsAnalysis, isAnalyzing, gapAnalysis, draft?.id, draft?.jd_text, user?.id])

  const handleCreateResume = useCallback(() => {
    if (!draft || !user?.id) return
    const bulletIds = draft.bullets.map(b => b.id)
    const name = gapData?.jobTitle || draft.job_title || 'Untitled Resume'
    createResume.mutate(
      { userId: user.id, name, bulletIds },
      { onSuccess: (resume) => navigate(`/resumes/${resume.id}/edit`) }
    )
  }, [draft, user?.id, gapData?.jobTitle, createResume, navigate])

  const error = loadError instanceof Error ? loadError.message : loadError ? String(loadError) : null

  if (isLoading) {
    return (
      <div className="draft-page" data-testid="draft-page">
        <Navigation />
        <main className="draft-page__main">
          <div className="draft-page__loading" data-testid="draft-loading">
            <div className="spinner" />
            <p>Finding your best bullets...</p>
          </div>
        </main>
      </div>
    )
  }

  if (error) {
    return (
      <div className="draft-page" data-testid="draft-page">
        <Navigation />
        <main className="draft-page__main">
          <div className="draft-page__error" data-testid="draft-error">
            <p>{error}</p>
            <button onClick={() => navigate('/')} className="btn-primary">
              Back to Home
            </button>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="draft-page" data-testid="draft-page">
      <Navigation />

      <main className="draft-page__main">
        <header className="draft-page__header">
          <div>
            <h1 className="draft-page__title">
              {gapData?.jobTitle || (draft?.job_title && !/^https?:\/\//.test(draft.job_title) ? draft.job_title : 'Resume Draft')}
            </h1>
            {(gapData?.company || draft?.company) && (
              <p className="draft-page__company">{gapData?.company || draft?.company}</p>
            )}
          </div>
          <button
            onClick={handleCreateResume}
            className="btn-primary"
            data-testid="create-resume-btn"
            disabled={createResume.isPending}
          >
            {createResume.isPending ? 'Creating...' : 'Create Resume'}
          </button>
        </header>

        <div className="draft-page__content">
          {isAnalyzing || needsAnalysis ? (
            <div className="draft-page__analyzing" data-testid="gap-loading">
              <div className="spinner" />
              <p>Analyzing requirements...</p>
            </div>
          ) : (
            <>
              <section className="draft-page__bullets">
                <h2 className="draft-page__section-title">
                  Matched Bullets ({draft?.bullets.length ?? 0})
                </h2>
                <p className="draft-page__section-desc">
                  These bullets from your library best match the job description
                </p>

                {draft?.bullets && draft.bullets.length > 0 ? (
                  <ul className="draft-page__bullet-list" data-testid="bullet-list">
                    {draft.bullets.map((bullet) => (
                      <li
                        key={bullet.id}
                        className="draft-page__bullet-item"
                        data-testid={`bullet-${bullet.id}`}
                      >
                        <div className="bullet-content">
                          <p className="bullet-text">{bullet.current_text}</p>
                          <div className="bullet-meta">
                            {bullet.category && (
                              <span className="bullet-category">{bullet.category}</span>
                            )}
                            {bullet.position && (
                              <span className="bullet-position">
                                {bullet.position.company} - {bullet.position.title}
                              </span>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="draft-page__empty" data-testid="no-bullets">
                    <p>No matching bullets found.</p>
                    <button
                      onClick={() => navigate('/interview')}
                      className="btn-secondary"
                    >
                      Start Interview to Add Bullets
                    </button>
                  </div>
                )}
              </section>

              {gapData && (
                <GapAnalysis
                  jobTitle={gapData.jobTitle}
                  company={gapData.company}
                  covered={gapData.covered}
                  gaps={gapData.gaps}
                  totalRequirements={gapData.totalRequirements}
                  coveredCount={gapData.coveredCount}
                  interviewContext={gapData.interviewContext}
                />
              )}
            </>
          )}

          {gapAnalysis.isError && (
            <div className="draft-page__error" data-testid="gap-error">
              <p>Gap analysis failed: {gapAnalysis.error instanceof Error ? gapAnalysis.error.message : 'Unknown error'}</p>
              <button
                onClick={() => {
                  if (draft?.jd_text && user?.id) {
                    gapAnalysis.mutate({ userId: user.id, jdText: draft.jd_text, draftId: draft.id })
                  }
                }}
                className="btn-secondary"
              >
                Retry Analysis
              </button>
            </div>
          )}

          {draft?.jd_text && (
            <aside className="draft-page__jd">
              <h2 className="draft-page__section-title">Job Description</h2>
              <div className="draft-page__jd-text" data-testid="jd-text">
                {draft.jd_text}
              </div>
            </aside>
          )}
        </div>
      </main>
    </div>
  )
}
