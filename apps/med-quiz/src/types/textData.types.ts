export interface EmbeddedTextChunk {
  embedding: number[];
  fileId: string;
  chunkId: string;
  content: string;
  metadata: any;
}
