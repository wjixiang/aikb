/**
 * Test script for creating sample documents and testing link indexing
 */

import { connectToDatabase } from '@/lib/db/mongodb';
import { LinkIndexingService } from '@/kgrag/services/linkIndexingService';
import { ObjectId } from 'mongodb';
import { createLoggerWithPrefix } from '@/lib/console/logger';

const logger = createLoggerWithPrefix('TestLinkCreation');

async function createTestDocuments() {
  try {
    logger.info('Creating test documents for link indexing...');

    const { db } = await connectToDatabase();
    const documentsCollection = db.collection('notes');

    // Create test documents
    const testDocs = [
      {
        _id: new ObjectId(),
        key: 'test-document-1.md',
        title: 'Test Document 1',
        content:
          'This is the first test document with [[Test Document 2]] and [[Another Document|alias]].',
        lastModified: new Date(),
      },
      {
        _id: new ObjectId(),
        key: 'test-document-2.md',
        title: 'Test Document 2',
        content:
          'This is the second test document that links to [[Test Document 1]] and [[Third Document]].',
        lastModified: new Date(),
      },
      {
        _id: new ObjectId(),
        key: 'third-document.md',
        title: 'Third Document',
        content:
          'This is the third document with [[Test Document 1]] and [[Test Document 2]].',
        lastModified: new Date(),
      },
    ];

    // Insert test documents
    const insertResult = await documentsCollection.insertMany(testDocs);
    logger.info('Test documents created:', {
      insertedIds: Object.keys(insertResult.insertedIds),
    });

    // Test link indexing
    const service = new LinkIndexingService();

    for (const doc of testDocs) {
      logger.info('Indexing links for document:', {
        id: doc._id.toString(),
        title: doc.title,
      });
      await service.indexDocument(doc._id.toString(), doc.content, doc.title);
    }

    // Verify links were created
    const linksCollection = db.collection('links');
    const allLinks = await linksCollection.find({}).toArray();

    logger.info('All links created:', { count: allLinks.length });
    for (const link of allLinks) {
      logger.info('Link:', {
        sourceId: link.sourceId,
        targetId: link.targetId,
        sourceTitle: link.sourceTitle,
        targetTitle: link.targetTitle,
        linkType: link.linkType,
      });
    }

    // Test API endpoints
    const forwardLinks = await service.getForwardLinks(
      testDocs[0]._id.toString(),
    );
    const backwardLinks = await service.getBackwardLinks(
      testDocs[0]._id.toString(),
    );

    logger.info('Forward links for Test Document 1:', {
      count: forwardLinks.length,
      links: forwardLinks,
    });
    logger.info('Backward links for Test Document 1:', {
      count: backwardLinks.length,
      links: backwardLinks,
    });

    logger.info('Test completed successfully!');
  } catch (error) {
    logger.error('Test failed', { error });
    console.error('Test error:', error);
  }
}

// Run test if called directly
if (require.main === module) {
  createTestDocuments();
}

export { createTestDocuments };
