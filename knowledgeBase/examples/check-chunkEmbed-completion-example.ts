import Library, { S3MongoLibraryStorage } from '../knowledgeImport/liberary';
import { BookMetadata } from '../knowledgeImport/liberary';

/**
 * Example demonstrating how to use the hasCompletedChunkEmbed method
 */
async function checkChunkEmbedCompletionExample() {
  // Initialize library with storage
  const storage = new S3MongoLibraryStorage();
  const library = new Library(storage);

  try {
    // Search for items in the library
    const items = await library.searchItems({});
    console.log(`Found ${items.length} items in the library`);

    // Check chunkEmbed completion status for each item
    for (const item of items) {
      const hasCompleted = await item.hasCompletedChunkEmbed();
      
      console.log(`Item "${item.metadata.title}" (ID: ${item.metadata.id}):`);
      console.log(`  - Has PDF: ${item.hasPdf()}`);
      console.log(`  - Has Markdown: ${!!item.metadata.markdownContent}`);
      console.log(`  - ChunkEmbed Completed: ${hasCompleted}`);
      
      if (!hasCompleted) {
        // Get chunk statistics for more details
        const stats = await item.getChunkStats();
        console.log(`  - Chunk Statistics:`, stats);
        
        // If the item has markdown but no chunks, you might want to process it
        if (item.metadata.markdownContent && stats.totalChunks === 0) {
          console.log(`  - Recommendation: Run chunkEmbed() to process this item`);
        }
        // If the item has chunks but no embeddings, you might want to reprocess
        else if (stats.totalChunks > 0) {
          console.log(`  - Recommendation: Run chunkEmbed() with forceReprocess=true to generate embeddings`);
        }
      }
      
      console.log('---');
    }
  } catch (error) {
    console.error('Error checking chunkEmbed completion:', error);
  }
}

// Example of checking a specific item
async function checkSpecificItem(itemId: string) {
  const storage = new S3MongoLibraryStorage();
  const library = new Library(storage);

  try {
    const item = await library.getItem(itemId);
    if (!item) {
      console.log(`Item with ID ${itemId} not found`);
      return;
    }

    const hasCompleted = await item.hasCompletedChunkEmbed();
    
    console.log(`Item "${item.metadata.title}" (ID: ${item.metadata.id}):`);
    console.log(`  - ChunkEmbed Completed: ${hasCompleted}`);
    
    if (!hasCompleted) {
      console.log('Processing chunks and embeddings...');
      await item.chunkEmbed('h1', true); // Force reprocess with H1 strategy
      
      // Check again
      const completedAfter = await item.hasCompletedChunkEmbed();
      console.log(`  - ChunkEmbed Completed after processing: ${completedAfter}`);
    }
  } catch (error) {
    console.error(`Error processing item ${itemId}:`, error);
  }
}

// Run the example if this file is executed directly
if (require.main === module) {
  checkChunkEmbedCompletionExample()
    .then(() => console.log('Example completed'))
    .catch(console.error);
}

export { checkChunkEmbedCompletionExample, checkSpecificItem };