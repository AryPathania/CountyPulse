import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../components/auth/AuthProvider'
import { getUserProfileWithCompletion } from '@county-pulse/db'

export const AuthCallback: React.FC = () => {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        if (!authLoading) {
          if (!user) {
            throw new Error('Authentication failed')
          }

          const { isComplete, needsUpdate } = await getUserProfileWithCompletion(user.id)

          if (!isComplete || needsUpdate) {
            navigate('/auth/complete-profile')
          } else {
            navigate('/')
          }
          setLoading(false)
        }
      } catch (err) {
        console.error('Auth callback error:', err)
        setError(err instanceof Error ? err.message : 'Authentication failed')
        setLoading(false)
      }
    }

    handleAuthCallback()
  }, [navigate, user, authLoading])

  if (loading || authLoading) return <div>Verifying your email...</div>
  if (error) return <div>Authentication error: {error}</div>
  
  return <div>Redirecting...</div>
} 