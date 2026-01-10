import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../components/auth/AuthProvider'
import { createUserProfile, updateUserProfile, markProfileComplete, getUserProfile, type UserProfile } from '@county-pulse/db'

export const CompleteProfile: React.FC = () => {
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isUpdate, setIsUpdate] = useState(false)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const navigate = useNavigate()
  const { user } = useAuth()

  useEffect(() => {
    // Load user profile when component mounts
    const loadProfile = async () => {
      if (user?.id) {
        try {
          const profile = await getUserProfile(user.id)
          setUserProfile(profile)
          if (profile) {
            setDisplayName(profile.display_name || '')
            setIsUpdate(true)
          }
        } catch (error) {
          console.error('Failed to load profile:', error)
          // Profile doesn't exist yet, that's fine for new users
        }
      }
    }
    
    loadProfile()
  }, [user?.id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!user || isSubmitting) {
      return
    }

    setIsSubmitting(true)
    setLoading(true)
    setError('')

    try {
      if (isUpdate && userProfile) {
        // Update existing profile
        await updateUserProfile(user.id, {
          display_name: displayName,
        })
        // Mark as complete for current version
        await markProfileComplete(user.id)
      } else {
        // Create new profile (automatically marked as complete)
        await createUserProfile({
          user_id: user.id,
          display_name: displayName,
        })
      }

      // Redirect to dashboard
      navigate('/')
    } catch (err) {
      console.error('Profile creation/update error:', err)
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
      setIsSubmitting(false)
    }
  }

  if (!user) {
    return <div>Please log in to complete your profile.</div>
  }

  return (
    <div className="auth-form">
      <h2>{isUpdate ? 'Update Profile' : 'Complete Your Profile'}</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="displayName">Display Name</label>
          <input
            id="displayName"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            disabled={loading}
            placeholder="Enter your display name"
          />
        </div>
        
        {error && <p className="error">{error}</p>}
        
        <button type="submit" disabled={loading || !displayName.trim()}>
          {loading ? 'Saving...' : 'Continue'}
        </button>
      </form>
    </div>
  )
} 