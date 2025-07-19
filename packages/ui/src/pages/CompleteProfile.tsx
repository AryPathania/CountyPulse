import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../components/auth/AuthProvider'
import { createUserProfile, updateUserProfile, markProfileComplete, getUserProfileWithCompletion } from '@county-pulse/db'

export const CompleteProfile: React.FC = () => {
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isUpdate, setIsUpdate] = useState(false)
  const navigate = useNavigate()
  const { user, userProfile, refreshProfile } = useAuth()

  useEffect(() => {
    // Pre-populate form if updating existing profile
    if (userProfile) {
      setDisplayName(userProfile.display_name || '')
      setIsUpdate(true)
    }
  }, [userProfile])

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

      // Refresh the profile in the auth context
      await refreshProfile()

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

  return (
    <div className="auth-form">
      <h2>{isUpdate ? 'Update Your Profile' : 'Complete Your Profile'}</h2>
      <p>{isUpdate ? 'Please update your information:' : 'Welcome to County Pulse! What should we call you?'}</p>
      
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="displayName">Display Name</label>
          <input
            id="displayName"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            disabled={loading}
            placeholder="Your name"
            autoFocus
          />
        </div>
        
        <button type="submit" disabled={loading || !displayName || isSubmitting}>
          {loading ? (isUpdate ? 'Updating...' : 'Creating Profile...') : 'Continue'}
        </button>
      </form>
      
      {error && <p className="error">{error}</p>}
    </div>
  )
} 