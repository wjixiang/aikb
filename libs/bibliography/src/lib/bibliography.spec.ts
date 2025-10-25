import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import  Library  from '../library/library.js';
import { MockLibraryStorage } from '../library/mock-storage.js';
import { BookMetadata } from '../library/types.js';

describe('Bibliography Library', () => {
  let library: Library;
  let mockStorage: MockLibraryStorage;

  beforeEach(() => {
    mockStorage = new MockLibraryStorage();
    library = new Library(mockStorage);
  });

  afterEach(() => {
    mockStorage.clearAll();
  });

  it('should create library instance', () => {
    expect(library).toBeDefined();
    expect(mockStorage).toBeDefined();
  });

  it('should store and retrieve PDF metadata', async () => {
    const testMetadata: Partial<BookMetadata> = {
      title: 'Test Book',
      authors: [{ firstName: 'John', lastName: 'Doe' }],
      abstract: 'Test abstract',
      tags: ['test', 'bibliography'],
      collections: [],
    };

    // Create a mock PDF buffer
    const pdfBuffer = Buffer.from('test pdf content');
    const fileName = 'test.pdf';

    const libraryItem = await library.storePdf(pdfBuffer, fileName, testMetadata);

    expect(libraryItem).toBeDefined();
    expect(libraryItem.metadata.title).toBe('Test Book');
    expect(libraryItem.metadata.authors).toEqual([{ firstName: 'John', lastName: 'Doe' }]);
    expect(libraryItem.metadata.abstract).toBe('Test abstract');
    expect(libraryItem.metadata.tags).toEqual(['test', 'bibliography']);
  });

  it('should search for items', async () => {
    // First add some test items
    await library.storePdf(
      Buffer.from('test content 1'),
      'test1.pdf',
      { title: 'Test Book 1', authors: [{ firstName: 'Jane', lastName: 'Smith' }] },
    );

    await library.storePdf(
      Buffer.from('test content 2'),
      'test2.pdf',
      { title: 'Test Book 2', authors: [{ firstName: 'Bob', lastName: 'Johnson' }] },
    );

    const searchResults = await library.searchItems({ query: 'Test' });

    expect(searchResults).toHaveLength(2);
    expect(searchResults.some(item => item.metadata.title.includes('1'))).toBe(true);
    expect(searchResults.some(item => item.metadata.title.includes('2'))).toBe(true);
  });

  it('should create and manage collections', async () => {
    const collection = await library.createCollection('Test Collection', 'A test collection');

    expect(collection).toBeDefined();
    expect(collection.name).toBe('Test Collection');
    expect(collection.description).toBe('A test collection');

    // Add item to collection
    const libraryItem = await library.storePdf(
      Buffer.from('test content'),
      'test.pdf',
      { title: 'Test Book', authors: [{ firstName: 'John', lastName: 'Doe' }] },
    );

    await library.addItemToCollection(libraryItem.getItemId(), collection.id!);

    // Verify item is in collection
    const updatedItem = await library.getItem(libraryItem.getItemId());
    expect(updatedItem?.metadata.collections).toContain(collection.id!);
  });

  it('should generate citations', async () => {
    const libraryItem = await library.storePdf(
      Buffer.from('test content'),
      'test.pdf',
      {
        title: 'Test Book',
        authors: [{ firstName: 'John', lastName: 'Doe' }],
        publicationYear: 2023,
        publisher: 'Test Publisher',
      },
    );

    const citation = await library.generateCitation(libraryItem.getItemId(), 'APA');

    expect(citation).toBeDefined();
    expect(citation.citationStyle).toBe('APA');
    expect(citation.itemId).toBe(libraryItem.getItemId());
    expect(citation.citationText).toContain('Doe, J. (2023). Test Book. Test Publisher.');
  });

  it('should delete items', async () => {
    const libraryItem = await library.storePdf(
      Buffer.from('test content'),
      'test.pdf',
      { title: 'Test Book', authors: [{ firstName: 'John', lastName: 'Doe' }] },
    );

    const deleted = await library.deleteItem(libraryItem.getItemId());

    expect(deleted).toBe(true);
  });
});
