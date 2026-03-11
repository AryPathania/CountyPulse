import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../components/auth/AuthProvider'
import {
  createUserProfile,
  updateUserProfile,
  markProfileComplete,
  getUserProfile,
  getCandidateProfile,
  upsertCandidateProfile,
  type UserProfile,
} from '@odie/db'

export const CompleteProfile: React.FC = () => {
  const [displayName, setDisplayName] = useState('')
  const [phone, setPhone] = useState('')
  const [location, setLocation] = useState('')
  const [linkedinUrl, setLinkedinUrl] = useState('')
  const [githubUrl, setGithubUrl] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isUpdate, setIsUpdate] = useState(false)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const navigate = useNavigate()
  const { user } = useAuth()

  useEffect(() => {
    // Load user profile and candidate profile when component mounts
    const loadProfile = async () => {
      if (user?.id) {
        try {
          const [profile, candidateProfile] = await Promise.all([
            getUserProfile(user.id),
            getCandidateProfile(user.id),
          ])
          setUserProfile(profile)
          if (profile) {
            setDisplayName(profile.display_name || '')
            setIsUpdate(true)
          }
          if (candidateProfile) {
            setPhone(candidateProfile.phone || '')
            setLocation(candidateProfile.location || '')
            setLinkedinUrl(candidateProfile.linkedin_url || '')
            setGithubUrl(candidateProfile.github_url || '')
            setWebsiteUrl(candidateProfile.website_url || '')
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

      // Upsert candidate profile with contact fields
      const hasContactFields = phone || location || linkedinUrl || githubUrl || websiteUrl
      if (hasContactFields) {
        await upsertCandidateProfile(user.id, {
          phone: phone || null,
          location: location || null,
          linkedin_url: linkedinUrl || null,
          github_url: githubUrl || null,
          website_url: websiteUrl || null,
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
            data-testid="input-display-name"
          />
        </div>

        <div className="form-group">
          <label htmlFor="phone">Phone (optional)</label>
          <input
            id="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={loading}
            placeholder="(555) 123-4567"
            data-testid="input-phone"
          />
        </div>

        <div className="form-group">
          <label htmlFor="location">Location (optional)</label>
          <input
            id="location"
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            disabled={loading}
            placeholder="San Francisco, CA"
            data-testid="input-location"
          />
        </div>

        <div className="form-group">
          <label htmlFor="linkedinUrl">LinkedIn URL (optional)</label>
          <input
            id="linkedinUrl"
            type="url"
            value={linkedinUrl}
            onChange={(e) => setLinkedinUrl(e.target.value)}
            disabled={loading}
            placeholder="https://linkedin.com/in/yourname"
            data-testid="input-linkedin"
          />
        </div>

        <div className="form-group">
          <label htmlFor="githubUrl">GitHub URL (optional)</label>
          <input
            id="githubUrl"
            type="url"
            value={githubUrl}
            onChange={(e) => setGithubUrl(e.target.value)}
            disabled={loading}
            placeholder="https://github.com/yourname"
            data-testid="input-github"
          />
        </div>

        <div className="form-group">
          <label htmlFor="websiteUrl">Website URL (optional)</label>
          <input
            id="websiteUrl"
            type="url"
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            disabled={loading}
            placeholder="https://yoursite.com"
            data-testid="input-website"
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