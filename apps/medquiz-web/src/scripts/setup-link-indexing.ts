/**
 * Setup script for initializing the bidirectional link indexing system
 */

import { LinkSchemaManager } from '@/kgrag/database/linkSchema';
import { LinkIndexingService } from '@/kgrag/services/linkIndexingService';
import { LinkIntegrationService } from '@/kgrag/services/linkIntegrationService';
import { createLoggerWithPrefix } from '@/lib/console/logger';

const logger = createLoggerWithPrefix('SetupLinkIndexing');

async function setupLinkIndexing() {
  try {
    logger.info('Starting link indexing system setup...');

    // Initialize database schema
    await LinkSchemaManager.initializeCollection();
    logger.info('✓ Database schema initialized');

    // Initialize integration service
    const integrationService = new LinkIntegrationService();
    await integrationService.initialize();
    logger.info('✓ Integration service initialized');

    // Rebuild existing index
    const indexingService = new LinkIndexingService();
    const processedCount = await indexingService.rebuildIndex();
    logger.info(`✓ Rebuilt index for ${processedCount} documents`);

    // Get final stats
    const stats = await integrationService.getStatus();
    logger.info('✓ Setup completed successfully', stats);

    console.log('\n🎉 Link indexing system setup completed!');
    console.log(`📊 Total documents: ${stats.totalDocuments}`);
    console.log(`🔗 Indexed documents: ${stats.indexedDocuments}`);
    console.log(`📈 Total links: ${stats.totalLinks}`);
  } catch (error) {
    logger.error('Failed to setup link indexing system', { error });
    console.error('Setup failed:', error);
    process.exit(1);
  }
}

// Run setup if called directly
if (require.main === module) {
  setupLinkIndexing();
}

export { setupLinkIndexing };
