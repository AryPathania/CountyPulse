import { supabase } from '../client'
import type { Database } from '../types'

type CandidateProfile = Database['public']['Tables']['candidate_profiles']['Row']

export interface ProfileRequirements {
  version: number
  requiredFields: (keyof CandidateProfile)[]
  customValidations?: ((profile: CandidateProfile) => boolean)[]
}

// Current profile requirements - easy to update later
export const CURRENT_PROFILE_REQUIREMENTS: ProfileRequirements = {
  version: 1,
  requiredFields: ['display_name'], // Later: ['display_name', 'phone', 'organization']
  // customValidations: [
  //   (profile) => profile.display_name.length >= 2,
  //   (profile) => profile.phone?.match(/^\+?[\d\s\-\(\)]+$/) !== null
  // ]
}

/**
 * Check if a candidate profile is complete based on current requirements
 */
export function isProfileComplete(profile: CandidateProfile | null): boolean {
  if (!profile) return false

  const requirements = CURRENT_PROFILE_REQUIREMENTS

  // Check if profile was completed for current version
  if (
    profile.profile_version &&
    profile.profile_version >= requirements.version &&
    profile.profile_completed_at
  ) {
    return true
  }

  // Check if all required fields are present and valid
  for (const field of requirements.requiredFields) {
    const value = profile[field]
    if (value === null || value === undefined || value === '') {
      return false
    }
  }

  // Run custom validations if any
  if (requirements.customValidations) {
    for (const validation of requirements.customValidations) {
      if (!validation(profile)) {
        return false
      }
    }
  }

  return true
}

/**
 * Get candidate profile with completion status
 */
export async function getUserProfileWithCompletion(userId: string): Promise<{
  profile: CandidateProfile | null
  isComplete: boolean
  needsUpdate: boolean
}> {
  const { getProfile } = await import('./candidate-profiles')
  const profile = await getProfile(userId)
  const complete = isProfileComplete(profile)
  const needsUpdate = profile
    ? !profile.profile_version ||
      profile.profile_version < CURRENT_PROFILE_REQUIREMENTS.version
    : false

  return {
    profile,
    isComplete: complete,
    needsUpdate,
  }
}

/**
 * Mark profile as completed for current version
 */
export async function markProfileComplete(userId: string): Promise<CandidateProfile> {
  const { data, error } = await supabase
    .from('candidate_profiles')
    .update({
      profile_completed_at: new Date().toISOString(),
      profile_version: CURRENT_PROFILE_REQUIREMENTS.version,
    })
    .eq('user_id', userId)
    .select()
    .single()

  if (error) throw error
  return data
}
