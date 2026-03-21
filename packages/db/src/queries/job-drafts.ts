import { supabase } from '../client'
import type { Database, Json } from '../types'
import { toPgVector } from '@odie/shared'

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
 * Match items (bullets + profile entries) for a JD using vector similarity search.
 * Uses the unified match_items SQL function.
 */
export async function matchItemsForJd(
  userId: string,
  jdEmbedding: number[],
  matchCount: number = 50,
  matchThreshold: number = 0.5,
  sourceFilter: 'all' | 'bullets' | 'entries' = 'all'
): Promise<Array<{ id: string; source_type: string; content_text: string; category: string | null; similarity: number }>> {
  const { data, error } = await supabase.rpc('match_items', {
    query_embedding: toPgVector(jdEmbedding),
    match_user_id: userId,
    match_count: matchCount,
    match_threshold: matchThreshold,
    source_filter: sourceFilter,
  })

  if (error) {
    throw error
  }

  return data ?? []
}

/**
 * Match items against individual JD requirements.
 * Calls match_items RPC for each requirement's embedding.
 */
export async function matchItemsPerRequirement(
  userId: string,
  requirements: Array<{
    description: string
    category: string
    importance: 'must_have' | 'nice_to_have'
    embedding: number[]
  }>,
  matchCount: number = 10,
  matchThreshold: number = 0.5
): Promise<
  Array<{
    requirement: { description: string; category: string; importance: 'must_have' | 'nice_to_have' }
    matches: Array<{
      id: string
      source_type: string
      content_text: string
      category: string | null
      similarity: number
    }>
    isCovered: boolean
  }>
> {
  const results = await Promise.all(
    requirements.map(async (req) => {
      const matches = await matchItemsForJd(userId, req.embedding, matchCount, matchThreshold)
      return {
        requirement: {
          description: req.description,
          category: req.category,
          importance: req.importance,
        },
        matches,
        isCovered: matches.length > 0,
      }
    })
  )

  return results
}

/**
 * Update a job draft with parsed requirements and gap analysis
 */
export async function updateJobDraftRequirements(
  draftId: string,
  parsedRequirements: Json | null,
  gapAnalysis: Json | null,
  jobTitle?: string | null,
  company?: string | null
): Promise<JobDraft> {
  const updates: Record<string, Json | null | string> = {
    parsed_requirements: parsedRequirements,
    gap_analysis: gapAnalysis,
  }
  if (jobTitle !== undefined) updates.job_title = jobTitle
  if (company !== undefined) updates.company = company

  const { data, error } = await supabase
    .from('job_drafts')
    .update(updates)
    .eq('id', draftId)
    .select()
    .single()

  if (error) throw error
  return data
}
