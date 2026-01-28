import { Navigation } from '../components/layout'
import { ResetAccountButton } from '../components/account'
import './SettingsPage.css'

/**
 * Settings page with account management options.
 * Contains a "Danger Zone" section for destructive account operations.
 */
export function SettingsPage() {
  return (
    <div className="settings-page" data-testid="settings-page">
      <Navigation />

      <header className="settings-page__header">
        <h1 className="settings-page__title">Settings</h1>
        <p className="settings-page__subtitle">
          Manage your account and preferences
        </p>
      </header>

      <div className="settings-page__content">
        <section className="settings-page__section settings-page__section--danger" data-testid="danger-zone">
          <h2 className="settings-page__section-title">Danger Zone</h2>
          <p className="settings-page__section-description">
            Irreversible actions that affect your account data
          </p>
          <div className="settings-page__section-content">
            <div className="settings-page__item">
              <div className="settings-page__item-info">
                <h3 className="settings-page__item-title">Reset Account Data</h3>
                <p className="settings-page__item-description">
                  Delete all your resumes, bullets, positions, and interview history.
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
