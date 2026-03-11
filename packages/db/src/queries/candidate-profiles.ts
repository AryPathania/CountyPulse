import { supabase } from '../client'
import type { Database } from '../types'

type CandidateProfile = Database['public']['Tables']['candidate_profiles']['Row']

export interface CandidateProfileFields {
  headline?: string | null
  summary?: string | null
  phone?: string | null
  location?: string | null
  linkedin_url?: string | null
  github_url?: string | null
  website_url?: string | null
}

/**
 * Get candidate profile for a user
 */
export async function getCandidateProfile(userId: string): Promise<CandidateProfile | null> {
  const { data, error } = await supabase
    .from('candidate_profiles')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }
  return data
}

/**
 * Upsert candidate profile (create or update)
 */
export async function upsertCandidateProfile(
  userId: string,
  fields: CandidateProfileFields
): Promise<CandidateProfile> {
  const { data, error } = await supabase
    .from('candidate_profiles')
    .upsert(
      {
        user_id: userId,
        ...fields,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )
    .select()
    .single()

  if (error) throw error
  return data
}
