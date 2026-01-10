import { listMetadata } from '@county-pulse/connectors-socrata-metadata';

/** Test script to validate the Socrata metadata connector */
async function testConnector(): Promise<void> {
  try {
    console.log('🧪 Testing Socrata metadata connector...');
    
    const metadata = await listMetadata();
    console.log(`📊 Successfully fetched ${metadata.length} datasets`);
    
    if (metadata.length > 0) {
      console.log('\n📝 Sample datasets:');
      metadata.slice(0, 5).forEach((meta, index) => {
        console.log(`${index + 1}. ${meta.name}`);
        console.log(`   ID: ${meta.dataset_id}`);
        console.log(`   Description: ${meta.description.substring(0, 100)}...`);
        console.log(`   Created: ${meta.createdAt}`);
        console.log(`   Updated: ${meta.rowsUpdatedAt}`);
        console.log('');
      });
    }
    
    console.log('✅ Connector test completed successfully');
    
  } catch (error) {
    console.error('❌ Connector test failed:', error);
    throw error;
  }
}

// Allow running test directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testConnector().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { testConnector }; 