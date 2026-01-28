import { supabase } from '../client'
import type { Database } from '../types'

type Bullet = Database['public']['Tables']['bullets']['Row']
type NewBullet = Database['public']['Tables']['bullets']['Insert']
type UpdateBullet = Database['public']['Tables']['bullets']['Update']
type Position = Database['public']['Tables']['positions']['Row']

export type BulletWithPosition = Bullet & {
  position: Pick<Position, 'company' | 'title'> | null
}

/**
 * Get all bullets for a user with position context, ordered by created_at desc
 */
export async function getBullets(userId: string): Promise<BulletWithPosition[]> {
  const { data, error } = await supabase
    .from('bullets')
    .select(`
      *,
      position:positions!bullets_position_id_fkey (
        company,
        title
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  return data as BulletWithPosition[]
}

/**
 * Get bullets for a specific position
 */
export async function getBulletsByPosition(
  userId: string,
  positionId: string
): Promise<Bullet[]> {
  const { data, error } = await supabase
    .from('bullets')
    .select('*')
    .eq('user_id', userId)
    .eq('position_id', positionId)
    .order('created_at', { ascending: true })

  if (error) {
    throw error
  }

  return data
}

/**
 * Get a single bullet by ID with position context
 */
export async function getBullet(bulletId: string): Promise<BulletWithPosition | null> {
  const { data, error } = await supabase
    .from('bullets')
    .select(`
      *,
      position:positions!bullets_position_id_fkey (
        company,
        title
      )
    `)
    .eq('id', bulletId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows returned
      return null
    }
    throw error
  }

  return data as BulletWithPosition
}

/**
 * Create a new bullet
 */
export async function createBullet(bullet: NewBullet): Promise<Bullet> {
  const { data, error } = await supabase
    .from('bullets')
    .insert(bullet)
    .select()
    .single()

  if (error) {
    throw error
  }

  return data
}

/**
 * Update a bullet (current_text, category, skills)
 * Note: was_edited is a generated column computed from original_text vs current_text
 */
export async function updateBullet(
  bulletId: string,
  updates: UpdateBullet
): Promise<Bullet> {
  const updateData: UpdateBullet = {
    ...updates,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('bullets')
    .update(updateData)
    .eq('id', bulletId)
    .select()
    .single()

  if (error) {
    throw error
  }

  return data
}

/**
 * Delete a bullet
 */
export async function deleteBullet(bulletId: string): Promise<void> {
  const { error } = await supabase
    .from('bullets')
    .delete()
    .eq('id', bulletId)

  if (error) {
    throw error
  }
}

/**
 * Create a draft bullet (during interview)
 */
export async function createDraftBullet(
  bullet: Omit<NewBullet, 'is_draft' | 'embedding'>
): Promise<Bullet> {
  const { data, error } = await supabase
    .from('bullets')
    .insert({ ...bullet, is_draft: true })
    .select()
    .single()

  if (error) {
    throw error
  }

  return data
}

/**
 * Finalize draft bullets (mark as non-draft after interview completes)
 */
export async function finalizeDraftBullets(bulletIds: string[]): Promise<void> {
  if (bulletIds.length === 0) return

  const { error } = await supabase
    .from('bullets')
    .update({ is_draft: false })
    .in('id', bulletIds)

  if (error) {
    throw error
  }
}

/**
 * Delete orphaned draft bullets for a user (cleanup)
 */
export async function deleteOrphanedDrafts(userId: string): Promise<void> {
  const { error } = await supabase
    .from('bullets')
    .delete()
    .eq('user_id', userId)
    .eq('is_draft', true)

  if (error) {
    throw error
  }
}
