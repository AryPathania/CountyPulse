import { supabase } from '../client'

// NOTE: The uploaded_resumes table exists (migration 022) but types have not
// been regenerated yet. We use inline types and cast through `unknown` to
// satisfy the compiler until `pnpm gen-types` is run.

export interface UploadedResume {
  id: string
  user_id: string
  file_name: string
  file_hash: string
  storage_path: string
  extracted_text: string | null
  parsed_data: Record<string, unknown> | null
  created_at: string
}

interface NewUploadedResume {
  user_id: string
  file_name: string
  file_hash: string
  storage_path: string
  extracted_text?: string | null
  parsed_data?: Record<string, unknown> | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- table not yet in generated types
const table = () => (supabase as any).from('uploaded_resumes')

/**
 * Create a new uploaded resume record
 */
export async function createUploadedResume(data: NewUploadedResume): Promise<UploadedResume> {
  const { data: result, error } = await table()
    .insert(data)
    .select()
    .single()

  if (error) throw error
  return result as unknown as UploadedResume
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
  return data as unknown as UploadedResume | null
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
  return (data ?? []) as unknown as UploadedResume[]
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
  parsedData: Record<string, unknown>
): Promise<void> {
  const { error } = await table()
    .update({ parsed_data: parsedData })
    .eq('id', resumeId)

  if (error) throw error
}
