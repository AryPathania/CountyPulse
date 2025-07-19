import { useAuth } from './AuthProvider'

interface AuthGuardProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ children, fallback }) => {
  const { user, loading } = useAuth()

  if (loading) {
    return <div>Loading...</div>
  }

  if (!user) {
    return fallback ? <>{fallback}</> : <div>Please log in to access this content.</div>
  }

  return <>{children}</>
} 