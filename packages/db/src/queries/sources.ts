import { supabase } from '../client'
import type { Database } from '../types'

type Source = Database['public']['Tables']['sources']['Row']
type NewSource = Database['public']['Tables']['sources']['Insert']
type UpdateSource = Database['public']['Tables']['sources']['Update']

export const getSources = async (): Promise<Source[]> => {
  const { data, error } = await supabase
    .from('sources')
    .select('*')
    .order('id')
  
  if (error) throw error
  return data
}

export const getSourceById = async (id: number): Promise<Source | null> => {
  const { data, error } = await supabase
    .from('sources')
    .select('*')
    .eq('id', id)
    .single()
  
  if (error) {
    if (error.code === 'PGRST116') return null // Not found
    throw error
  }
  return data
}

export const getSourceByCode = async (code: string): Promise<Source | null> => {
  const { data, error } = await supabase
    .from('sources')
    .select('*')
    .eq('code', code)
    .single()
  
  if (error) {
    if (error.code === 'PGRST116') return null // Not found
    throw error
  }
  return data
}

export const createSource = async (source: NewSource): Promise<Source> => {
  const { data, error } = await supabase
    .from('sources')
    .insert(source)
    .select()
    .single()
  
  if (error) throw error
  return data
}

export const updateSource = async (id: number, updates: UpdateSource): Promise<Source> => {
  const { data, error } = await supabase
    .from('sources')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  
  if (error) throw error
  return data
}

export const deleteSource = async (id: number): Promise<void> => {
  const { error } = await supabase
    .from('sources')
    .delete()
    .eq('id', id)
  
  if (error) throw error
} 