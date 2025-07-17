import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseKey)

// Verify connectivity by querying sources table
export const testConnection = async () => {
  try {
    const { data, error } = await supabase.from('sources').select('*').limit(1)
    if (error) throw error
    return data
  } catch (error) {
    console.error('Supabase connection failed:', error)
    throw error
  }
} 