import OpenAI from 'openai';
import type { DatasetMeta } from '@county-pulse/connectors-socrata-metadata';
import { startAgentRun, succeedAgentRun, failAgentRun } from '@county-pulse/db/src/queries/agentRuns';

const llm = new OpenAI({
  apiKey: process.env.OPENAI_COUNTY_PULSE_SCOUT
});

interface ScoutDecision {
  dataset_id: string;
  decision: 'include' | 'exclude';
  reason: string;
}

/** Classifies each dataset as include/exclude with a reason using LLM */
export async function classifyDatasets(metas: DatasetMeta[]): Promise<ScoutDecision[]> {
  if (metas.length === 0) {
    return [];
  }

  const runId = await startAgentRun('scout-classifier', { 
    datasetCount: metas.length,
    model: 'gpt-3.5-turbo'
  });

  try {
    const prompt = `You are a data scout for County Pulse.
For each King County dataset (ID, name, description), decide "include" or "exclude",
with a one-sentence reason. Include only if it clearly relates to public government
actions: courts, budgets, permits, inspections, or public meetings.
Return a JSON array: [{ "dataset_id":"...", "decision":"include","reason":"..." }, ...].`;

    console.log(`Classifying ${metas.length} datasets with OpenAI...`);
    
    const response = await llm.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: JSON.stringify(metas.map(m => ({
          dataset_id: m.dataset_id,
          name: m.name,
          description: m.description,
          classification: m.classification
        }))) }
      ],
      stream: false,
      temperature: 0.1, // Low temperature for consistent classification
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content received from OpenAI');
    }

    const decisions = JSON.parse(content) as ScoutDecision[];
    
    // Validate response format
    if (!Array.isArray(decisions)) {
      throw new Error('Response is not an array');
    }

    for (const decision of decisions) {
      if (!decision.dataset_id || !decision.decision || !decision.reason) {
        throw new Error(`Invalid decision format: ${JSON.stringify(decision)}`);
      }
      if (!['include', 'exclude'].includes(decision.decision)) {
        throw new Error(`Invalid decision value: ${decision.decision}`);
      }
    }

    await succeedAgentRun(runId, {
      tokensUsed: response.usage?.total_tokens || 0,
      promptTokens: response.usage?.prompt_tokens || 0,
      completionTokens: response.usage?.completion_tokens || 0,
      decisionsCount: decisions.length,
      includeCount: decisions.filter(d => d.decision === 'include').length,
      excludeCount: decisions.filter(d => d.decision === 'exclude').length
    });

    console.log(`Classification complete: ${decisions.filter(d => d.decision === 'include').length} included, ${decisions.filter(d => d.decision === 'exclude').length} excluded`);
    
    return decisions;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Classification failed:', errorMessage);
    
    await failAgentRun(runId, errorMessage);
    throw error;
  }
} 