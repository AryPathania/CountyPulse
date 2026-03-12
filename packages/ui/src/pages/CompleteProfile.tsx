import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../components/auth/AuthProvider'
import {
  getProfile,
  upsertProfile,
  markProfileComplete,
} from '@odie/db'
import { useProfileSave } from '../hooks/useProfileSave'
import { ProfileForm } from '../components/ProfileForm'
import type { ProfileFormData } from '@odie/shared'
import { mapProfileToFormData } from '../services/profile'

export const CompleteProfile: React.FC = () => {
  const [initialData, setInitialData] = useState<ProfileFormData>({
    displayName: '',
    headline: null,
    summary: null,
    phone: null,
    location: null,
    links: [],
  })
  const [isUpdate, setIsUpdate] = useState(false)
  const [profileLoading, setProfileLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const navigate = useNavigate()
  const { user } = useAuth()
  const { save, isSaving, error: saveError } = useProfileSave(user?.id ?? '')

  useEffect(() => {
    const loadProfile = async () => {
      if (!user?.id) {
        setProfileLoading(false)
        return
      }
      try {
        const profile = await getProfile(user.id)
        if (profile) {
          setIsUpdate(true)
        }
        setInitialData(mapProfileToFormData(profile))
      } catch (err) {
        console.error('Failed to load profile:', err)
      } finally {
        setProfileLoading(false)
      }
    }

    loadProfile()
  }, [user?.id])

  const handleSave = async (data: ProfileFormData) => {
    if (!user || isCreating) return
    setSubmitError('')

    try {
      if (isUpdate) {
        // Update path: useProfileSave calls upsertProfile
        await save(data)
        await markProfileComplete(user.id)
      } else {
        // Create path: upsertProfile handles both create and mark-complete
        setIsCreating(true)
        await upsertProfile(user.id, {
          display_name: data.displayName,
          headline: data.headline,
          summary: data.summary,
          phone: data.phone ?? null,
          location: data.location ?? null,
          links: data.links.filter((l) => l.label.trim() && l.url.trim()),
        })
      }
      navigate('/')
    } catch (err) {
      console.error('Profile creation/update error:', err)
      setSubmitError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsCreating(false)
    }
  }

  if (!user) {
    return <div>Please log in to complete your profile.</div>
  }

  const error = submitError || saveError || ''

  return (
    <div className="auth-form">
      <h2>{isUpdate ? 'Update Profile' : 'Complete Your Profile'}</h2>
      {!profileLoading && (
        <ProfileForm
          initialData={initialData}
          email={user.email ?? ''}
          isSaving={isSaving || isCreating}
          onSave={handleSave}
        />
      )}
      {error && <p className="error">{error}</p>}
    </div>
  )
}
