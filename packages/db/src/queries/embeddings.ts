import { supabase } from '../client'
import { toPgVector } from '@odie/shared'

/**
 * Generic embedding function for any table with an embedding column.
 * Calls the embed edge function, then updates each row with its embedding vector.
 */
export async function embedItems(
  table: 'bullets' | 'profile_entries',
  ids: string[],
  texts: string[],
  type: 'bullet' | 'entry' = 'bullet'
): Promise<void> {
  if (ids.length === 0) return

  const { data, error } = await supabase.functions.invoke('embed', {
    body: { texts, type },
  })

  if (error) throw error

  const embeddings: number[][] = data.embeddings
  for (let i = 0; i < ids.length; i++) {
    const { error: updateError } = await supabase
      .from(table)
      .update({ embedding: toPgVector(embeddings[i]) })
      .eq('id', ids[i])

    if (updateError) throw updateError
  }
}
