import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Navigation } from '../components/layout'
import { useAuth } from '../components/auth/AuthProvider'
import { isUrl, fetchJdText } from '../services/fetchJd'
import { processJobDescription } from '../services/jd-processing'
import './HomePage.css'

/**
 * Home page with minimalist JD paste interface.
 * Similar to ChatGPT's clean input-centered design.
 */
export function HomePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [jdText, setJdText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!jdText.trim() || !user?.id) return

      setIsSubmitting(true)
      setError(null)

      let finalText = jdText.trim()

      if (isUrl(finalText)) {
        try {
          finalText = await fetchJdText(finalText)
        } catch (err) {
          setError(
            err instanceof Error
              ? err.message
              : "Couldn't fetch this URL. Please paste the job description text directly."
          )
          setIsSubmitting(false)
          return
        }
      }

      try {
        const { draftId } = await processJobDescription(user.id, finalText)
        navigate(`/resumes/${draftId}`)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create draft')
        setIsSubmitting(false)
      }
    },
    [jdText, user?.id, navigate]
  )

  const submitLabel = (() => {
    if (!isSubmitting) return 'Create Resume Draft'
    if (isUrl(jdText)) return 'Fetching job description...'
    return 'Creating Draft...'
  })()

  return (
    <div className="home-page" data-testid="home-page">
      <Navigation />

      <main className="home-page__main">
        <div className="home-page__hero">
          <h1 className="home-page__title">Craft your perfect resume</h1>
          <p className="home-page__subtitle">
            Paste a job description and let Odie match your best achievements
          </p>
        </div>

        <form onSubmit={handleSubmit} className="home-page__form">
          <textarea
            value={jdText}
            onChange={(e) => setJdText(e.target.value)}
            placeholder="Paste your job posting here or enter a job URL..."
            className="home-page__input"
            rows={8}
            disabled={isSubmitting}
            data-testid="jd-input"
          />

          {error && (
            <div className="home-page__error" data-testid="jd-error">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!jdText.trim() || isSubmitting}
            className="home-page__submit"
            data-testid="jd-submit"
          >
            {submitLabel}
          </button>
        </form>

        <div className="home-page__quick-actions">
          <p className="home-page__or">or</p>
          <div className="home-page__links">
            <button
              type="button"
              onClick={() => navigate('/interview')}
              className="home-page__link"
              data-testid="start-interview"
            >
              Start Interview
            </button>
            <button
              type="button"
              onClick={() => navigate('/bullets')}
              className="home-page__link"
              data-testid="view-bullets"
            >
              View Bullets Library
            </button>
            <button
              type="button"
              onClick={() => navigate('/upload-resume')}
              className="home-page__link"
              data-testid="upload-resume"
            >
              Upload Resume
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
