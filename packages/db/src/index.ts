// Export the main client
export { supabase, testConnection } from './client'

// Export all query functions
export * from './queries/sources'
export * from './queries/items'

// Export types
export type { Database } from './types'

// Re-export specific table types for convenience
import type { Database } from './types'

export type Source = Database['public']['Tables']['sources']['Row']
export type NewSource = Database['public']['Tables']['sources']['Insert']
export type UpdateSource = Database['public']['Tables']['sources']['Update']
export type RawItem = Database['public']['Tables']['raw_items']['Row']
export type NewRawItem = Database['public']['Tables']['raw_items']['Insert']
export type NormalizedItem = Database['public']['Tables']['normalized_items']['Row']
export type NewNormalizedItem = Database['public']['Tables']['normalized_items']['Insert']
export type Category = Database['public']['Tables']['categories']['Row']
export type Watch = Database['public']['Tables']['watches']['Row']
export type AgentRun = Database['public']['Tables']['agent_runs']['Row']
export type PromptTemplate = Database['public']['Tables']['prompt_templates']['Row'] 