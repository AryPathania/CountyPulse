import { useEffect, useState, useCallback } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { Navigation } from '../components/layout'
import { useAuth } from '../components/auth/AuthProvider'
import { getJobDraftWithBullets, type JobDraftWithBullets } from '@odie/db'
import { processJobDescription } from '../services/jd-processing'
import './DraftResumePage.css'

/**
 * Draft Resume page displays matched bullets for a job description.
 * Handles two modes:
 * 1. Creating new draft from JD text (via navigation state)
 * 2. Viewing existing draft (via URL param)
 */
export function DraftResumePage() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [draft, setDraft] = useState<JobDraftWithBullets | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Get JD text from navigation state (for new drafts)
  const jdTextFromState = (location.state as { jdText?: string } | null)?.jdText

  // Load or create draft
  useEffect(() => {
    const loadOrCreateDraft = async () => {
      if (!user?.id) {
        setError('Not authenticated')
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      setError(null)

      try {
        if (id && id !== 'draft') {
          // Load existing draft
          const existingDraft = await getJobDraftWithBullets(id)
          if (!existingDraft) {
            setError('Draft not found')
          } else {
            setDraft(existingDraft)
          }
        } else if (jdTextFromState) {
          // Create new draft from JD text
          const result = await processJobDescription(user.id, jdTextFromState)
          // Navigate to the created draft
          navigate(`/resumes/${result.draftId}`, { replace: true })
        } else {
          setError('No job description provided')
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load draft')
      } finally {
        setIsLoading(false)
      }
    }

    loadOrCreateDraft()
  }, [id, jdTextFromState, user?.id, navigate])

  const handleCreateResume = useCallback(() => {
    if (draft?.id) {
      // TODO: Navigate to resume builder
      navigate(`/resumes/${draft.id}/edit`)
    }
  }, [draft?.id, navigate])

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
              {draft?.job_title || 'Resume Draft'}
            </h1>
            {draft?.company && (
              <p className="draft-page__company">{draft.company}</p>
            )}
          </div>
          <button
            onClick={handleCreateResume}
            className="btn-primary"
            data-testid="create-resume-btn"
          >
            Create Resume
          </button>
        </header>

        <div className="draft-page__content">
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
