import { supabase } from '../client'

/**
 * Reset all account data for a user.
 * Deletes all resumes, bullets, positions, runs, uploaded resumes, and profiles
 * while preserving the auth account. Also cleans up storage bucket files.
 */
export async function resetAccountData(userId: string): Promise<void> {
  const { error } = await supabase.rpc('reset_account_data', {
    target_user_id: userId,
  })

  if (error) {
    throw error
  }

  // Clean up uploaded PDF files from storage bucket (best-effort)
  const { data: files, error: listError } = await supabase.storage.from('resumes').list(userId)
  if (listError) {
    console.warn('Failed to list storage files for cleanup:', listError.message)
  }
  if (files && files.length > 0) {
    const paths = files.map(f => `${userId}/${f.name}`)
    const { error: removeError } = await supabase.storage.from('resumes').remove(paths)
    if (removeError) {
      console.warn('Failed to remove storage files:', removeError.message)
    }
  }
}
