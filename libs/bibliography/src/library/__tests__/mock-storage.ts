import { ChunkSearchFilter, ItemChunk } from 'item-vector-storage';
import { ILibraryStorage } from '../storage/storage.js';
import { ItemMetadata, Collection, Citation, ItemArchive } from '../types.js';
import { IdUtils } from 'utils';

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
export class MockLibraryStorage implements ILibraryStorage {
  private metadataStore: Map<string, ItemMetadata> = new Map();
  private pdfStore: Map<string, AbstractPdf> = new Map();
  private collectionStore: Map<string, Collection> = new Map();
  private citationStore: Map<string, Citation[]> = new Map();
  private markdownStore: Map<string, string> = new Map();
  private chunkStore: Map<string, ItemChunk> = new Map();

  async deleteMetadata(id: string): Promise<boolean> {
    return this.metadataStore.delete(id);
  }

  async deleteCollection(id: string): Promise<boolean> {
    return this.collectionStore.delete(id);
  }

  async deleteCitations(itemId: string): Promise<boolean> {
    return this.citationStore.delete(itemId);
  }

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
        // Return the actual PDF buffer if we stored it
        // For testing, we'll return a minimal valid PDF
        return Buffer.from(
          '%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/Resources <<\n/Font <<\n/F1 12 Tf\n>>\n/MediaBox [0 0 612 792]\n/Contents 4 0 R\n>>\nendobj\n4 0 obj\n<<\n/Length 44\n>>\nstream\nBT\n/F1 12 Tf\n72 720 Td\n(Test PDF) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f\n00000 n\n00000 n\n00000 n\ntrailer\n<<\n/Size 5\n0 R\n>>\nstartxref\n%%EOF',
        );
      }
    }
    throw new Error(`PDF with S3 key ${s3Key} not found`);
  }

  async saveMetadata(
    metadata: ItemMetadata,
  ): Promise<ItemMetadata & { id: string }> {
    if (!metadata.id) {
      metadata.id = IdUtils.generateId();
    }

    this.metadataStore.set(metadata.id!, metadata);
    return metadata as ItemMetadata & { id: string };
  }

  async getMetadata(id: string): Promise<ItemMetadata | null> {
    return this.metadataStore.get(id) || null;
  }

  async getMetadataByHash(contentHash: string): Promise<ItemMetadata | null> {
    const metadataList = Array.from(this.metadataStore.values());
    for (const metadata of metadataList) {
      // Check if any archive has this hash
      if (
        metadata.archives.some((archive) => archive.fileHash === contentHash)
      ) {
        return metadata;
      }
    }
    return null;
  }

  async addArchiveToMetadata(id: string, archive: ItemArchive): Promise<void> {
    const metadata = this.metadataStore.get(id);
    if (!metadata) {
      throw new Error(`Item with ID ${id} not found`);
    }

    // Check if archive with same file hash already exists
    if (
      metadata.archives &&
      metadata.archives.some((a) => a.fileHash === archive.fileHash)
    ) {
      throw new Error(
        `Archive with file hash ${archive.fileHash} already exists for item ${id}`,
      );
    }

    // Add the new archive
    if (!metadata.archives) {
      metadata.archives = [];
    }
    metadata.archives.push(archive);
    metadata.dateModified = new Date();

    // Update the metadata
    this.metadataStore.set(id, metadata);
  }

  async updateMetadata(metadata: ItemMetadata): Promise<void> {
    if (metadata.id) {
      this.metadataStore.set(metadata.id, metadata);
    }
  }

  async searchMetadata(filter: any): Promise<ItemMetadata[]> {
    const results: ItemMetadata[] = [];
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
          metadata.archives.some((archive) =>
            archive.fileHash.toLowerCase().includes(query),
          ) || false;

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
        const hasFileType = metadata.archives.some((archive) =>
          filter.fileType.includes(archive.fileType),
        );
        if (!hasFileType) {
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

    this.collectionStore.set(collection.id!, collection);
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

  async deleteMarkdown(itemId: string): Promise<boolean> {
    return this.markdownStore.delete(itemId);
  }

  // Chunk-related methods implementation
  async saveChunk(chunk: ItemChunk): Promise<ItemChunk> {
    if (!chunk.id) {
      chunk.id = IdUtils.generateId();
    }

    this.chunkStore.set(chunk.id, chunk);
    return chunk;
  }

  async getChunk(chunkId: string): Promise<ItemChunk | null> {
    return this.chunkStore.get(chunkId) || null;
  }

  async getChunksByItemId(itemId: string): Promise<ItemChunk[]> {
    const chunks = Array.from(this.chunkStore.values());
    return chunks
      .filter((chunk) => chunk.itemId === itemId)
      .sort((a, b) => a.index - b.index);
  }

  async updateChunk(chunk: ItemChunk): Promise<void> {
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

  async searchChunks(filter: ChunkSearchFilter): Promise<ItemChunk[]> {
    const results: ItemChunk[] = [];
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

      if (
        filter.chunkType &&
        chunk.metadata?.['chunkType'] !== filter.chunkType
      ) {
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
  ): Promise<Array<ItemChunk & { similarity: number }>> {
    const chunks = Array.from(this.chunkStore.values());
    const similarChunks: Array<ItemChunk & { similarity: number }> = [];

    for (const chunk of chunks) {
      if (itemIds && !itemIds.includes(chunk.itemId)) continue;
      if (!chunk.embedding) continue;

      // Simple cosine similarity calculation
      let dotProduct = 0;
      let normA = 0;
      let normB = 0;

      for (let i = 0; i < queryVector.length; i++) {
        const queryValue = queryVector[i] || 0;
        const chunkValue = chunk.embedding?.[i] || 0;
        dotProduct += queryValue * chunkValue;
        normA += queryValue * queryValue;
        normB += chunkValue * chunkValue;
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

  async batchSaveChunks(chunks: ItemChunk[]): Promise<void> {
    for (const chunk of chunks) {
      if (!chunk.id) {
        chunk.id = IdUtils.generateId();
      }
      this.chunkStore.set(chunk.id, chunk);
    }
  }

  // Multi-version support methods
  async getChunksByItemAndGroup(
    itemId: string,
    groupId: string,
  ): Promise<ItemChunk[]> {
    const chunks = Array.from(this.chunkStore.values());
    return chunks
      .filter(
        (chunk) =>
          chunk.itemId === itemId && chunk.denseVectorIndexGroupId === groupId,
      )
      .sort((a, b) => a.index - b.index);
  }

  async deleteChunksByGroup(groupId: string): Promise<number> {
    const chunks = Array.from(this.chunkStore.values());
    const chunksToDelete = chunks.filter(
      (chunk) => chunk.denseVectorIndexGroupId === groupId,
    );

    for (const chunk of chunksToDelete) {
      this.chunkStore.delete(chunk.id);
    }

    return chunksToDelete.length;
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

  getAllMetadata(): ItemMetadata[] {
    return Array.from(this.metadataStore.values());
  }

  getAllChunks(): ItemChunk[] {
    return Array.from(this.chunkStore.values());
  }
}
