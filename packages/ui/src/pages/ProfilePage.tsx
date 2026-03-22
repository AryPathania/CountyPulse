import { useQuery } from '@tanstack/react-query'
import { getProfile, mapProfileToFormData } from '@odie/db'
import { Navigation } from '../components/layout'
import { ProfileForm } from '../components/ProfileForm'
import { ProfileEntriesEditor } from '../components/ProfileEntriesEditor'
import { useAuth } from '../components/auth/AuthProvider'
import { useProfileSave } from '../hooks/useProfileSave'
import './ProfilePage.css'

/**
 * Profile page for managing personal information and profile entries.
 * Reuses ProfileForm and ProfileEntriesEditor (extracted from SettingsPage).
 */
export function ProfilePage() {
  const { user } = useAuth()
  const userId = user?.id ?? ''

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile', userId],
    queryFn: () => getProfile(userId),
    enabled: !!userId,
  })

  const { save, isSaving } = useProfileSave(userId)

  const initialData = mapProfileToFormData(profile ?? null)

  return (
    <div className="profile-page" data-testid="profile-page">
      <Navigation />

      <header className="profile-page__header">
        <h1 className="profile-page__title">Profile</h1>
        <p className="profile-page__subtitle">
          Manage your profile information and entries
        </p>
      </header>

      <div className="profile-page__content">
        <section
          className="profile-page__section"
          data-testid="profile-form-section"
        >
          <h2 className="profile-page__section-title">Personal Information</h2>
          {isLoading ? (
            <div className="profile-page__loading" data-testid="profile-loading">
              Loading profile...
            </div>
          ) : (
            <ProfileForm
              key={profile?.updated_at ?? 'empty'}
              initialData={initialData}
              email={user?.email ?? ''}
              isSaving={isSaving}
              onSave={save}
            />
          )}
        </section>

        <section
          className="profile-page__section"
          data-testid="profile-entries-section"
        >
          <ProfileEntriesEditor userId={userId} />
        </section>
      </div>
    </div>
  )
}
