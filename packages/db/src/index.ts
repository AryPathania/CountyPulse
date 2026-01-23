// Database client and utilities
export { supabase } from './client'

// Query functions
export * from './queries/users'
export * from './queries/profile-completion'
export * from './queries/bullets'
export * from './queries/positions'
export * from './queries/runs'
export * from './queries/job-drafts'
export * from './queries/resumes'

// Types
export type { Database } from './types'
export type { User, Session } from '@supabase/supabase-js'

// Odie Resume types
import type { Database } from './types'

export type UserProfile = Database['public']['Tables']['user_profiles']['Row']
export type CandidateProfile = Database['public']['Tables']['candidate_profiles']['Row']
export type Position = Database['public']['Tables']['positions']['Row']
export type Bullet = Database['public']['Tables']['bullets']['Row']
export type Resume = Database['public']['Tables']['resumes']['Row']
export type JobDraft = Database['public']['Tables']['job_drafts']['Row']
export type Run = Database['public']['Tables']['runs']['Row']

// Insert types for creating records
export type NewCandidateProfile = Database['public']['Tables']['candidate_profiles']['Insert']
export type NewPosition = Database['public']['Tables']['positions']['Insert']
export type NewBullet = Database['public']['Tables']['bullets']['Insert']
export type NewResume = Database['public']['Tables']['resumes']['Insert']
export type NewJobDraft = Database['public']['Tables']['job_drafts']['Insert']
export type NewRun = Database['public']['Tables']['runs']['Insert'] 