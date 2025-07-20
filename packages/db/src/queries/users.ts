import { supabase } from '../client'
import type { Database } from '../types'

type UserProfile = Database['public']['Tables']['user_profiles']['Row']
type NewUserProfile = Database['public']['Tables']['user_profiles']['Insert']
type UpdateUserProfile = Database['public']['Tables']['user_profiles']['Update']

/**
 * Check if a user profile exists for the given user ID
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows returned
      return null
    }
    throw error
  }

  return data
}

/**
 * Create a new user profile with completion tracking
 */
export async function createUserProfile(profile: NewUserProfile): Promise<UserProfile> {
  const { CURRENT_PROFILE_REQUIREMENTS } = await import('./profile-completion')
  
  const profileData = {
    ...profile,
    profile_completed_at: new Date().toISOString(),
    profile_version: CURRENT_PROFILE_REQUIREMENTS.version
  }

  const { data, error } = await supabase
    .from('user_profiles')
    .insert(profileData)
    .select()
    .single()

  if (error) {
    throw error
  }

  return data
}

/**
 * Update an existing user profile
 */
export async function updateUserProfile(
  userId: string,
  updates: UpdateUserProfile
): Promise<UserProfile> {
  const { data, error } = await supabase
    .from('user_profiles')
    .update(updates)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) {
    throw error
  }

  return data
}

/**
 * Check if a user profile exists by email
 * Note: This checks for existing user profiles, not auth.users directly
 */
export async function checkUserProfileExists(email: string): Promise<{ exists: boolean; profile?: UserProfile }> {
  // First, try to get the user by email from auth (this requires admin privileges)
  // Since we can't access auth.users directly, we'll handle this in the auth flow
  // For now, we'll return a simple response
  return { exists: false }
} 