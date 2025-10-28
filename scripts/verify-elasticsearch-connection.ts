import { Client } from '@elastic/elasticsearch';
import { config } from 'dotenv';
config()

const client = new Client({
  node: process.env['ELASTICSEARCH_URL']
})

async function verifyElasticsearchConnection() {
  try {
    console.log('Verifying Elasticsearch connection...');
    console.log(`Elasticsearch URL: ${process.env['ELASTICSEARCH_URL'] || 'Not set'}`);
    
    // Ping the Elasticsearch cluster
    const pingResponse = await client.ping();
    
    if (pingResponse) {
      console.log('✅ Successfully connected to Elasticsearch!');
      
      // Get cluster info for additional verification
      const infoResponse = await client.info();
      console.log(`📊 Cluster info:`);
      console.log(`   - Name: ${infoResponse.cluster_name}`);
      console.log(`   - Version: ${infoResponse.version.number}`);
      console.log(`   - Tagline: ${infoResponse.tagline}`);
      
      return true;
    } else {
      console.log('❌ Failed to ping Elasticsearch');
      return false;
    }
  } catch (error) {
    console.error('❌ Error connecting to Elasticsearch:');
    if (error instanceof Error) {
      console.error(`   - Message: ${error.message}`);
      console.error(`   - Name: ${error.name}`);
    } else {
      console.error(`   - Unknown error: ${error}`);
    }
    return false;
  } finally {
    await client.close();
  }
}

// Run the verification
verifyElasticsearchConnection()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
