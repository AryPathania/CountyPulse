import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../components/auth/AuthProvider'
import { InterviewChat } from '../components/interview/InterviewChat'
import { createPositionWithBullets } from '@odie/db'
import type { ExtractedInterviewData } from '@odie/shared'
import './InterviewPage.css'

/**
 * Interview page for collecting user's career history.
 * Handles the chat UI and persists extracted data to the database.
 */
export function InterviewPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleComplete = useCallback(
    async (data: ExtractedInterviewData) => {
      if (!user?.id) {
        setError('Not authenticated')
        return
      }

      if (data.positions.length === 0) {
        // No data collected, just redirect
        navigate('/bullets')
        return
      }

      setIsSaving(true)
      setError(null)

      try {
        // Save each position with its bullets
        for (const { position, bullets } of data.positions) {
          await createPositionWithBullets(
            {
              user_id: user.id,
              company: position.company,
              title: position.title,
              location: position.location ?? null,
              start_date: position.startDate ?? null,
              end_date: position.endDate ?? null,
            },
            bullets.map((b) => ({
              original_text: b.text,
              current_text: b.text,
              category: b.category,
              hard_skills: b.hardSkills,
              soft_skills: b.softSkills,
            }))
          )
        }

        // Redirect to bullets library
        navigate('/bullets')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save interview data')
        setIsSaving(false)
      }
    },
    [user?.id, navigate]
  )

  const handleCancel = useCallback(() => {
    if (window.confirm('Are you sure you want to cancel the interview? Your progress will be lost.')) {
      navigate('/')
    }
  }, [navigate])

  return (
    <div className="interview-page" data-testid="interview-page">
      <div className="interview-page__container">
        {isSaving && (
          <div className="interview-page__saving" data-testid="interview-saving">
            <div className="saving-spinner" />
            <span>Saving your data...</span>
          </div>
        )}

        {error && (
          <div className="interview-page__error" data-testid="interview-save-error">
            {error}
          </div>
        )}

        <InterviewChat
          onComplete={handleComplete}
          onCancel={handleCancel}
        />
      </div>
    </div>
  )
}
