import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'

// Environment variables for different contexts
const getSupabaseConfig = () => {
  // For Edge Functions / Server-side (pipeline package)
  if (typeof process !== 'undefined' && process.env) {
    return {
      url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
      key: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
    }
  }
  
  // For Client-side (UI package) - check if we're in browser
  if (typeof window !== 'undefined' && typeof import.meta !== 'undefined' && (import.meta as any).env) {
    return {
      url: (import.meta as any).env.VITE_SUPABASE_URL,
      key: (import.meta as any).env.VITE_SUPABASE_ANON_KEY
    }
  }
  
  throw new Error('Missing Supabase environment variables')
}

const config = getSupabaseConfig()

if (!config.url || !config.key) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient<Database>(config.url, config.key)

