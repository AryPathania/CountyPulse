// Database client and utilities
export { supabase, testConnection } from './client'

// Query functions
export * from './queries/users'
export * from './queries/profile-completion'

// Types
export type { Database } from './types'
export type { User, Session } from '@supabase/supabase-js'

// Shared database types (will be updated when Odie schema is applied)
import type { Database } from './types'

export type UserProfile = Database['public']['Tables']['user_profiles']['Row'] 