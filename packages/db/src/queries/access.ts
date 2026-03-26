import { supabase } from '../client'

/**
 * Check if the current authenticated user is on the beta allowlist.
 * Uses the check_beta_access() RPC which reads the user's email from the JWT.
 * No parameters needed — prevents email enumeration.
 */
export async function checkBetaAccess(): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('check_beta_access')

    if (error) {
      console.error('Beta access check failed:', error.message)
      return false // fail closed
    }

    return data === true
  } catch (err) {
    console.error('Beta access check failed:', err instanceof Error ? err.message : 'Unknown error')
    return false // fail closed
  }
}
