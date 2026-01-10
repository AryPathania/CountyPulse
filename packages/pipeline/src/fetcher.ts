/** Fetches raw data from all configured sources */
export async function runFetcher(): Promise<void> {
  try {
    console.log('📡 Starting fetcher...');
    
    // TODO: Implement actual fetching logic
    // - Query sources table for all sources
    // - For each source, run the appropriate connector
    // - Store results in raw_items table
    
    console.log('⚠️  Fetcher implementation coming soon');
    
  } catch (error) {
    console.error('❌ Fetcher failed:', error);
    throw error;
  }
}

// Allow running fetcher directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runFetcher().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
} 