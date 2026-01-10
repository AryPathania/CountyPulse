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

// Scout-specific functions

/** Returns last time scout ran, or null */
export async function getLastDiscoveryTime(): Promise<Date | null> {
  const { data, error } = await supabase
    .from('sources')
    .select('last_discovered')
    .not('last_discovered', 'is', null)
    .order('last_discovered', { ascending: false })
    .limit(1)
    .maybeSingle()
  
  if (error) throw error
  
  return data?.last_discovered ? new Date(data.last_discovered) : null
}

/** Updates last_discovered timestamp on sources that don't have one yet */
export async function updateLastDiscoveryTime(ts: Date): Promise<void> {
  const { error } = await supabase
    .from('sources')
    .update({ last_discovered: ts.toISOString() })
    .is('last_discovered', null)
  
  if (error) throw error
}

interface DatasetMetadata {
  dataset_id: string
  name: string
  description: string
  domain: string
}

/** Inserts or updates a source from metadata, storing the agent's reason */
export async function upsertSourceFromMetadata(
  meta: DatasetMetadata,
  reason: string
): Promise<void> {
  const { error } = await supabase.from('sources').upsert({
    code: `socrata_${meta.dataset_id}`,
    name: meta.name,
    connector: 'SocrataConnector',
    fetch_interval: '1 hour',
    config: { 
      datasetId: meta.dataset_id, 
      domain: meta.domain, 
      appToken: process.env.SOCRATA_APP_TOKEN 
    },
    last_discovered: new Date().toISOString(),
    discovery_reason: reason
  })
  
  if (error) throw error
}

/** Records feedback on a scout decision */
export async function insertScoutFeedback(
  datasetId: string,
  decision: 'include' | 'exclude',
  feedback: string
): Promise<void> {
  const { error } = await supabase.from('scout_feedback').insert({
    dataset_id: datasetId,
    decision,
    feedback
  })
  
  if (error) throw error
} 