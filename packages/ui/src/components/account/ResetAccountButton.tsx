import { useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { useResetAccountData } from '../../queries/account'
import './ResetAccountButton.css'

/**
 * Button component with type-to-confirm safety for resetting all account data.
 * Clears resumes, bullets, positions, interviews, and telemetry while preserving auth.
 */
export function ResetAccountButton() {
  const { user } = useAuth()
  const resetMutation = useResetAccountData()
  const [isExpanded, setIsExpanded] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [error, setError] = useState<string | null>(null)

  const isConfirmEnabled = confirmText === 'RESET'

  const handleReset = async () => {
    if (!user?.id || !isConfirmEnabled) return

    setError(null)
    try {
      await resetMutation.mutateAsync(user.id)
      setIsExpanded(false)
      setConfirmText('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset account data')
    }
  }

  const handleCancel = () => {
    setIsExpanded(false)
    setConfirmText('')
    setError(null)
  }

  if (!isExpanded) {
    return (
      <button
        type="button"
        className="reset-account-button"
        onClick={() => setIsExpanded(true)}
        data-testid="reset-account-button"
      >
        Reset Account Data
      </button>
    )
  }

  return (
    <div className="reset-account-panel" data-testid="reset-account-panel">
      <div className="reset-account-panel__warning">
        <h4 className="reset-account-panel__title">Are you sure?</h4>
        <p className="reset-account-panel__text">
          This will permanently delete all your data including:
        </p>
        <ul className="reset-account-panel__list">
          <li>All resumes</li>
          <li>All bullets</li>
          <li>All positions</li>
          <li>All interview history</li>
          <li>All telemetry data</li>
        </ul>
        <p className="reset-account-panel__text">
          Your account will remain active, but all data will be lost.
        </p>
      </div>

      <div className="reset-account-panel__confirm">
        <label htmlFor="confirm-reset" className="reset-account-panel__label">
          Type <strong>RESET</strong> to confirm:
        </label>
        <input
          id="confirm-reset"
          type="text"
          className="reset-account-panel__input"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder="Type RESET"
          data-testid="reset-confirm-input"
          autoComplete="off"
        />
      </div>

      {error && (
        <p className="reset-account-panel__error" data-testid="reset-error">
          {error}
        </p>
      )}

      <div className="reset-account-panel__actions">
        <button
          type="button"
          className="reset-account-panel__cancel"
          onClick={handleCancel}
          data-testid="reset-cancel-button"
        >
          Cancel
        </button>
        <button
          type="button"
          className="reset-account-panel__submit"
          onClick={handleReset}
          disabled={!isConfirmEnabled || resetMutation.isPending}
          data-testid="reset-confirm-button"
        >
          {resetMutation.isPending ? 'Resetting...' : 'Confirm Reset'}
        </button>
      </div>
    </div>
  )
}
