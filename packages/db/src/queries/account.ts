import { supabase } from '../client'

/**
 * Reset all account data for a user.
 * Deletes all resumes, bullets, positions, runs, and profiles while preserving the auth account.
 */
export async function resetAccountData(userId: string): Promise<void> {
  const { error } = await supabase.rpc('reset_account_data', {
    target_user_id: userId,
  })

  if (error) {
    throw error
  }
}
