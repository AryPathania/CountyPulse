import { supabase } from '../client'
import type { Database, Json } from '../types'

export type UploadedResume = Database['public']['Tables']['uploaded_resumes']['Row']
type NewUploadedResume = Database['public']['Tables']['uploaded_resumes']['Insert']

const table = () => supabase.from('uploaded_resumes')

/**
 * Create a new uploaded resume record
 */
export async function createUploadedResume(data: NewUploadedResume): Promise<UploadedResume> {
  const { data: result, error } = await table()
    .insert(data)
    .select()
    .single()

  if (error) throw error
  return result
}

/**
 * Check for duplicate resume by file hash (dedup)
 */
export async function getUploadedResumeByHash(
  userId: string,
  fileHash: string
): Promise<UploadedResume | null> {
  const { data, error } = await table()
    .select('*')
    .eq('user_id', userId)
    .eq('file_hash', fileHash)
    .maybeSingle()

  if (error) throw error
  return data
}

/**
 * Get all uploaded resumes for a user
 */
export async function getUploadedResumes(userId: string): Promise<UploadedResume[]> {
  const { data, error } = await table()
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

/**
 * Upload a resume file to Supabase Storage
 */
export async function uploadResumeFile(
  userId: string,
  file: File,
  storagePath: string
): Promise<string> {
  const { error } = await supabase.storage
    .from('resumes')
    .upload(storagePath, file, {
      contentType: 'application/pdf',
      upsert: false,
    })

  if (error) throw error
  return storagePath
}

/**
 * Update an uploaded resume with parsed data
 */
export async function updateUploadedResumeParsedData(
  resumeId: string,
  parsedData: Json
): Promise<void> {
  const { error } = await table()
    .update({ parsed_data: parsedData })
    .eq('id', resumeId)

  if (error) throw error
}
