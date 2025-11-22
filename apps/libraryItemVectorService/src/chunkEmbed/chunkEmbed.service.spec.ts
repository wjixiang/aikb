import { Test, TestingModule } from '@nestjs/testing';
import { ChunkEmbedService } from './chunkEmbed.service';
import { BibliographyGrpcClient } from 'proto-ts';
import { vi } from 'vitest';

// Mock all dependencies before importing the service
vi.mock('proto-ts', () => ({
  BibliographyGrpcClient: vi.fn(),
}));

vi.mock('item-vector-storage', () => ({
  ElasticsearchItemVectorStorage: vi.fn(),
}));

vi.mock('embedding', () => ({
  embeddingService: {
    setProvider: vi.fn(),
    embedBatch: vi.fn(),
  },
  EmbeddingProvider: {
    OPENAI: 'openai',
    ALIBABA: 'alibaba',
    ONNX: 'onnx',
  },
  AlibabaModel: {
    TEXT_EMBEDDING_V3: 'text-embedding-v3',
    TEXT_EMBEDDING_V4: 'text-embedding-v4',
  },
}));

vi.mock('utils', () => ({
  IdUtils: {
    generateChunkId: vi.fn(),
  },
}));

vi.mock('chunking', () => ({
  chunkTextWithEnum: vi.fn(),
  ChunkingStrategy: {
    PARAGRAPH: 'paragraph',
    H1: 'h1',
  },
}));

vi.mock('library-shared', () => ({
  ChunkEmbedItemDto: vi.fn(),
}));

describe('ChunkEmbedService', () => {
  let service: ChunkEmbedService;
  let mockBibliographyGrpcClient: any;

  beforeEach(async () => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create mock instance
    mockBibliographyGrpcClient = {
      getLibraryItem: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChunkEmbedService,
        {
          provide: BibliographyGrpcClient,
          useValue: mockBibliographyGrpcClient,
        },
      ],
    }).compile();

    service = module.get<ChunkEmbedService>(ChunkEmbedService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should have a logger', () => {
    expect(service['logger']).toBeDefined();
  });

  it('should have itemVectorStorage', () => {
    expect(service['itemVectorStorage']).toBeDefined();
  });

  it('should have bibliographyGrpcClient injected', () => {
    expect(service['bibliographyGrpcClient']).toBeDefined();
    expect(service['bibliographyGrpcClient']).toBe(mockBibliographyGrpcClient);
  });
});
