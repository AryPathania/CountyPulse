import { listMetadata, type DatasetMeta } from '@county-pulse/connectors-socrata-metadata';
import {
  getLastDiscoveryTime,
  upsertSourceFromMetadata,
  updateLastDiscoveryTime
} from '@county-pulse/db/src/queries/sources';
import { classifyDatasets } from './scoutAgent';

export async function runScout(): Promise<void> {
  try {
    console.log('🔍 Starting scout run...');
    
    // Step 1: Check when we last ran discovery
    const last = await getLastDiscoveryTime();
    console.log('📅 Last discovery time:', last?.toISOString() ?? 'never');
    
    // Step 2: Fetch all metadata from Socrata
    console.log('📊 Fetching metadata from Socrata...');
    const allMeta = await listMetadata();
    console.log(`📝 Found ${allMeta.length} total datasets`);
    
    // Step 3: Filter to only recent datasets (created or updated since last run)
    const recent = allMeta.filter((m: DatasetMeta) => {
      if (!last) return true; // First run, process everything
      
      const createdAt = new Date(m.createdAt);
      const updatedAt = new Date(m.rowsUpdatedAt);
      
      return createdAt > last || updatedAt > last;
    });
    
    console.log(`🔄 Processing ${recent.length} recent datasets`);
    
    if (recent.length === 0) {
      console.log('✅ No new datasets to process');
      return;
    }
    
    // Step 4: Use AI to classify datasets
    console.log('🤖 Classifying datasets with AI...');
    const decisions = await classifyDatasets(recent);
    console.log(`📋 Classified ${decisions.length} datasets`);
    
    // Step 5: Process included datasets
    const includedDecisions = decisions.filter(x => x.decision === 'include');
    console.log(`➕ Including ${includedDecisions.length} datasets`);
    
    for (const decision of includedDecisions) {
      const meta = recent.find((m: DatasetMeta) => m.dataset_id === decision.dataset_id);
      if (meta) {
        await upsertSourceFromMetadata({
          dataset_id: meta.dataset_id,
          name: meta.name,
          description: meta.description,
          domain: 'data.kingcounty.gov'
        }, decision.reason);
        
        console.log(`✅ Added source: ${meta.name}`);
      }
    }
    
    // Step 6: Update discovery timestamp for next run
    await updateLastDiscoveryTime(new Date());
    console.log('🎉 Scout run completed successfully');
    
  } catch (error) {
    console.error('❌ Scout run failed:', error);
    throw error;
  }
}

// Allow running scout directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runScout().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
} 