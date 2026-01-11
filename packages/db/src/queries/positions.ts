import { supabase } from '../client'
import type { Database } from '../types'

type Position = Database['public']['Tables']['positions']['Row']
type NewPosition = Database['public']['Tables']['positions']['Insert']
type UpdatePosition = Database['public']['Tables']['positions']['Update']

/**
 * Get all positions for a user, ordered by start_date desc (most recent first)
 */
export async function getPositions(userId: string): Promise<Position[]> {
  const { data, error } = await supabase
    .from('positions')
    .select('*')
    .eq('user_id', userId)
    .order('start_date', { ascending: false, nullsFirst: false })

  if (error) {
    throw error
  }

  return data
}

/**
 * Get a single position by ID
 */
export async function getPosition(positionId: string): Promise<Position | null> {
  const { data, error } = await supabase
    .from('positions')
    .select('*')
    .eq('id', positionId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    throw error
  }

  return data
}

/**
 * Create a new position
 */
export async function createPosition(position: NewPosition): Promise<Position> {
  const { data, error } = await supabase
    .from('positions')
    .insert(position)
    .select()
    .single()

  if (error) {
    throw error
  }

  return data
}

/**
 * Update a position
 */
export async function updatePosition(
  positionId: string,
  updates: UpdatePosition
): Promise<Position> {
  const { data, error } = await supabase
    .from('positions')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', positionId)
    .select()
    .single()

  if (error) {
    throw error
  }

  return data
}

/**
 * Delete a position (cascades to bullets)
 */
export async function deletePosition(positionId: string): Promise<void> {
  const { error } = await supabase
    .from('positions')
    .delete()
    .eq('id', positionId)

  if (error) {
    throw error
  }
}

/**
 * Create position with associated bullets in a single transaction-like flow
 * Note: Supabase JS doesn't support true transactions, so we do best-effort
 */
export async function createPositionWithBullets(
  position: NewPosition,
  bullets: Array<{
    original_text: string
    current_text: string
    category?: string
    hard_skills?: string[]
    soft_skills?: string[]
  }>
): Promise<{ position: Position; bulletIds: string[] }> {
  // Create the position first
  const createdPosition = await createPosition(position)

  // Create bullets for this position
  const bulletRecords = bullets.map((b) => ({
    user_id: position.user_id,
    position_id: createdPosition.id,
    original_text: b.original_text,
    current_text: b.current_text,
    category: b.category ?? null,
    hard_skills: b.hard_skills ?? [],
    soft_skills: b.soft_skills ?? [],
  }))

  if (bulletRecords.length > 0) {
    const { data: createdBullets, error } = await supabase
      .from('bullets')
      .insert(bulletRecords)
      .select('id')

    if (error) {
      // Best effort: try to clean up the position
      await supabase.from('positions').delete().eq('id', createdPosition.id)
      throw error
    }

    return {
      position: createdPosition,
      bulletIds: createdBullets.map((b) => b.id),
    }
  }

  return { position: createdPosition, bulletIds: [] }
}
