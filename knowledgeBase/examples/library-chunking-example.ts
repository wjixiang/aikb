/**
 * Example demonstrating the chunking and embedding functionality
 * for PDF documents in the knowledge base library.
 */

import Library, { S3ElasticSearchLibraryStorage } from '../knowledgeImport/liberary';
import { createMinerUConvertorFromEnv } from '../knowledgeImport/PdfConvertor';
import createLoggerWithPrefix from '../lib/logger';

const logger = createLoggerWithPrefix('LibraryChunkingExample');

async function main() {
  try {
    logger.info('Starting library chunking example...');

    // Initialize the library with Elasticsearch storage
    const elasticsearchUrl = process.env.ELASTICSEARCH_URL || 'http://elasticsearch:9200';
    const vectorDimensions = parseInt(process.env.EMBEDDING_DIMENSIONS || '1536');
    
    const storage = new S3ElasticSearchLibraryStorage(elasticsearchUrl, vectorDimensions);
    const pdfConvertor = createMinerUConvertorFromEnv();
    
    const library = new Library(storage, pdfConvertor);

    // Example 1: Upload a PDF and automatically process chunks
    logger.info('Example 1: Uploading PDF and processing chunks');
    
    // Note: Replace with actual PDF buffer in real usage
    const pdfBuffer = Buffer.from('mock pdf content');
    const metadata = {
      title: 'Sample Research Paper',
      authors: [
        { firstName: 'John', lastName: 'Doe' },
        { firstName: 'Jane', lastName: 'Smith' }
      ],
      abstract: 'This is a sample research paper about machine learning.',
      publicationYear: 2023,
      tags: ['machine learning', 'research', 'AI'],
      fileType: 'pdf' as const,
    };

    // Store the PDF - this will automatically convert to markdown and process chunks
    const item = await library.storePdf(pdfBuffer, 'sample-paper.pdf', metadata);
    logger.info(`Stored item with ID: ${item.metadata.id}`);

    // Example 2: Manually process chunks with different strategies
    logger.info('Example 2: Processing chunks with different strategies');
    
    // Process chunks using H1 headings (default)
    await library.processItemChunks(item.metadata.id!, 'h1');
    let h1Chunks = await library.getItemChunks(item.metadata.id!);
    logger.info(`H1 chunking produced ${h1Chunks.length} chunks`);
    
    // Re-process using paragraph chunking
    await library.processItemChunks(item.metadata.id!, 'paragraph');
    let paragraphChunks = await library.getItemChunks(item.metadata.id!);
    logger.info(`Paragraph chunking produced ${paragraphChunks.length} chunks`);

    // Example 3: Search chunks
    logger.info('Example 3: Searching chunks');
    
    // Search by content
    const textSearchResults = await library.searchChunks({
      query: 'machine learning',
      limit: 5,
    });
    logger.info(`Found ${textSearchResults.length} chunks matching 'machine learning'`);
    
    textSearchResults.forEach((chunk, index) => {
      logger.info(`Result ${index + 1}: ${chunk.title} - ${chunk.content.substring(0, 100)}...`);
    });

    // Example 4: Find similar chunks using embeddings
    logger.info('Example 4: Finding similar chunks');
    
    // Create a mock query vector (in real usage, this would come from embedding a search query)
    const queryVector = new Array(vectorDimensions).fill(0).map((_, i) => Math.random());
    
    // Method 1: Using the general findSimilarChunks with itemIds filter
    const similarChunksGeneral = await library.findSimilarChunks(
      queryVector,
      5, // limit
      0.7, // similarity threshold
      [item.metadata.id!] // search within this item only
    );
    
    logger.info(`Found ${similarChunksGeneral.length} similar chunks using general method`);
    similarChunksGeneral.forEach((chunk, index) => {
      logger.info(`Similar ${index + 1}: ${chunk.title} (similarity: ${chunk.similarity.toFixed(3)})`);
    });

    // Method 2: Using the new findSimilarChunksInItem method (more convenient)
    const similarChunksInItemMethod = await library.findSimilarChunksInItem(
      item.metadata.id!,
      queryVector,
      5, // limit
      0.7, // similarity threshold
    );
    
    logger.info(`Found ${similarChunksInItemMethod.length} similar chunks using item-specific method`);
    similarChunksInItemMethod.forEach((chunk, index) => {
      logger.info(`Similar ${index + 1}: ${chunk.title} (similarity: ${chunk.similarity.toFixed(3)})`);
    });

    // Example 5: Item-specific text search
    logger.info('Example 5: Item-specific text search');
    
    // Method 1: Using the general searchChunks with itemId filter
    const itemSearchResults1 = await library.searchChunks({
      query: 'machine learning',
      itemId: item.metadata.id!,
      limit: 5,
    });
    
    logger.info(`Found ${itemSearchResults1.length} chunks in specific item using general method`);
    
    // Method 2: Using the new searchChunksInItem method (more convenient)
    const itemSearchResultsMethod = await library.searchChunksInItem(
      item.metadata.id!,
      'machine learning',
      5
    );
    
    logger.info(`Found ${itemSearchResultsMethod.length} chunks in specific item using item-specific method`);
    itemSearchResultsMethod.forEach((chunk, index) => {
      logger.info(`Result ${index + 1}: ${chunk.title} - ${chunk.content.substring(0, 100)}...`);
    });

    // Example 6: Re-process chunks for multiple items
    logger.info('Example 6: Re-processing chunks for all items');
    
    // Upload another document
    const pdfBuffer2 = Buffer.from('mock pdf content 2');
    const metadata2 = {
      title: 'Another Research Paper',
      authors: [{ firstName: 'Alice', lastName: 'Johnson' }],
      abstract: 'Another research paper about deep learning.',
      publicationYear: 2023,
      tags: ['deep learning', 'neural networks'],
      fileType: 'pdf' as const,
    };
    
    const item2 = await library.storePdf(pdfBuffer2, 'another-paper.pdf', metadata2);
    logger.info(`Stored second item with ID: ${item2.metadata.id}`);

    // Re-process chunks for all items
    await library.reProcessChunks(undefined, 'h1');
    logger.info('Re-processed chunks for all items');

    // Example 7: Batch operations across multiple items
    logger.info('Example 7: Batch search across multiple items');
    
    const batchResults = await library.searchChunks({
      query: 'learning',
      itemIds: [item.metadata.id!, item2.metadata.id!],
      limit: 10,
    });
    
    logger.info(`Found ${batchResults.length} chunks across multiple items`);

    // Example 8: Compare search results between different items
    logger.info('Example 8: Comparing search results between different items');
    
    const queryVector2 = new Array(vectorDimensions).fill(0).map((_, i) => Math.random());
    
    // Search in first item
    const similarInItem1 = await library.findSimilarChunksInItem(item.metadata.id!, queryVector2, 3);
    logger.info(`Found ${similarInItem1.length} similar chunks in item 1: "${item.metadata.title}"`);
    
    // Search in second item
    const similarInItem2 = await library.findSimilarChunksInItem(item2.metadata.id!, queryVector2, 3);
    logger.info(`Found ${similarInItem2.length} similar chunks in item 2: "${item2.metadata.title}"`);
    
    // Search across both items
    const similarInBoth = await library.findSimilarChunks(queryVector2, 5, 0.5, [item.metadata.id!, item2.metadata.id!]);
    logger.info(`Found ${similarInBoth.length} similar chunks across both items`);

    // Example 9: Text search comparison between items
    logger.info('Example 9: Text search comparison between items');
    
    const searchQuery = 'learning';
    
    // Search in first item
    const textResults1 = await library.searchChunksInItem(item.metadata.id!, searchQuery, 5);
    logger.info(`Found ${textResults1.length} text matches in item 1: "${item.metadata.title}"`);
    
    // Search in second item
    const textResults2 = await library.searchChunksInItem(item2.metadata.id!, searchQuery, 5);
    logger.info(`Found ${textResults2.length} text matches in item 2: "${item2.metadata.title}"`);

    // Example 10: LibraryItem-level chunking and embedding
    logger.info('Example 10: LibraryItem-level chunking and embedding');
    
    // Get the LibraryItem instance
    const libraryItem = await library.getBook(item.metadata.id!);
    if (!libraryItem) {
      throw new Error('Could not retrieve library item');
    }
    
    // Use the chunkEmbed method on the LibraryItem instance
    logger.info('Using LibraryItem.chunkEmbed method...');
    const itemChunks = await libraryItem.chunkEmbed('h1', true); // forceReprocess=true
    logger.info(`LibraryItem.chunkEmbed created ${itemChunks.length} chunks`);
    
    // Get chunk statistics
    const stats = await libraryItem.getChunkStats();
    logger.info(`Chunk statistics:`, stats);
    
    // Search within the item using LibraryItem methods
    logger.info('Searching within LibraryItem...');
    const itemSearchResults = await libraryItem.searchInChunks('learning', 5);
    logger.info(`Found ${itemSearchResults.length} chunks matching 'learning'`);
    
    // Find similar chunks within the item
    const queryVector3 = new Array(vectorDimensions).fill(0).map((_, i) => Math.random());
    const itemSimilarChunks = await libraryItem.findSimilarInChunks(queryVector3, 3, 0.5);
    logger.info(`Found ${itemSimilarChunks.length} similar chunks within the item`);
    
    // Example 11: Chunk management with LibraryItem methods
    logger.info('Example 11: Chunk management with LibraryItem methods');
    
    // Get all chunks using LibraryItem method
    const allItemChunks = await libraryItem.getChunks();
    logger.info(`LibraryItem has ${allItemChunks.length} chunks`);
    
    // Delete all chunks and re-process with different strategy
    await libraryItem.deleteChunks();
    logger.info('Deleted all chunks');
    
    // Re-process with paragraph chunking
    const newParagraphChunks = await libraryItem.chunkEmbed('paragraph', false);
    logger.info(`Re-processed with paragraph strategy: ${newParagraphChunks.length} chunks`);
    
    // Get updated statistics
    const updatedStats = await libraryItem.getChunkStats();
    logger.info('Updated chunk statistics:', updatedStats);

    logger.info('Library chunking example completed successfully!');
    
  } catch (error) {
    logger.error('Error in library chunking example:', error);
    process.exit(1);
  }
}

// Run the example
if (require.main === module) {
  main().catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

export { main as runLibraryChunkingExample };