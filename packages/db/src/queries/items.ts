import { supabase } from '../client'
import type { Database } from '../types'

type RawItem = Database['public']['Tables']['raw_items']['Row']
type NewRawItem = Database['public']['Tables']['raw_items']['Insert']
type NormalizedItem = Database['public']['Tables']['normalized_items']['Row']
type NewNormalizedItem = Database['public']['Tables']['normalized_items']['Insert']

// Raw Items
export const getRawItems = async (sourceId?: number): Promise<RawItem[]> => {
  let query = supabase
    .from('raw_items')
    .select('*')
    .order('fetched_at', { ascending: false })
  
  if (sourceId) {
    query = query.eq('source_id', sourceId)
  }
  
  const { data, error } = await query
  if (error) throw error
  return data
}

export const getRawItemById = async (id: string): Promise<RawItem | null> => {
  const { data, error } = await supabase
    .from('raw_items')
    .select('*')
    .eq('id', id)
    .single()
  
  if (error) {
    if (error.code === 'PGRST116') return null // Not found
    throw error
  }
  return data
}

export const createRawItem = async (item: NewRawItem): Promise<RawItem> => {
  const { data, error } = await supabase
    .from('raw_items')
    .insert(item)
    .select()
    .single()
  
  if (error) throw error
  return data
}

// Normalized Items
export const getNormalizedItems = async (category?: string): Promise<NormalizedItem[]> => {
  let query = supabase
    .from('normalized_items')
    .select('*')
    .order('published_at', { ascending: false })
  
  if (category) {
    query = query.eq('category', category)
  }
  
  const { data, error } = await query
  if (error) throw error
  return data
}

export const getNormalizedItemById = async (id: string): Promise<NormalizedItem | null> => {
  const { data, error } = await supabase
    .from('normalized_items')
    .select('*')
    .eq('id', id)
    .single()
  
  if (error) {
    if (error.code === 'PGRST116') return null // Not found
    throw error
  }
  return data
}

export const createNormalizedItem = async (item: NewNormalizedItem): Promise<NormalizedItem> => {
  const { data, error } = await supabase
    .from('normalized_items')
    .insert(item)
    .select()
    .single()
  
  if (error) throw error
  return data
}

export const searchNormalizedItems = async (query: string): Promise<NormalizedItem[]> => {
  const { data, error } = await supabase
    .from('normalized_items')
    .select('*')
    .or(`title.ilike.%${query}%,summary.ilike.%${query}%`)
    .order('published_at', { ascending: false })
  
  if (error) throw error
  return data
} 