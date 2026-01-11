import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Navigation } from '../components/layout'
import { useAuth } from '../components/auth/AuthProvider'
import { getJobDrafts, type JobDraft } from '@odie/db'
import './ResumesPage.css'

/**
 * Resumes page lists all job drafts/resumes for the user.
 */
export function ResumesPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [drafts, setDrafts] = useState<JobDraft[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadDrafts = async () => {
      if (!user?.id) {
        setIsLoading(false)
        return
      }

      try {
        const data = await getJobDrafts(user.id)
        setDrafts(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load resumes')
      } finally {
        setIsLoading(false)
      }
    }

    loadDrafts()
  }, [user?.id])

  return (
    <div className="resumes-page" data-testid="resumes-page">
      <Navigation />

      <main className="resumes-page__main">
        <header className="resumes-page__header">
          <h1 className="resumes-page__title">Your Resumes</h1>
          <button
            onClick={() => navigate('/')}
            className="btn-primary"
            data-testid="new-resume-btn"
          >
            New Resume
          </button>
        </header>

        {isLoading ? (
          <div className="resumes-page__loading" data-testid="resumes-loading">
            Loading...
          </div>
        ) : error ? (
          <div className="resumes-page__error" data-testid="resumes-error">
            {error}
          </div>
        ) : drafts.length === 0 ? (
          <div className="resumes-page__empty" data-testid="resumes-empty">
            <p>No resumes yet. Paste a job description to get started!</p>
            <button onClick={() => navigate('/')} className="btn-secondary">
              Create Your First Resume
            </button>
          </div>
        ) : (
          <ul className="resumes-page__list" data-testid="resumes-list">
            {drafts.map((draft) => (
              <li
                key={draft.id}
                className="resumes-page__item"
                onClick={() => navigate(`/resumes/${draft.id}`)}
                data-testid={`resume-${draft.id}`}
              >
                <div className="resume-card">
                  <h3 className="resume-card__title">
                    {draft.job_title || 'Untitled Resume'}
                  </h3>
                  {draft.company && (
                    <p className="resume-card__company">{draft.company}</p>
                  )}
                  <p className="resume-card__date">
                    {new Date(draft.created_at).toLocaleDateString()}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}
