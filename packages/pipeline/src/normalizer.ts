/** Normalizes raw items into structured data with embeddings */
export async function runNormalizer(): Promise<void> {
  try {
    console.log('🔄 Starting normalizer...');
    
    // TODO: Implement actual normalization logic
    // - Query raw_items for unprocessed items
    // - Parse and structure the data
    // - Generate embeddings
    // - Store results in normalized_items table
    
    console.log('⚠️  Normalizer implementation coming soon');
    
  } catch (error) {
    console.error('❌ Normalizer failed:', error);
    throw error;
  }
}

// Allow running normalizer directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runNormalizer().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
} 