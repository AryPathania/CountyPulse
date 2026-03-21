import { supabase } from '../client'
import type { SubSectionData } from './resumes'

const profileEntries = () => supabase.from('profile_entries')

export interface ProfileEntry {
  id: string
  user_id: string
  category: string
  title: string
  subtitle: string | null
  start_date: string | null
  end_date: string | null
  location: string | null
  text_items: string[]
  sort_order: number
  created_at: string
  updated_at: string
}

export async function getProfileEntries(userId: string): Promise<ProfileEntry[]> {
  const { data, error } = await profileEntries()
    .select('*')
    .eq('user_id', userId)
    .order('category')
    .order('sort_order')
  if (error) throw error
  return (data ?? []) as unknown as ProfileEntry[]
}

export async function getProfileEntriesByCategory(userId: string, category: string): Promise<ProfileEntry[]> {
  const { data, error } = await profileEntries()
    .select('*')
    .eq('user_id', userId)
    .eq('category', category)
    .order('sort_order')
  if (error) throw error
  return (data ?? []) as unknown as ProfileEntry[]
}

export async function createProfileEntry(
  userId: string,
  entry: { category: string; title: string; subtitle?: string | null; start_date?: string | null; end_date?: string | null; location?: string | null; text_items?: string[]; sort_order?: number }
): Promise<ProfileEntry> {
  const { data, error } = await profileEntries()
    .insert({ ...entry, user_id: userId })
    .select()
    .single()
  if (error) throw error
  return data as unknown as ProfileEntry
}

export async function updateProfileEntry(
  id: string,
  updates: Partial<Pick<ProfileEntry, 'title' | 'subtitle' | 'start_date' | 'end_date' | 'location' | 'text_items' | 'sort_order'>>
): Promise<ProfileEntry> {
  const { data, error } = await profileEntries()
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as unknown as ProfileEntry
}

export async function createProfileEntries(
  userId: string,
  entries: Array<{ category: string; title: string; subtitle?: string | null; start_date?: string | null; end_date?: string | null; location?: string | null; text_items?: string[] }>
): Promise<ProfileEntry[]> {
  if (entries.length === 0) return []
  const rows = entries.map((entry, i) => ({ ...entry, user_id: userId, sort_order: i }))
  const { data, error } = await profileEntries()
    .insert(rows)
    .select()
  if (error) throw error
  return (data ?? []) as unknown as ProfileEntry[]
}

export async function deleteProfileEntry(id: string): Promise<void> {
  const { error } = await profileEntries()
    .delete()
    .eq('id', id)
  if (error) throw error
}

/**
 * Convert a profile entry to embeddable text for vector search.
 * Produces a readable sentence fragment comparable to bullet text.
 */
export function toEmbeddableText(entry: ProfileEntry): string {
  const parts = [entry.title]
  if (entry.subtitle) parts.push(entry.subtitle)
  if (entry.location) parts.push(entry.location)
  return parts.join(', ')
}

/**
 * Maps a ProfileEntry to the SubSectionData shape used in resume content JSON.
 */
export function toSubSectionData(entry: ProfileEntry): SubSectionData {
  return {
    id: `entry-${entry.id}`,
    title: entry.title,
    subtitle: entry.subtitle ?? undefined,
    startDate: entry.start_date ?? undefined,
    endDate: entry.end_date ?? undefined,
    location: entry.location ?? undefined,
    textItems: entry.text_items.length > 0 ? entry.text_items : undefined,
  }
}
