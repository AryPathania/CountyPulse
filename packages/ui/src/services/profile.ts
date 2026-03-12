import type { CandidateProfile } from '@odie/db'
import type { ProfileFormData, ProfileLink } from '@odie/shared'

/**
 * Maps a DB candidate_profiles row (or null) to the ProfileFormData shape
 * consumed by ProfileForm. Centralised here to avoid duplication across
 * CompleteProfile and SettingsPage.
 */
export function mapProfileToFormData(profile: CandidateProfile | null): ProfileFormData {
  return {
    displayName: profile?.display_name ?? '',
    headline: profile?.headline ?? null,
    summary: profile?.summary ?? null,
    phone: profile?.phone ?? null,
    location: profile?.location ?? null,
    links: (profile?.links as ProfileLink[] | null) ?? [],
  }
}
