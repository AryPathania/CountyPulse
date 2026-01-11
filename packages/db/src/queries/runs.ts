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

  return {
    /**
     * Log successful completion
     */
    async success(params: {
      model?: string
      input?: Json
      output?: Json
      tokensIn?: number
      tokensOut?: number
    }): Promise<Run> {
      const latencyMs = Date.now() - startTime
      return logRun({
        user_id: userId,
        type,
        prompt_id: promptId ?? null,
        model: params.model ?? null,
        input: params.input ?? null,
        output: params.output ?? null,
        success: true,
        latency_ms: latencyMs,
        tokens_in: params.tokensIn ?? null,
        tokens_out: params.tokensOut ?? null,
      })
    },

    /**
     * Log failure
     */
    async failure(params: {
      model?: string
      input?: Json
      error: string
    }): Promise<Run> {
      const latencyMs = Date.now() - startTime
      return logRun({
        user_id: userId,
        type,
        prompt_id: promptId ?? null,
        model: params.model ?? null,
        input: params.input ?? null,
        output: { error: params.error },
        success: false,
        latency_ms: latencyMs,
        tokens_in: null,
        tokens_out: null,
      })
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
