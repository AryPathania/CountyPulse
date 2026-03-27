import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../components/auth/AuthProvider'
import { useAccess } from '../hooks/useAccess'
import { SignOutButton } from '../components/auth/SignOutButton'
import './NoAccessPage.css'

export function NoAccessPage() {
  const { user } = useAuth()
  const { hasAccess, isFetching } = useAccess()
  const navigate = useNavigate()

  useEffect(() => {
    if (hasAccess) {
      void navigate('/', { replace: true })
    }
  }, [hasAccess, navigate])

  if (isFetching) {
    return (
      <div className="no-access-page" data-testid="no-access-page">
        <div className="no-access-page__content">
          <p className="no-access-page__message">Checking access...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="no-access-page" data-testid="no-access-page">
      <div className="no-access-page__content">
        <h1 className="no-access-page__title">Access Limited</h1>
        <p className="no-access-page__message">
          Odie AI is currently available to beta testers only.
        </p>
        {user?.email && (
          <p className="no-access-page__email">
            Signed in as <strong>{user.email}</strong>
          </p>
        )}
        <SignOutButton className="no-access-page__signout" />
      </div>
    </div>
  )
}
