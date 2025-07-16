import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseKey)

// Verify connectivity by querying sources table
export const testConnection = async () => {
  try {
    const { data, error } = await supabase.from('sources').select('*').limit(1)
    if (error) throw error
    console.log('Supabase connection successful')
    return data
  } catch (error) {
    console.error('Supabase connection failed:', error)
    throw error
  }
} 