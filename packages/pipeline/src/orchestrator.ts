import { runScout } from './scout';
import { runFetcher } from './fetcher';
import { runNormalizer } from './normalizer';

export async function main(): Promise<void> {
  try {
    console.log('🚀 Starting County Pulse pipeline...');
    
    console.log('\n📍 Step 1: Running scout to discover new datasets...');
    await runScout();       // Scout & register new datasets
    
    console.log('\n📍 Step 2: Running fetcher to collect raw items...');
    await runFetcher();     // Fetch raw items
    
    console.log('\n📍 Step 3: Running normalizer to process items...');
    await runNormalizer();  // Normalize items
    
    console.log('\n✅ Pipeline completed successfully');
    
  } catch (error) {
    console.error('\n❌ Pipeline failed:', error);
    throw error;
  }
}

// Allow running orchestrator directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
} 