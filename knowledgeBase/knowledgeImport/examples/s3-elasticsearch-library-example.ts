import Library, { S3ElasticSearchLibraryStorage, BookMetadata } from '../liberary';

/**
 * Example demonstrating how to use the S3ElasticSearchLibraryStorage
 * with the Library class for managing a research library.
 */
async function runS3ElasticSearchLibraryExample() {
  console.log('Starting S3 + Elasticsearch Library Example...');

  // Check if Elasticsearch is available
  let elasticsearchAvailable = false;
  try {
    const { Client } = await import('@elastic/elasticsearch');
    const elasticsearchUrl = process.env.ELASTICSEARCH_URL || 'http://localhost:9200';
    const client = new Client({
      node: elasticsearchUrl,
      auth: {
        apiKey: process.env.ELASTICSEARCH_URL_API_KEY || '',
      },
    });
    await client.ping();
    elasticsearchAvailable = true;
    console.log('✅ Elasticsearch is available');
  } catch (error) {
    console.log('❌ Elasticsearch is not available');
    console.log('Please start Elasticsearch using:');
    console.log('  ./knowledgeBase/knowledgeImport/scripts/check-elasticsearch-simple.sh');
    console.log('Or: cd elastic-start-local && ./start.sh');
    console.log('Or: node knowledgeBase/knowledgeImport/scripts/check-elasticsearch.js');
    console.log('');
    console.log('For development purposes, you can also use the S3MongoLibraryStorage instead.');
    return;
  }

  // Initialize the storage with Elasticsearch
  const elasticsearchUrl = process.env.ELASTICSEARCH_URL || 'http://localhost:9200';
  const storage = new S3ElasticSearchLibraryStorage(elasticsearchUrl);
  
  // Create a library instance with the storage
  const library = new Library(storage);

  try {
    // Example 1: Store an article with metadata
    console.log('\n=== Example 1: Storing an Article ===');
    const articleMetadata: Partial<BookMetadata> = {
      title: 'Machine Learning in Healthcare: A Comprehensive Review',
      authors: [
        { firstName: 'Sarah', lastName: 'Johnson' },
        { firstName: 'Michael', lastName: 'Chen' }
      ],
      abstract: 'This paper provides a comprehensive review of machine learning applications in healthcare, covering diagnosis, treatment, and drug discovery.',
      publicationYear: 2023,
      publisher: 'Journal of Medical AI',
      doi: '10.1234/jmai.2023.001',
      tags: ['machine learning', 'healthcare', 'review', 'AI'],
      fileType: 'article'
    };

    const articleItem = await library.storeArticle(articleMetadata);
    console.log(`Stored article with ID: ${articleItem.metadata.id}`);
    console.log(`Title: ${articleItem.metadata.title}`);

    // Example 2: Create collections
    console.log('\n=== Example 2: Creating Collections ===');
    const aiCollection = await library.createCollection(
      'Artificial Intelligence',
      'Research papers on AI and machine learning'
    );
    console.log(`Created collection: ${aiCollection.name} (ID: ${aiCollection.id})`);

    const healthcareCollection = await library.createCollection(
      'Healthcare',
      'Research papers on healthcare applications'
    );
    console.log(`Created collection: ${healthcareCollection.name} (ID: ${healthcareCollection.id})`);

    // Example 3: Add items to collections
    console.log('\n=== Example 3: Adding Items to Collections ===');
    await articleItem.addToCollection(aiCollection.id!);
    await articleItem.addToCollection(healthcareCollection.id!);
    console.log(`Added article to collections: ${aiCollection.name}, ${healthcareCollection.name}`);

    // Example 4: Store another article
    console.log('\n=== Example 4: Storing Another Article ===');
    const anotherArticleMetadata: Partial<BookMetadata> = {
      title: 'Deep Learning for Medical Image Analysis',
      authors: [
        { firstName: 'Emily', lastName: 'Rodriguez' },
        { firstName: 'David', lastName: 'Kim' }
      ],
      abstract: 'An exploration of deep learning techniques for analyzing medical images, including X-rays, MRIs, and CT scans.',
      publicationYear: 2023,
      publisher: 'Medical Imaging Journal',
      tags: ['deep learning', 'medical imaging', 'computer vision'],
      fileType: 'article'
    };

    const anotherArticleItem = await library.storeArticle(anotherArticleMetadata);
    await anotherArticleItem.addToCollection(aiCollection.id!);
    await anotherArticleItem.addToCollection(healthcareCollection.id!);
    console.log(`Stored another article with ID: ${anotherArticleItem.metadata.id}`);

    // Example 5: Search for items
    console.log('\n=== Example 5: Searching for Items ===');
    
    // Search by query
    const searchResults = await library.searchItems({
      query: 'machine learning'
    });
    console.log(`Found ${searchResults.length} items matching 'machine learning':`);
    searchResults.forEach(item => {
      console.log(`  - ${item.metadata.title} by ${item.metadata.authors.map(a => a.lastName).join(', ')}`);
    });

    // Search by tags
    const tagResults = await library.searchItems({
      tags: ['deep learning']
    });
    console.log(`\nFound ${tagResults.length} items with tag 'deep learning':`);
    tagResults.forEach(item => {
      console.log(`  - ${item.metadata.title}`);
    });

    // Search by collection
    const collectionResults = await library.searchItems({
      collections: [aiCollection.id!]
    });
    console.log(`\nFound ${collectionResults.length} items in collection '${aiCollection.name}':`);
    collectionResults.forEach(item => {
      console.log(`  - ${item.metadata.title}`);
    });

    // Example 6: Generate citations
    console.log('\n=== Example 6: Generating Citations ===');
    const apaCitation = await library.generateCitation(articleItem.metadata.id!, 'APA');
    console.log(`APA Citation: ${apaCitation.citationText}`);

    const mlaCitation = await library.generateCitation(articleItem.metadata.id!, 'MLA');
    console.log(`MLA Citation: ${mlaCitation.citationText}`);

    // Example 7: List all collections
    console.log('\n=== Example 7: Listing All Collections ===');
    const allCollections = await library.getCollections();
    console.log('All collections:');
    allCollections.forEach(collection => {
      console.log(`  - ${collection.name}: ${collection.description || 'No description'}`);
    });

    // Example 8: Update metadata
    console.log('\n=== Example 8: Updating Metadata ===');
    await articleItem.addTag('systematic review');
    await articleItem.updateMetadata({
      notes: 'Important paper for understanding ML applications in healthcare'
    });
    console.log('Updated article metadata with new tag and notes');

    // Verify the update
    const updatedItem = await library.getBook(articleItem.metadata.id!);
    console.log(`Updated tags: ${updatedItem?.metadata.tags.join(', ')}`);
    console.log(`Updated notes: ${updatedItem?.metadata.notes}`);

    console.log('\n=== Example completed successfully! ===');
  } catch (error) {
    console.error('Error running example:', error);
  }
}

// Run the example if this file is executed directly
if (require.main === module) {
  runS3ElasticSearchLibraryExample().catch(console.error);
}

export { runS3ElasticSearchLibraryExample };