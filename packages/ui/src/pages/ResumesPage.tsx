import { useNavigate } from 'react-router-dom'
import { Navigation } from '../components/layout'
import { useAuth } from '../components/auth/AuthProvider'
import { useJobDrafts, useDeleteJobDraft } from '../queries/job-drafts'
import { useUploadedResumes } from '../queries/uploaded-resumes'
import { ResumeContextSchema } from '@odie/shared'
import './ResumesPage.css'

function isUrl(text: string): boolean {
  return /^https?:\/\//.test(text)
}

function getDraftTitle(draft: { job_title: string | null; jd_text: string | null; gap_analysis: unknown }): string {
  // Prefer extracted job title from gap analysis over raw URL in job_title
  const gapTitle = (draft.gap_analysis as { jobTitle?: string } | null)?.jobTitle
  if (gapTitle) return gapTitle

  if (draft.job_title && !isUrl(draft.job_title)) return draft.job_title

  if (draft.jd_text) return draft.jd_text.slice(0, 60) + '...'

  return 'Untitled Draft'
}

/**
 * Resumes page lists all job drafts/resumes for the user.
 */
export function ResumesPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const deleteDraft = useDeleteJobDraft()

  const { data: drafts = [], isLoading: draftsLoading, error: draftsError } = useJobDrafts(user?.id)
  const { data: uploadedResumes = [], isLoading: uploadsLoading, error: uploadsError } = useUploadedResumes(user?.id)

  const isLoading = draftsLoading || uploadsLoading
  const error = draftsError || uploadsError

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
            {error instanceof Error ? error.message : String(error)}
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
                      {resume.parsed_data && (() => {
                        const parsed = ResumeContextSchema.safeParse({
                          mode: 'resume',
                          ...resume.parsed_data,
                        })
                        if (!parsed.success) return null
                        return (
                          <button
                            onClick={() => navigate('/interview', {
                              state: { interviewContext: parsed.data }
                            })}
                            className="btn-secondary resumes-page__card-action"
                          >
                            Start Interview
                          </button>
                        )
                      })()}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {drafts.length > 0 && (
              <section className="resumes-page__section" data-testid="drafts-section">
                <h2 className="resumes-page__section-title">Drafts</h2>
                <ul className="resumes-page__list" data-testid="resumes-list">
                  {drafts.map((draft) => (
                    <li
                      key={draft.id}
                      className="resumes-page__item"
                      onClick={() => navigate(`/resumes/${draft.id}`)}
                      data-testid={`resume-${draft.id}`}
                    >
                      <div className="resume-card">
                        <div className="resume-card__header">
                          <span className="resume-card__badge" data-testid="draft-badge">Draft</span>
                          <button
                            className="resume-card__delete"
                            data-testid={`delete-draft-${draft.id}`}
                            onClick={(e) => {
                              e.stopPropagation()
                              if (window.confirm('Delete this draft?')) {
                                deleteDraft.mutate(draft.id)
                              }
                            }}
                            aria-label="Delete draft"
                          >
                            &times;
                          </button>
                        </div>
                        <h3 className="resume-card__title">
                          {getDraftTitle(draft)}
                        </h3>
                        {draft.company && (
                          <p className="resume-card__company">{draft.company}</p>
                        )}
                        <p className="resume-card__date">
                          {new Date(draft.created_at).toLocaleString()}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  )
}
