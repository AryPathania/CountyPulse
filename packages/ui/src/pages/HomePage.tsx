import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Navigation } from '../components/layout'
import { useAuth } from '../components/auth/AuthProvider'
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

      try {
        // TODO: Call JD processing service
        // For now, navigate to a placeholder
        navigate('/resumes/draft', { state: { jdText: jdText.trim() } })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to process job description')
        setIsSubmitting(false)
      }
    },
    [jdText, user?.id, navigate]
  )

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
            placeholder="Paste your job posting here..."
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
            {isSubmitting ? 'Creating Draft...' : 'Create Resume Draft'}
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
          </div>
        </div>
      </main>
    </div>
  )
}
