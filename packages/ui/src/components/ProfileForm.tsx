import { useState } from 'react'
import type { ProfileFormData, ProfileLink } from '@odie/shared'
import { PREDEFINED_LINK_LABELS } from '@odie/shared'
import './ProfileForm.css'

interface ProfileFormProps {
  initialData: ProfileFormData
  email: string
  isSaving?: boolean
  onSave: (data: ProfileFormData) => Promise<void>
}

const MAX_LINKS = 8

export function ProfileForm({ initialData, email, isSaving = false, onSave }: ProfileFormProps) {
  const [displayName, setDisplayName] = useState(initialData.displayName)
  const [headline, setHeadline] = useState(initialData.headline ?? '')
  const [summary, setSummary] = useState(initialData.summary ?? '')
  const [phone, setPhone] = useState(initialData.phone ?? '')
  const [location, setLocation] = useState(initialData.location ?? '')
  const [links, setLinks] = useState<ProfileLink[]>(initialData.links)

  const atMaxLinks = links.length >= MAX_LINKS

  const addPredefinedLink = (label: string) => {
    if (atMaxLinks) return
    setLinks((prev) => [...prev, { label, url: '' }])
  }

  const addCustomLink = () => {
    if (atMaxLinks) return
    setLinks((prev) => [...prev, { label: '', url: '' }])
  }

  const updateLinkLabel = (index: number, value: string) => {
    setLinks((prev) => prev.map((l, i) => (i === index ? { ...l, label: value } : l)))
  }

  const updateLinkUrl = (index: number, value: string) => {
    setLinks((prev) => prev.map((l, i) => (i === index ? { ...l, url: value } : l)))
  }

  const removeLink = (index: number) => {
    setLinks((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await onSave({
        displayName,
        headline: headline || null,
        summary: summary || null,
        phone: phone || null,
        location: location || null,
        links,
      })
    } catch {
      // Caller (onSave) is responsible for error state and display.
      // Swallow here to prevent unhandled promise rejections.
    }
  }

  return (
    <form
      className="profile-form"
      data-testid="profile-form"
      onSubmit={handleSubmit}
    >
      <div className="profile-form__group">
        <label className="profile-form__label" htmlFor="pf-display-name">
          Display Name <span aria-hidden="true">*</span>
        </label>
        <input
          id="pf-display-name"
          className="profile-form__input"
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          required
          placeholder="Your full name"
          data-testid="input-display-name"
          disabled={isSaving}
        />
      </div>

      <div className="profile-form__group">
        <label className="profile-form__label" htmlFor="pf-email">
          Email
        </label>
        <input
          id="pf-email"
          className="profile-form__input"
          type="email"
          value={email}
          readOnly
          data-testid="input-email"
        />
      </div>

      <div className="profile-form__group">
        <label className="profile-form__label" htmlFor="pf-headline">
          Headline
        </label>
        <input
          id="pf-headline"
          className="profile-form__input"
          type="text"
          value={headline}
          onChange={(e) => setHeadline(e.target.value)}
          placeholder="e.g. Senior Software Engineer"
          data-testid="input-headline"
          disabled={isSaving}
        />
      </div>

      <div className="profile-form__group">
        <label className="profile-form__label" htmlFor="pf-summary">
          Summary
        </label>
        <textarea
          id="pf-summary"
          className="profile-form__textarea"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="A brief professional summary…"
          data-testid="input-summary"
          disabled={isSaving}
        />
      </div>

      <div className="profile-form__group">
        <label className="profile-form__label" htmlFor="pf-phone">
          Phone
        </label>
        <input
          id="pf-phone"
          className="profile-form__input"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="(555) 123-4567"
          data-testid="input-phone"
          disabled={isSaving}
        />
      </div>

      <div className="profile-form__group">
        <label className="profile-form__label" htmlFor="pf-location">
          Location
        </label>
        <input
          id="pf-location"
          className="profile-form__input"
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="San Francisco, CA"
          data-testid="input-location"
          disabled={isSaving}
        />
      </div>

      <div className="profile-form__group">
        <div className="profile-form__links-header">
          <span>Links</span>
          {PREDEFINED_LINK_LABELS.map((label) => (
            <button
              key={label}
              type="button"
              className="profile-form__quick-add-btn"
              onClick={() => addPredefinedLink(label)}
              disabled={atMaxLinks || isSaving}
              data-testid={`btn-add-link-${label}`}
            >
              + {label}
            </button>
          ))}
          <button
            type="button"
            className="profile-form__quick-add-btn"
            onClick={addCustomLink}
            disabled={atMaxLinks || isSaving}
            data-testid="btn-add-link-Custom"
          >
            + Custom
          </button>
        </div>

        {links.map((link, i) => (
          <div key={i} className="profile-form__link-row">
            <input
              className="profile-form__input"
              type="text"
              value={link.label}
              onChange={(e) => updateLinkLabel(i, e.target.value)}
              placeholder="Label"
              data-testid={`input-link-label-${i}`}
              disabled={isSaving}
            />
            <input
              className="profile-form__input"
              type="url"
              value={link.url}
              onChange={(e) => updateLinkUrl(i, e.target.value)}
              placeholder="https://…"
              data-testid={`input-link-url-${i}`}
              disabled={isSaving}
            />
            <button
              type="button"
              className="profile-form__btn-remove-link"
              onClick={() => removeLink(i)}
              disabled={isSaving}
              data-testid={`btn-remove-link-${i}`}
              aria-label={`Remove link ${i + 1}`}
            >
              &times;
            </button>
          </div>
        ))}
      </div>

      <div className="profile-form__actions">
        <button
          type="submit"
          className="btn-primary"
          disabled={isSaving || !displayName.trim()}
          data-testid="btn-save-profile"
        >
          {isSaving ? 'Saving\u2026' : 'Save'}
        </button>
      </div>
    </form>
  )
}
