import { useQuery } from '@tanstack/react-query'
import { getProfile, mapProfileToFormData } from '@odie/db'
import { Navigation } from '../components/layout'
import { ResetAccountButton } from '../components/account'
import { ProfileForm } from '../components/ProfileForm'
import { ProfileEntriesEditor } from '../components/ProfileEntriesEditor'
import { useAuth } from '../components/auth/AuthProvider'
import { useProfileSave } from '../hooks/useProfileSave'
import './SettingsPage.css'

/**
 * Settings page with profile editing and account management options.
 * Contains a "Profile" section with ProfileForm and a "Danger Zone" section.
 */
export function SettingsPage() {
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
    <div className="settings-page" data-testid="settings-page">
      <Navigation />

      <header className="settings-page__header">
        <h1 className="settings-page__title">Profile &amp; Settings</h1>
        <p className="settings-page__subtitle">
          Manage your profile and account preferences
        </p>
      </header>

      <div className="settings-page__content">
        <section
          className="settings-page__section"
          data-testid="settings-profile-section"
        >
          <h2 className="settings-page__section-title">Profile</h2>
          {isLoading ? (
            <div className="settings-page__loading" data-testid="settings-loading">
              Loading profile…
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
          className="settings-page__section"
          data-testid="settings-entries-section"
        >
          <ProfileEntriesEditor userId={userId} />
        </section>

        <section
          className="settings-page__section settings-page__section--danger"
          data-testid="danger-zone"
        >
          <h2 className="settings-page__section-title">Danger Zone</h2>
          <p className="settings-page__section-description">
            Irreversible actions that affect your account data
          </p>
          <div className="settings-page__section-content">
            <div className="settings-page__item">
              <div className="settings-page__item-info">
                <h3 className="settings-page__item-title">Reset Account Data</h3>
                <p className="settings-page__item-description">
                  Delete all your resumes, bullets, positions, profile entries, and interview history.
                  Your account will remain active.
                </p>
              </div>
              <div className="settings-page__item-action">
                <ResetAccountButton />
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
