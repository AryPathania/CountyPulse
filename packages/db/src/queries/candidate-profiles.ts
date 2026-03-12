import { supabase } from '../client'
import type { Database, Json } from '../types'
import type { ProfileLink } from '@odie/shared'
import { CURRENT_PROFILE_REQUIREMENTS } from './profile-completion'

type CandidateProfile = Database['public']['Tables']['candidate_profiles']['Row']

export type { CandidateProfile }

export interface CandidateProfileFields {
  display_name?: string
  headline?: string | null
  summary?: string | null
  phone?: string | null
  location?: string | null
  links?: ProfileLink[]
}

/**
 * Get candidate profile for a user (returns null if not found)
 */
export async function getProfile(userId: string): Promise<CandidateProfile | null> {
  const { data, error } = await supabase
    .from('candidate_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error
  return data
}

/**
 * Upsert candidate profile — always stamps profile_completed_at and profile_version.
 */
export async function upsertProfile(
  userId: string,
  fields: CandidateProfileFields
): Promise<CandidateProfile> {
  const { links, ...rest } = fields
  const { data, error } = await supabase
    .from('candidate_profiles')
    .upsert(
      {
        user_id: userId,
        ...rest,
        links: (links ?? []) as unknown as Json,
        profile_completed_at: new Date().toISOString(),
        profile_version: CURRENT_PROFILE_REQUIREMENTS.version,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )
    .select()
    .single()

  if (error) throw error
  return data
}
