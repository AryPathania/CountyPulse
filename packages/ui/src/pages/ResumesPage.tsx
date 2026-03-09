import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Navigation } from '../components/layout'
import { useAuth } from '../components/auth/AuthProvider'
import { getJobDrafts, type JobDraft, getUploadedResumes, type UploadedResume } from '@odie/db'
import './ResumesPage.css'

/**
 * Resumes page lists all job drafts/resumes for the user.
 */
export function ResumesPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [drafts, setDrafts] = useState<JobDraft[]>([])
  const [uploadedResumes, setUploadedResumes] = useState<UploadedResume[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadDrafts = async () => {
      if (!user?.id) {
        setIsLoading(false)
        return
      }

      try {
        const [data, uploads] = await Promise.all([
          getJobDrafts(user.id),
          getUploadedResumes(user.id),
        ])
        setDrafts(data)
        setUploadedResumes(uploads)
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
        ) : drafts.length === 0 && uploadedResumes.length === 0 ? (
          <div className="resumes-page__empty" data-testid="resumes-empty">
            <p>No resumes yet. Paste a job description to get started!</p>
            <button onClick={() => navigate('/')} className="btn-secondary">
              Create Your First Resume
            </button>
          </div>
        ) : (
          <>
            {uploadedResumes.length > 0 && (
              <section className="resumes-page__section" data-testid="uploaded-resumes-section">
                <h2 className="resumes-page__section-title">Uploaded Resumes</h2>
                <div className="resumes-page__list">
                  {uploadedResumes.map((resume) => (
                    <div key={resume.id} className="resumes-page__card" data-testid="uploaded-resume-card">
                      <div className="resumes-page__card-header">
                        <span className="resumes-page__card-name">{resume.file_name}</span>
                        <span className="resumes-page__card-date">
                          {new Date(resume.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      {resume.parsed_data && (
                        <button
                          onClick={() => navigate('/interview', {
                            state: { interviewContext: { mode: 'resume', ...resume.parsed_data } }
                          })}
                          className="btn-secondary resumes-page__card-action"
                        >
                          Start Interview
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {drafts.length > 0 && (
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
          </>
        )}
      </main>
    </div>
  )
}
