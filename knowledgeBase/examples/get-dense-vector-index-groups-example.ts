/**
 * Example demonstrating how to use the getDenseVectorIndexGroupId method
 * This example shows how to retrieve all available embedding versions for a LibraryItem
 */

import Library from '../knowledgeImport/library';
import { S3ElasticSearchLibraryStorage } from '../knowledgeImport/library';

async function demonstrateGetDenseVectorIndexGroups() {
  console.log('=== Example: Getting Dense Vector Index Groups ===\n');

  // Initialize the library with storage
  const storage = new S3ElasticSearchLibraryStorage();
  const library = new Library(storage);

  try {
    // Get a library item (assuming you have one with ID)
    const itemId = 'your-item-id'; // Replace with an actual item ID
    const item = await library.getItem(itemId);
    
    if (!item) {
      console.log(`No item found with ID: ${itemId}`);
      return;
    }

    console.log(`Retrieved item: ${item.metadata.title}\n`);

    // Get all available dense vector index groups for this item
    const denseVectorIndexGroups = await item.getDenseVectorIndexGroupId();
    
    console.log(`Available Dense Vector Index Groups for item "${item.metadata.title}":`);
    
    if (denseVectorIndexGroups.length === 0) {
      console.log('  No dense vector index groups found. This item may not have any chunks with embeddings.');
    } else {
      denseVectorIndexGroups.forEach((group, index) => {
        console.log(`  ${index + 1}. ${group}`);
      });
      
      console.log('\nYou can use these group identifiers to:');
      console.log('- Search within specific embedding versions');
      console.log('- Compare results across different embedding strategies');
      console.log('- Select the most appropriate version for your use case');
      
      // Example of using one of the groups for search
      if (denseVectorIndexGroups.length > 0) {
        const selectedGroup = denseVectorIndexGroups[0];
        console.log(`\nExample: Getting chunks from group "${selectedGroup}"`);
        const chunksFromGroup = await item.getChunks({
          denseVectorIndexGroupId: selectedGroup
        });
        console.log(`Found ${chunksFromGroup.length} chunks in group "${selectedGroup}"`);
      }
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

// Example of checking multiple items
async function checkMultipleItems() {
  console.log('\n=== Example: Checking Multiple Items ===\n');
  
  const storage = new S3ElasticSearchLibraryStorage();
  const library = new Library(storage);
  
  try {
    // Search for items (you can customize the filter)
    const items = await library.searchItems({
      query: 'your-search-query' // Replace with your search query
    });
    
    console.log(`Found ${items.length} items\n`);
    
    for (const item of items) {
      const groups = await item.getDenseVectorIndexGroupId();
      console.log(`Item: "${item.metadata.title}"`);
      console.log(`  ID: ${item.getItemId()}`);
      console.log(`  Available groups: ${groups.length > 0 ? groups.join(', ') : 'None'}`);
      console.log('');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

// Example of using groups for semantic search
async function semanticSearchWithGroups() {
  console.log('\n=== Example: Semantic Search with Specific Groups ===\n');
  
  const storage = new S3ElasticSearchLibraryStorage();
  const library = new Library(storage);
  
  try {
    const itemId = 'your-item-id'; // Replace with an actual item ID
    const item = await library.getItem(itemId);
    
    if (!item) {
      console.log(`No item found with ID: ${itemId}`);
      return;
    }
    
    // Get available groups
    const groups = await item.getDenseVectorIndexGroupId();
    
    if (groups.length === 0) {
      console.log('No groups available for semantic search');
      return;
    }
    
    // Perform semantic search with each available group
    const query = 'your search query here'; // Replace with your search query
    const queryVector = [0.1, 0.2, 0.3]; // Replace with actual query vector embedding
    
    console.log(`Searching for: "${query}"\n`);
    
    for (const group of groups) {
      console.log(`Searching in group: ${group}`);
      
      const results = await item.findSimilarInChunks(queryVector, 5, 0.7, {
        denseVectorIndexGroupId: group
      });
      
      console.log(`  Found ${results.length} similar chunks`);
      
      results.forEach((result, index) => {
        console.log(`    ${index + 1}. ${result.title} (similarity: ${result.similarity.toFixed(2)})`);
      });
      
      console.log('');
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

// Export the example functions
export {
  demonstrateGetDenseVectorIndexGroups,
  checkMultipleItems,
  semanticSearchWithGroups
};

// Run the examples if this file is executed directly
if (require.main === module) {
  (async () => {
    await demonstrateGetDenseVectorIndexGroups();
    await checkMultipleItems();
    await semanticSearchWithGroups();
  })();
}