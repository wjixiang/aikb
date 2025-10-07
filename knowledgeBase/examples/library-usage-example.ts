import Library from '../knowledgeImport/liberary';
import { S3MongoLibraryStorage } from '../knowledgeImport/liberary';
import { BookMetadata, Author, SearchFilter } from '../knowledgeImport/liberary';

async function demonstrateLibraryUsage() {
  console.log('=== Zotero-like Library Management System Demo ===\n');

  // Initialize the library with S3 and MongoDB storage
  const storage = new S3MongoLibraryStorage();
  const library = new Library(storage);

  try {
    // 1. Create collections
    console.log('1. Creating collections...');
    const aiCollection = await library.createCollection('Artificial Intelligence', 'Research papers on AI');
    const mlCollection = await library.createCollection('Machine Learning', 'ML research papers', aiCollection.id);
    const nlpCollection = await library.createCollection('Natural Language Processing', 'NLP research papers', mlCollection.id);
    
    console.log(`Created collection: ${aiCollection.name} (ID: ${aiCollection.id})`);
    console.log(`Created collection: ${mlCollection.name} (ID: ${mlCollection.id})`);
    console.log(`Created collection: ${nlpCollection.name} (ID: ${nlpCollection.id})\n`);

    // 2. Store a PDF book
    console.log('2. Storing a PDF book...');
    const bookMetadata: Partial<BookMetadata> = {
      title: 'Deep Learning',
      authors: [
        { firstName: 'Ian', lastName: 'Goodfellow' },
        { firstName: 'Yoshua', lastName: 'Bengio' },
        { firstName: 'Aaron', lastName: 'Courville' }
      ],
      abstract: 'The Deep Learning textbook is a resource intended to help students and practitioners enter the field of machine learning in general and deep learning in particular.',
      publicationYear: 2016,
      publisher: 'MIT Press',
      isbn: '978-0262035613',
      tags: ['deep learning', 'neural networks', 'machine learning', 'AI'],
      collections: [mlCollection.id!, aiCollection.id!],
      language: 'English'
    };

    // Note: This would require an actual PDF file to work
    // const book = await library.storePdf('./path/to/deep-learning.pdf', bookMetadata);
    // console.log(`Stored book: ${book.metadata.title} (ID: ${book.metadata.id})\n`);

    // For demo purposes, we'll store an article instead
    console.log('Storing an article instead (since we don\'t have a PDF file)...');
    const article = await library.storeArticle(bookMetadata);
    console.log(`Stored article: ${article.metadata.title} (ID: ${article.metadata.id})\n`);

    // 3. Store another article
    console.log('3. Storing another article...');
    const articleMetadata: Partial<BookMetadata> = {
      title: 'Attention Is All You Need',
      authors: [
        { firstName: 'Ashish', lastName: 'Vaswani' },
        { firstName: 'Noam', lastName: 'Shazeer' },
        { firstName: 'Niki', lastName: 'Parmar' }
      ],
      abstract: 'The dominant sequence transduction models are based on complex recurrent or convolutional neural networks. We propose a new simple network architecture, the Transformer, based solely on attention mechanisms.',
      publicationYear: 2017,
      publisher: 'NeurIPS',
      doi: '10.48550/arXiv.1706.03762',
      tags: ['transformer', 'attention mechanism', 'NLP', 'deep learning'],
      collections: [nlpCollection.id!, mlCollection.id!],
      language: 'English'
    };

    const transformerArticle = await library.storeArticle(articleMetadata);
    console.log(`Stored article: ${transformerArticle.metadata.title} (ID: ${transformerArticle.metadata.id})\n`);

    // 4. Add tags to an article
    console.log('4. Adding tags to an article...');
    await transformerArticle.addTag('BERT');
    await transformerArticle.addTag('GPT');
    console.log(`Added tags to ${transformerArticle.metadata.title}: ${transformerArticle.metadata.tags.join(', ')}\n`);

    // 5. Search for items
    console.log('5. Searching for items...');
    const searchFilter: SearchFilter = {
      query: 'learning',
      tags: ['deep learning']
    };
    
    const searchResults = await library.searchItems(searchFilter);
    console.log(`Found ${searchResults.length} items matching the search criteria:`);
    searchResults.forEach(item => {
      console.log(`- ${item.metadata.title} by ${item.metadata.authors.map(a => a.lastName).join(', ')}`);
    });
    console.log('');

    // 6. Get all collections
    console.log('6. Getting all collections...');
    const collections = await library.getCollections();
    console.log('All collections:');
    collections.forEach(collection => {
      console.log(`- ${collection.name}: ${collection.description || 'No description'}`);
    });
    console.log('');

    // 7. Generate citations
    console.log('7. Generating citations...');
    const apaCitation = await library.generateCitation(transformerArticle.metadata.id!, 'APA');
    const mlaCitation = await library.generateCitation(transformerArticle.metadata.id!, 'MLA');
    const chicagoCitation = await library.generateCitation(transformerArticle.metadata.id!, 'Chicago');
    
    console.log(`APA Citation: ${apaCitation.citationText}`);
    console.log(`MLA Citation: ${mlaCitation.citationText}`);
    console.log(`Chicago Citation: ${chicagoCitation.citationText}\n`);

    // 8. Get citations for an item
    console.log('8. Getting all citations for an item...');
    const citations = await storage.getCitations(transformerArticle.metadata.id!);
    console.log(`Found ${citations.length} citations for ${transformerArticle.metadata.title}:`);
    citations.forEach(citation => {
      console.log(`- ${citation.citationStyle}: ${citation.citationText}`);
    });
    console.log('');

    console.log('=== Demo completed successfully! ===');

  } catch (error) {
    console.error('Error during demo:', error);
  }
}

// Run the demo
if (require.main === module) {
  demonstrateLibraryUsage().catch(console.error);
}

export default demonstrateLibraryUsage;