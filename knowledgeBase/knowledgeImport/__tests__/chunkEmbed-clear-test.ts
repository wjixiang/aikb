import Library, { LibraryItem } from '../library';
import { MockLibraryStorage } from '../MockLibraryStorage';
import { BookMetadata } from '../library';

describe('chunkEmbed clear existing chunks test', () => {
  let library: Library;
  let storage: MockLibraryStorage;
  let testItem: LibraryItem;

  beforeEach(async () => {
    storage = new MockLibraryStorage();
    library = new Library(storage);

    // Create a test item with markdown content
    const metadata: BookMetadata = {
      title: 'Test Document',
      authors: [{ firstName: 'John', lastName: 'Doe' }],
      tags: ['test'],
      collections: [],
      dateAdded: new Date(),
      dateModified: new Date(),
      fileType: 'pdf',
      markdownContent: `# Introduction
This is the introduction section.

# Chapter 1
This is chapter 1 content.

# Chapter 2
This is chapter 2 content.`,
    };

    const savedMetadata = await storage.saveMetadata(metadata);
    testItem = new LibraryItem(savedMetadata, storage);
  });

  it('should clear existing chunks before creating new ones when forceReprocess is true', async () => {
    // First, create some chunks
    const initialChunks = await testItem.chunkEmbed('h1');
    expect(initialChunks.length).toBe(3); // Should have 3 chunks (Introduction, Chapter 1, Chapter 2)

    // Verify chunks exist
    const existingChunks = await testItem.getChunks();
    expect(existingChunks.length).toBe(3);

    // Modify the markdown content to simulate an update
    testItem.metadata.markdownContent = `# New Introduction
This is the updated introduction.

# New Chapter 1
This is the updated chapter 1 content.`;

    // Re-process with forceReprocess=true
    const newChunks = await testItem.chunkEmbed('h1', true);

    // Should have 2 chunks now (New Introduction, New Chapter 1)
    expect(newChunks.length).toBe(2);

    // Verify old chunks were cleared and only new chunks exist
    const finalChunks = await testItem.getChunks();
    expect(finalChunks.length).toBe(2);
    expect(finalChunks[0].title).toBe('New Introduction');
    expect(finalChunks[1].title).toBe('New Chapter 1');
  });

  it('should return existing chunks when forceReprocess is false', async () => {
    // First, create some chunks
    const initialChunks = await testItem.chunkEmbed('h1');
    expect(initialChunks.length).toBe(3);

    // Try to re-process with forceReprocess=false (default)
    const returnedChunks = await testItem.chunkEmbed('h1', false);

    // Should return the same chunks without creating new ones
    expect(returnedChunks.length).toBe(3);
    expect(returnedChunks[0].id).toBe(initialChunks[0].id);
    expect(returnedChunks[1].id).toBe(initialChunks[1].id);
    expect(returnedChunks[2].id).toBe(initialChunks[2].id);

    // Verify no new chunks were created
    const allChunks = await testItem.getChunks();
    expect(allChunks.length).toBe(3);
  });

  it('should clear existing chunks when forceReprocess is true even if no new chunks are created', async () => {
    // First, create some chunks
    const initialChunks = await testItem.chunkEmbed('h1');
    expect(initialChunks.length).toBe(3);

    // Set empty markdown content
    testItem.metadata.markdownContent = '';

    // Re-process with forceReprocess=true
    const newChunks = await testItem.chunkEmbed('h1', true);

    // Should have no chunks
    expect(newChunks.length).toBe(0);

    // Verify all chunks were cleared
    const finalChunks = await testItem.getChunks();
    expect(finalChunks.length).toBe(0);
  });
});
