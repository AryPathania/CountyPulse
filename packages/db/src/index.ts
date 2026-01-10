// Database client and utilities
export { supabase, testConnection } from './client'

// Query functions 
export * from './queries/items'
export * from './queries/sources'
export * from './queries/users'
export * from './queries/profile-completion'
export * from './queries/agentRuns'

// Types
export type { Database } from './types'

// Shared database types
import type { Database } from './types'

export type RawItem = Database['public']['Tables']['raw_items']['Row']
export type NormalizedItem = Database['public']['Tables']['normalized_items']['Row']
export type Source = Database['public']['Tables']['sources']['Row']
export type Category = Database['public']['Tables']['categories']['Row']
export type Watch = Database['public']['Tables']['watches']['Row']
export type UserProfile = Database['public']['Tables']['user_profiles']['Row']
export type AgentRun = Database['public']['Tables']['agent_runs']['Row']
export type PromptTemplate = Database['public']['Tables']['prompt_templates']['Row']
export type ScoutFeedback = Database['public']['Tables']['scout_feedback']['Row'] 