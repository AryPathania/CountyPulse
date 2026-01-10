import { supabase } from '../client'
import type { Database } from '../types'

type AgentRun = Database['public']['Tables']['agent_runs']['Row']
type NewAgentRun = Database['public']['Tables']['agent_runs']['Insert']
type UpdateAgentRun = Database['public']['Tables']['agent_runs']['Update']

/** Starts a new agent run and returns the run ID */
export async function startAgentRun(
  agentName: string, 
  args: Record<string, any>,
  sourceId?: number,
  promptId?: number
): Promise<string> {
  const { data, error } = await supabase
    .from('agent_runs')
    .insert({
      source_id: sourceId || null,
      prompt_id: promptId || null,
      run_at: new Date().toISOString(),
      status: 'running',
      // Store agent name and args in error field temporarily for identification
      error: JSON.stringify({ agent: agentName, args })
    })
    .select('id')
    .single()
  
  if (error) throw error
  return data.id
}

/** Marks an agent run as successful with optional usage data */
export async function succeedAgentRun(
  runId: string, 
  usage?: Record<string, any>
): Promise<void> {
  const now = new Date()
  const { error } = await supabase
    .from('agent_runs')
    .update({
      status: 'success',
      error: usage ? JSON.stringify(usage) : null,
      duration_ms: null // Will be calculated if run_at is set
    })
    .eq('id', runId)
  
  if (error) throw error
}

/** Marks an agent run as failed with error message */
export async function failAgentRun(
  runId: string, 
  errorMessage: string
): Promise<void> {
  const { error } = await supabase
    .from('agent_runs')
    .update({
      status: 'failed',
      error: errorMessage
    })
    .eq('id', runId)
  
  if (error) throw error
}

/** Gets all agent runs, optionally filtered by status */
export async function getAgentRuns(status?: string): Promise<AgentRun[]> {
  let query = supabase
    .from('agent_runs')
    .select('*')
    .order('run_at', { ascending: false })
  
  if (status) {
    query = query.eq('status', status)
  }
  
  const { data, error } = await query
  if (error) throw error
  return data
}

/** Gets a specific agent run by ID */
export async function getAgentRunById(runId: string): Promise<AgentRun | null> {
  const { data, error } = await supabase
    .from('agent_runs')
    .select('*')
    .eq('id', runId)
    .single()
  
  if (error) {
    if (error.code === 'PGRST116') return null // Not found
    throw error
  }
  return data
} 