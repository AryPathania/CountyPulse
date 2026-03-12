/**
 * Profile link contract — flexible link entry for candidate profiles.
 */
export interface ProfileLink {
  label: string  // e.g. "LinkedIn", "GitHub", "Twitter", "Website", or any custom label
  url: string
}

/**
 * Predefined link type labels — used by UI for quick-add buttons.
 * Users may still edit the label after selection.
 */
export const PREDEFINED_LINK_LABELS = ['LinkedIn', 'GitHub', 'Twitter', 'Website'] as const
export type PredefinedLinkLabel = typeof PREDEFINED_LINK_LABELS[number]

/**
 * Form data shape shared between ProfileForm, useProfileSave, Settings, CompleteProfile,
 * and PersonalInfoPanel.
 */
export interface ProfileFormData {
  displayName: string
  headline: string | null
  summary: string | null
  phone: string | null
  location: string | null
  links: ProfileLink[]  // max 8, enforced in app layer
}
