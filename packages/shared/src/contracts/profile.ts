import { z } from 'zod'

/**
 * Profile entry categories for non-position resume sections.
 */
export const ProfileEntryCategorySchema = z.enum([
  'education',
  'certification',
  'award',
  'project',
  'volunteer',
])

export type ProfileEntryCategory = z.infer<typeof ProfileEntryCategorySchema>

export const CATEGORY_LABELS: Record<ProfileEntryCategory, string> = {
  education: 'Education',
  certification: 'Certifications',
  award: 'Awards',
  project: 'Projects',
  volunteer: 'Volunteer',
}

export const ProfileEntrySchema = z.object({
  category: ProfileEntryCategorySchema,
  title: z.string().min(1).max(200),
  subtitle: z.string().max(200).nullish(),
  startDate: z.string().nullish(),
  endDate: z.string().nullish(),
  location: z.string().max(200).nullish(),
  textItems: z.array(z.string()).optional(),
})

export type ProfileEntryData = z.infer<typeof ProfileEntrySchema>

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
