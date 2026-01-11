import { supabase } from '../client'
import type { Database } from '../types'

type JobDraft = Database['public']['Tables']['job_drafts']['Row']
type NewJobDraft = Database['public']['Tables']['job_drafts']['Insert']

export type JobDraftWithBullets = JobDraft & {
  bullets: Array<{
    id: string
    current_text: string
    category: string | null
    position: {
      company: string
      title: string
    } | null
  }>
}

/**
 * Get all job drafts for a user, ordered by created_at desc
 */
export async function getJobDrafts(userId: string): Promise<JobDraft[]> {
  const { data, error } = await supabase
    .from('job_drafts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  return data
}

/**
 * Get a single job draft with its matched bullets
 */
export async function getJobDraftWithBullets(
  draftId: string
): Promise<JobDraftWithBullets | null> {
  const { data: draft, error: draftError } = await supabase
    .from('job_drafts')
    .select('*')
    .eq('id', draftId)
    .single()

  if (draftError) {
    if (draftError.code === 'PGRST116') {
      return null
    }
    throw draftError
  }

  // Fetch the selected bullets with position info
  const bulletIds = draft.selected_bullet_ids ?? draft.retrieved_bullet_ids ?? []
  if (bulletIds.length === 0) {
    return { ...draft, bullets: [] }
  }

  const { data: bullets, error: bulletsError } = await supabase
    .from('bullets')
    .select(`
      id,
      current_text,
      category,
      position:positions!bullets_position_id_fkey (
        company,
        title
      )
    `)
    .in('id', bulletIds)

  if (bulletsError) {
    throw bulletsError
  }

  // Sort bullets to match the order in the array
  const bulletMap = new Map(bullets.map((b) => [b.id, b]))
  const orderedBullets = bulletIds
    .map((id: string) => bulletMap.get(id))
    .filter(Boolean) as JobDraftWithBullets['bullets']

  return { ...draft, bullets: orderedBullets }
}

/**
 * Create a new job draft
 */
export async function createJobDraft(draft: NewJobDraft): Promise<JobDraft> {
  const { data, error } = await supabase
    .from('job_drafts')
    .insert(draft)
    .select()
    .single()

  if (error) {
    throw error
  }

  return data
}

/**
 * Update selected bullets for a job draft
 */
export async function updateJobDraftBullets(
  draftId: string,
  selectedBulletIds: string[]
): Promise<JobDraft> {
  const { data, error } = await supabase
    .from('job_drafts')
    .update({ selected_bullet_ids: selectedBulletIds })
    .eq('id', draftId)
    .select()
    .single()

  if (error) {
    throw error
  }

  return data
}

/**
 * Delete a job draft
 */
export async function deleteJobDraft(draftId: string): Promise<void> {
  const { error } = await supabase
    .from('job_drafts')
    .delete()
    .eq('id', draftId)

  if (error) {
    throw error
  }
}

/**
 * Match bullets for a JD using vector similarity search
 * Uses the match_bullets SQL function
 */
export async function matchBulletsForJd(
  userId: string,
  jdEmbedding: number[],
  matchCount: number = 50,
  matchThreshold: number = 0.5
): Promise<Array<{ id: string; current_text: string; category: string | null; similarity: number }>> {
  // Convert embedding array to pgvector format string
  const embeddingString = `[${jdEmbedding.join(',')}]`

  const { data, error } = await supabase.rpc('match_bullets', {
    query_embedding: embeddingString,
    match_user_id: userId,
    match_count: matchCount,
    match_threshold: matchThreshold,
  })

  if (error) {
    throw error
  }

  return data ?? []
}
