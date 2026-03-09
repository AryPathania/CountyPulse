import { supabase } from '../client'
import type { Database, Json } from '../types'

type Run = Database['public']['Tables']['runs']['Row']
type NewRun = Database['public']['Tables']['runs']['Insert']

/**
 * Run types for telemetry logging
 */
export type RunType = 'interview' | 'bullet_gen' | 'embed' | 'draft' | 'export'

/**
 * Log an LLM run for telemetry and debugging
 */
export async function logRun(run: NewRun): Promise<Run> {
  const { data, error } = await supabase
    .from('runs')
    .insert(run)
    .select()
    .single()

  if (error) {
    throw error
  }

  return data
}

/**
 * Helper to create a run record with timing
 */
export function createRunLogger(userId: string, type: RunType, promptId?: string) {
  const startTime = Date.now()

  function buildEntry(success: boolean, output: Json, params: { model?: string; input?: Json; tokensIn?: number; tokensOut?: number }): NewRun {
    return {
      user_id: userId,
      type,
      prompt_id: promptId ?? null,
      model: params.model ?? null,
      input: params.input ?? null,
      output,
      success,
      latency_ms: Date.now() - startTime,
      tokens_in: params.tokensIn ?? null,
      tokens_out: params.tokensOut ?? null,
    }
  }

  return {
    async success(params: {
      model?: string
      input?: Json
      output?: Json
      tokensIn?: number
      tokensOut?: number
    }): Promise<Run> {
      return logRun(buildEntry(true, params.output ?? null, params))
    },

    async failure(params: {
      model?: string
      input?: Json
      error: string
    }): Promise<Run> {
      return logRun(buildEntry(false, { error: params.error }, { model: params.model, input: params.input }))
    },
  }
}

/**
 * Get recent runs for a user (for debugging/audit)
 */
export async function getRecentRuns(
  userId: string,
  limit: number = 50
): Promise<Run[]> {
  const { data, error } = await supabase
    .from('runs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw error
  }

  return data
}

/**
 * Get runs by type (for analytics)
 */
export async function getRunsByType(
  userId: string,
  type: RunType,
  limit: number = 100
): Promise<Run[]> {
  const { data, error } = await supabase
    .from('runs')
    .select('*')
    .eq('user_id', userId)
    .eq('type', type)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw error
  }

  return data
}
