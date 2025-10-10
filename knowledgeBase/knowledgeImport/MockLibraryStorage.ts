import Library, {
  AbstractLibraryStorage,
  BookMetadata,
  Collection,
  Citation,
  BookChunk,
  ChunkSearchFilter,
  IdUtils,
} from './liberary';

// Define AbstractPdf interface locally since it's not exported
interface AbstractPdf {
  id: string;
  name: string;
  s3Key: string;
  url: string;
  fileSize?: number;
  createDate: Date;
}
/**
 * Mock storage implementation for testing hash functionality without requiring S3 credentials
 */
export class MockLibraryStorage extends AbstractLibraryStorage {
  deleteMetadata(id: string): Promise<boolean> {
    throw new Error('Method not implemented.');
  }
  deleteCollection(id: string): Promise<boolean> {
    throw new Error('Method not implemented.');
  }
  deleteCitations(itemId: string): Promise<boolean> {
    throw new Error('Method not implemented.');
  }
  private metadataStore: Map<string, BookMetadata> = new Map();
  private pdfStore: Map<string, AbstractPdf> = new Map();
  private collectionStore: Map<string, Collection> = new Map();
  private citationStore: Map<string, Citation[]> = new Map();
  private markdownStore: Map<string, string> = new Map();
  private chunkStore: Map<string, BookChunk> = new Map();

  async uploadPdf(pdfData: Buffer, fileName: string): Promise<AbstractPdf> {
    const id = IdUtils.generateId();
    const s3Key = `mock/pdfs/${id}-${fileName}`;

    const pdfInfo: AbstractPdf = {
      id,
      name: fileName,
      s3Key,
      url: `mock-url/${s3Key}`,
      fileSize: pdfData.length,
      createDate: new Date(),
    };

    this.pdfStore.set(id, pdfInfo);
    return pdfInfo;
  }

  async uploadPdfFromPath(pdfPath: string): Promise<AbstractPdf> {
    const fs = await import('fs');
    const path = await import('path');
    const fileName = path.basename(pdfPath);
    const fileBuffer = fs.readFileSync(pdfPath);

    return this.uploadPdf(fileBuffer, fileName);
  }

  async getPdfDownloadUrl(s3Key: string): Promise<string> {
    return `mock-download-url/${s3Key}`;
  }

  async getPdf(s3Key: string): Promise<Buffer> {
    // Find PDF by s3Key
    const pdfs = Array.from(this.pdfStore.values());
    for (const pdf of pdfs) {
      if (pdf.s3Key === s3Key) {
        // Return mock buffer
        return Buffer.from('Mock PDF content');
      }
    }
    throw new Error(`PDF with S3 key ${s3Key} not found`);
  }

  async saveMetadata(
    metadata: BookMetadata,
  ): Promise<BookMetadata & { id: string }> {
    if (!metadata.id) {
      metadata.id = IdUtils.generateId();
    }

    this.metadataStore.set(metadata.id, metadata);
    return metadata as BookMetadata & { id: string };
  }

  async getMetadata(id: string): Promise<BookMetadata | null> {
    return this.metadataStore.get(id) || null;
  }

  async getMetadataByHash(contentHash: string): Promise<BookMetadata | null> {
    const metadataList = Array.from(this.metadataStore.values());
    for (const metadata of metadataList) {
      if (metadata.contentHash === contentHash) {
        return metadata;
      }
    }
    return null;
  }

  async updateMetadata(metadata: BookMetadata): Promise<void> {
    if (metadata.id) {
      this.metadataStore.set(metadata.id, metadata);
    }
  }

  async searchMetadata(filter: any): Promise<BookMetadata[]> {
    const results: BookMetadata[] = [];
    const metadataList = Array.from(this.metadataStore.values());

    for (const metadata of metadataList) {
      let matches = true;

      if (filter.query) {
        const query = filter.query.toLowerCase();
        const titleMatch = metadata.title.toLowerCase().includes(query);
        const abstractMatch =
          metadata.abstract?.toLowerCase().includes(query) || false;
        const notesMatch =
          metadata.notes?.toLowerCase().includes(query) || false;
        const hashMatch =
          metadata.contentHash?.toLowerCase().includes(query) || false;

        if (!titleMatch && !abstractMatch && !notesMatch && !hashMatch) {
          matches = false;
        }
      }

      if (filter.tags && filter.tags.length > 0) {
        const hasTag = filter.tags.some((tag: string) =>
          metadata.tags.includes(tag),
        );
        if (!hasTag) matches = false;
      }

      if (filter.collections && filter.collections.length > 0) {
        const inCollection = filter.collections.some((colId: string) =>
          metadata.collections.includes(colId),
        );
        if (!inCollection) matches = false;
      }

      if (filter.authors && filter.authors.length > 0) {
        const hasAuthor = filter.authors.some((author: string) =>
          metadata.authors.some((a) => a.lastName === author),
        );
        if (!hasAuthor) matches = false;
      }

      if (filter.fileType && filter.fileType.length > 0) {
        if (!filter.fileType.includes(metadata.fileType)) {
          matches = false;
        }
      }

      if (matches) {
        results.push(metadata);
      }
    }

    return results;
  }

  async saveCollection(collection: Collection): Promise<Collection> {
    if (!collection.id) {
      collection.id = IdUtils.generateId();
    }

    this.collectionStore.set(collection.id, collection);
    return collection;
  }

  async getCollections(): Promise<Collection[]> {
    return Array.from(this.collectionStore.values());
  }

  async addItemToCollection(
    itemId: string,
    collectionId: string,
  ): Promise<void> {
    const metadata = this.metadataStore.get(itemId);
    if (metadata && !metadata.collections.includes(collectionId)) {
      metadata.collections.push(collectionId);
      this.metadataStore.set(itemId, metadata);
    }
  }

  async removeItemFromCollection(
    itemId: string,
    collectionId: string,
  ): Promise<void> {
    const metadata = this.metadataStore.get(itemId);
    if (metadata) {
      const index = metadata.collections.indexOf(collectionId);
      if (index > -1) {
        metadata.collections.splice(index, 1);
        this.metadataStore.set(itemId, metadata);
      }
    }
  }

  async saveCitation(citation: Citation): Promise<Citation> {
    const citations = this.citationStore.get(citation.itemId) || [];
    citations.push(citation);
    this.citationStore.set(citation.itemId, citations);
    return citation;
  }

  async getCitations(itemId: string): Promise<Citation[]> {
    return this.citationStore.get(itemId) || [];
  }

  async saveMarkdown(itemId: string, markdownContent: string): Promise<void> {
    this.markdownStore.set(itemId, markdownContent);
  }

  async getMarkdown(itemId: string): Promise<string | null> {
    return this.markdownStore.get(itemId) || null;
  }

  // Chunk-related methods implementation
  async saveChunk(chunk: BookChunk): Promise<BookChunk> {
    if (!chunk.id) {
      chunk.id = IdUtils.generateId();
    }

    this.chunkStore.set(chunk.id, chunk);
    return chunk;
  }

  async getChunk(chunkId: string): Promise<BookChunk | null> {
    return this.chunkStore.get(chunkId) || null;
  }

  async getChunksByItemId(itemId: string): Promise<BookChunk[]> {
    const chunks = Array.from(this.chunkStore.values());
    return chunks
      .filter((chunk) => chunk.itemId === itemId)
      .sort((a, b) => a.index - b.index);
  }

  async updateChunk(chunk: BookChunk): Promise<void> {
    if (chunk.id) {
      chunk.updatedAt = new Date();
      this.chunkStore.set(chunk.id, chunk);
    }
  }

  async deleteChunk(chunkId: string): Promise<boolean> {
    return this.chunkStore.delete(chunkId);
  }

  async deleteChunksByItemId(itemId: string): Promise<number> {
    const chunks = Array.from(this.chunkStore.values());
    const chunksToDelete = chunks.filter((chunk) => chunk.itemId === itemId);

    for (const chunk of chunksToDelete) {
      this.chunkStore.delete(chunk.id);
    }

    return chunksToDelete.length;
  }

  async searchChunks(filter: ChunkSearchFilter): Promise<BookChunk[]> {
    const results: BookChunk[] = [];
    const chunkList = Array.from(this.chunkStore.values());

    for (const chunk of chunkList) {
      let matches = true;

      if (filter.query) {
        const query = filter.query.toLowerCase();
        const titleMatch = chunk.title.toLowerCase().includes(query);
        const contentMatch = chunk.content.toLowerCase().includes(query);

        if (!titleMatch && !contentMatch) {
          matches = false;
        }
      }

      if (filter.itemId && chunk.itemId !== filter.itemId) {
        matches = false;
      }

      if (filter.itemIds && !filter.itemIds.includes(chunk.itemId)) {
        matches = false;
      }

      if (filter.chunkType && chunk.metadata?.chunkType !== filter.chunkType) {
        matches = false;
      }

      if (matches) {
        results.push(chunk);
      }
    }

    return results.slice(0, filter.limit || 100);
  }

  async findSimilarChunks(
    queryVector: number[],
    limit: number = 10,
    threshold: number = 0.7,
    itemIds?: string[],
  ): Promise<Array<BookChunk & { similarity: number }>> {
    const chunks = Array.from(this.chunkStore.values());
    const similarChunks: Array<BookChunk & { similarity: number }> = [];

    for (const chunk of chunks) {
      if (itemIds && !itemIds.includes(chunk.itemId)) continue;
      if (!chunk.embedding) continue;

      // Simple cosine similarity calculation
      let dotProduct = 0;
      let normA = 0;
      let normB = 0;

      for (let i = 0; i < queryVector.length; i++) {
        dotProduct += queryVector[i] * (chunk.embedding[i] || 0);
        normA += queryVector[i] * queryVector[i];
        normB += (chunk.embedding[i] || 0) * (chunk.embedding[i] || 0);
      }

      const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));

      if (similarity >= threshold) {
        similarChunks.push({
          ...chunk,
          similarity,
        });
      }
    }

    // Sort by similarity and limit
    similarChunks.sort((a, b) => b.similarity - a.similarity);
    return similarChunks.slice(0, limit);
  }

  async batchSaveChunks(chunks: BookChunk[]): Promise<void> {
    for (const chunk of chunks) {
      if (!chunk.id) {
        chunk.id = IdUtils.generateId();
      }
      this.chunkStore.set(chunk.id, chunk);
    }
  }

  // Helper methods for testing
  clearAll(): void {
    this.metadataStore.clear();
    this.pdfStore.clear();
    this.collectionStore.clear();
    this.citationStore.clear();
    this.markdownStore.clear();
    this.chunkStore.clear();
  }

  getAllMetadata(): BookMetadata[] {
    return Array.from(this.metadataStore.values());
  }

  getAllChunks(): BookChunk[] {
    return Array.from(this.chunkStore.values());
  }
}
