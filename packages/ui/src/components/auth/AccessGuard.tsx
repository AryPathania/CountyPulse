import { Navigate } from 'react-router-dom'
import { useAccess } from '../../hooks/useAccess'

interface AccessGuardProps {
  children: React.ReactNode
}

/**
 * UX-only access gate. Redirects non-beta users to /no-access.
 * The real security boundary is the backend middleware in withMiddleware.
 * Must be rendered inside AuthGuard (requires authenticated user).
 */
export const AccessGuard: React.FC<AccessGuardProps> = ({ children }) => {
  const { hasAccess, isLoading } = useAccess()

  if (isLoading) {
    return <div>Loading...</div>
  }

  if (!hasAccess) {
    return <Navigate to="/no-access" replace />
  }

  return <>{children}</>
}
