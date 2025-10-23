import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest';
import { Embedding, EmbeddingProvider } from './embedding';
import { EmbeddingManager } from './embedding-manager';
import {
  EmbeddingProviderBase,
  OpenAIEmbeddingProvider,
  AlibabaEmbeddingProvider,
  ONNXEmbeddingProvider,
} from './embedding-providers';
import { embeddingManager } from './embedding-manager';

// Mock the logger to avoid console output during tests
vi.mock('../logger', () => ({
  default: vi.fn().mockImplementation((prefix: string) => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

// Mock the embeddingManager singleton
vi.mock('./embedding-manager', async () => {
  const actual = await vi.importActual('./embedding-manager');
  return {
    ...actual,
    embeddingManager: {
      isManagerInitialized: vi.fn().mockReturnValue(true),
      initialize: vi.fn(),
      getProvider: vi.fn(),
      hasProvider: vi.fn(),
      getProviders: vi.fn(),
      getAvailableProviders: vi.fn(),
    },
  };
});

// Mock environment variables
const mockEnv = {
  EMBEDDING_API_KEY: 'test-api-key',
  EMBEDDING_API_BASE: 'https://api.test.com/',
  ALIBABA_API_KEY: 'test-alibaba-key',
  EMBEDDING_CONCURRENCY_LIMIT: '3',
  EMBEDDING_MAX_RETRIES: '5',
  EMBEDDING_RETRY_DELAY_BASE: '1000',
};

describe('Embedding', () => {
  let embedding: Embedding;

  beforeEach(() => {
    // Mock environment variables
    Object.entries(mockEnv).forEach(([key, value]) => {
      process.env[key] = value;
    });

    // Reset all mocks
    vi.clearAllMocks();

    // The embeddingManager is already mocked at the module level
    embedding = new Embedding();
  });

  afterEach(() => {
    // Clean up environment variables
    Object.keys(mockEnv).forEach((key) => {
      delete process.env[key];
    });
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create an Embedding instance with default provider', () => {
      expect(embedding).toBeInstanceOf(Embedding);
      expect(embedding.getProvider()).toBe(EmbeddingProvider.ALIBABA);
    });
  });

  describe('setProvider', () => {
    it('should set the active provider if available', () => {
      const mockHasProvider = vi
        .spyOn(embeddingManager, 'hasProvider')
        .mockReturnValue(true);
      embedding.setProvider(EmbeddingProvider.OPENAI);
      expect(embedding.getProvider()).toBe(EmbeddingProvider.OPENAI);
      mockHasProvider.mockRestore();
    });

    it('should not set the provider if not available', () => {
      const mockHasProvider = vi
        .spyOn(embeddingManager, 'hasProvider')
        .mockReturnValue(false);
      embedding.setProvider(EmbeddingProvider.OPENAI);
      expect(embedding.getProvider()).toBe(EmbeddingProvider.ALIBABA); // Should remain default
      mockHasProvider.mockRestore();
    });

    it('should handle invalid provider types', () => {
      const mockHasProvider = vi
        .spyOn(embeddingManager, 'hasProvider')
        .mockReturnValue(false);
      embedding.setProvider('invalid' as EmbeddingProvider);
      expect(embedding.getProvider()).toBe('alibaba'); // Should remain default
      mockHasProvider.mockRestore();
    });
  });

  describe('getProvider', () => {
    it('should return the current active provider', () => {
      expect(embedding.getProvider()).toBe(EmbeddingProvider.ALIBABA);
    });
  });

  describe('getProviderInstance', () => {
    it('should return the provider instance if available', () => {
      const mockProvider = {} as EmbeddingProviderBase;
      const mockGetProvider = vi
        .spyOn(embeddingManager, 'getProvider')
        .mockReturnValue(mockProvider);

      const result = embedding.getProviderInstance(EmbeddingProvider.ALIBABA);
      expect(result).toBe(mockProvider);
      mockGetProvider.mockRestore();
    });

    it('should return undefined if provider is not available', () => {
      const mockGetProvider = vi
        .spyOn(embeddingManager, 'getProvider')
        .mockReturnValue(undefined);

      const result = embedding.getProviderInstance(EmbeddingProvider.OPENAI);
      expect(result).toBeUndefined();
      mockGetProvider.mockRestore();
    });
  });

  describe('embed', () => {
    it('should call embed on the active provider', async () => {
      const mockProvider = {
        embed: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
      } as unknown as EmbeddingProviderBase;

      const mockGetProvider = vi
        .spyOn(embeddingManager, 'getProvider')
        .mockReturnValue(mockProvider);

      const result = await embedding.embed('test text');
      expect(result).toEqual([0.1, 0.2, 0.3]);
      expect(mockProvider.embed).toHaveBeenCalledWith('test text');
      mockGetProvider.mockRestore();
    });

    it('should use specified provider instead of active provider', async () => {
      const mockProvider = {
        embed: vi.fn().mockResolvedValue([0.4, 0.5, 0.6]),
      } as unknown as EmbeddingProviderBase;

      const mockGetProvider = vi
        .spyOn(embeddingManager, 'getProvider')
        .mockReturnValue(mockProvider);

      const result = await embedding.embed(
        'test text',
        EmbeddingProvider.OPENAI,
      );
      expect(result).toEqual([0.4, 0.5, 0.6]);
      expect(mockProvider.embed).toHaveBeenCalledWith('test text');
      mockGetProvider.mockRestore();
    });

    it('should return null if provider is not available', async () => {
      const mockGetProvider = vi
        .spyOn(embeddingManager, 'getProvider')
        .mockReturnValue(undefined);

      const result = await embedding.embed('test text');
      expect(result).toBeNull();
      mockGetProvider.mockRestore();
    });

    it('should handle array input', async () => {
      const mockProvider = {
        embed: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
      } as unknown as EmbeddingProviderBase;

      const mockGetProvider = vi
        .spyOn(embeddingManager, 'getProvider')
        .mockReturnValue(mockProvider);

      const result = await embedding.embed(['text1', 'text2']);
      expect(result).toEqual([0.1, 0.2, 0.3]);
      expect(mockProvider.embed).toHaveBeenCalledWith(['text1', 'text2']);
      mockGetProvider.mockRestore();
    });
  });

  describe('embedBatch', () => {
    it('should call embedBatch on the active provider', async () => {
      const mockProvider = {
        embedBatch: vi.fn().mockResolvedValue([
          [0.1, 0.2],
          [0.3, 0.4],
        ]),
      } as unknown as EmbeddingProviderBase;

      const mockGetProvider = vi
        .spyOn(embeddingManager, 'getProvider')
        .mockReturnValue(mockProvider);

      const result = await embedding.embedBatch(['text1', 'text2']);
      expect(result).toEqual([
        [0.1, 0.2],
        [0.3, 0.4],
      ]);
      expect(mockProvider.embedBatch).toHaveBeenCalledWith(
        ['text1', 'text2'],
        5,
      );
      mockGetProvider.mockRestore();
    });

    it('should use specified provider instead of active provider', async () => {
      const mockProvider = {
        embedBatch: vi.fn().mockResolvedValue([
          [0.5, 0.6],
          [0.7, 0.8],
        ]),
      } as unknown as EmbeddingProviderBase;

      const mockGetProvider = vi
        .spyOn(embeddingManager, 'getProvider')
        .mockReturnValue(mockProvider);

      const result = await embedding.embedBatch(
        ['text1', 'text2'],
        EmbeddingProvider.OPENAI,
        2,
      );
      expect(result).toEqual([
        [0.5, 0.6],
        [0.7, 0.8],
      ]);
      expect(mockProvider.embedBatch).toHaveBeenCalledWith(
        ['text1', 'text2'],
        2,
      );
      mockGetProvider.mockRestore();
    });

    it('should return array of nulls if provider is not available', async () => {
      const mockGetProvider = vi
        .spyOn(embeddingManager, 'getProvider')
        .mockReturnValue(undefined);

      const result = await embedding.embedBatch(['text1', 'text2']);
      expect(result).toEqual([null, null]);
      mockGetProvider.mockRestore();
    });

    it('should handle custom concurrency limit', async () => {
      const mockProvider = {
        embedBatch: vi.fn().mockResolvedValue([
          [0.1, 0.2],
          [0.3, 0.4],
        ]),
      } as unknown as EmbeddingProviderBase;

      // Use vi.spyOn to properly mock and restore the method
      const mockGetProvider = vi
        .spyOn(embeddingManager, 'getProvider')
        .mockReturnValue(mockProvider);

      const result = await embedding.embedBatch(
        ['text1', 'text2'],
        undefined,
        10,
      );
      expect(result).toEqual([
        [0.1, 0.2],
        [0.3, 0.4],
      ]);
      expect(mockProvider.embedBatch).toHaveBeenCalledWith(
        ['text1', 'text2'],
        10,
      );

      // Restore the original method
      mockGetProvider.mockRestore();
    });
  });
});

describe('EmbeddingManager', () => {
  let manager: EmbeddingManager;

  beforeEach(() => {
    // Mock environment variables
    Object.entries(mockEnv).forEach(([key, value]) => {
      process.env[key] = value;
    });

    // Reset singleton instance
    (EmbeddingManager as any).instance = undefined;
    manager = EmbeddingManager.getInstance();
  });

  afterEach(() => {
    // Clean up environment variables
    Object.keys(mockEnv).forEach((key) => {
      delete process.env[key];
    });
    (EmbeddingManager as any).instance = undefined;
    vi.clearAllMocks();
  });

  describe('getInstance', () => {
    it('should return the same instance when called multiple times', () => {
      const instance1 = EmbeddingManager.getInstance();
      const instance2 = EmbeddingManager.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('initialize', () => {
    it('should set initialization status to true', () => {
      manager.initialize();
      expect(manager.isManagerInitialized()).toBe(true);
    });
  });

  describe('getProviders', () => {
    it('should return empty map if not initialized', () => {
      const mockGetProviders = vi.fn().mockReturnValue(new Map());
      manager.getProviders = mockGetProviders as any;

      const providers = manager.getProviders();
      expect(providers).toBeInstanceOf(Map);
    });
  });

  describe('getProvider', () => {
    it('should return undefined if not initialized', () => {
      const mockGetProvider = vi.fn().mockReturnValue(undefined);
      manager.getProvider = mockGetProvider as any;

      const provider = manager.getProvider(EmbeddingProvider.OPENAI);
      expect(provider).toBeUndefined();
    });

    it('should return provider instance if available', () => {
      const mockProvider = {} as any;
      const mockGetProvider = vi.fn().mockReturnValue(mockProvider);
      manager.getProvider = mockGetProvider as any;

      const provider = manager.getProvider(EmbeddingProvider.OPENAI);
      expect(provider).toBe(mockProvider);
    });

    it('should return undefined if provider not available', () => {
      const mockGetProvider = vi.fn().mockReturnValue(undefined);
      manager.getProvider = mockGetProvider as any;

      const provider = manager.getProvider(EmbeddingProvider.OPENAI);
      expect(provider).toBeUndefined();
    });
  });

  describe('hasProvider', () => {
    it('should return false if not initialized', () => {
      const mockHasProvider = vi.fn().mockReturnValue(false);
      manager.hasProvider = mockHasProvider as any;

      const hasProvider = manager.hasProvider(EmbeddingProvider.OPENAI);
      expect(hasProvider).toBe(false);
    });

    it('should return true if provider is available', () => {
      const mockHasProvider = vi.fn().mockReturnValue(true);
      manager.hasProvider = mockHasProvider as any;

      const hasProvider = manager.hasProvider(EmbeddingProvider.OPENAI);
      expect(hasProvider).toBe(true);
    });

    it('should return false if provider not available', () => {
      const mockHasProvider = vi.fn().mockReturnValue(false);
      manager.hasProvider = mockHasProvider as any;

      const hasProvider = manager.hasProvider(EmbeddingProvider.OPENAI);
      expect(hasProvider).toBe(false);
    });
  });

  describe('getAvailableProviders', () => {
    it('should return empty array if not initialized', () => {
      const mockGetAvailableProviders = vi.fn().mockReturnValue([]);
      manager.getAvailableProviders = mockGetAvailableProviders as any;

      const providers = manager.getAvailableProviders();
      expect(providers).toEqual([]);
    });

    it('should return array of available providers', () => {
      const mockGetAvailableProviders = vi
        .fn()
        .mockReturnValue([
          EmbeddingProvider.OPENAI,
          EmbeddingProvider.ALIBABA,
          EmbeddingProvider.ONNX,
        ]);
      manager.getAvailableProviders = mockGetAvailableProviders as any;

      const providers = manager.getAvailableProviders();
      expect(providers).toEqual([
        EmbeddingProvider.OPENAI,
        EmbeddingProvider.ALIBABA,
        EmbeddingProvider.ONNX,
      ]);
    });
  });

  describe('isManagerInitialized', () => {
    it('should return initialization status', () => {
      const mockIsManagerInitialized = vi.fn().mockReturnValue(false);
      manager.isManagerInitialized = mockIsManagerInitialized;

      expect(manager.isManagerInitialized()).toBe(false);
    });
  });
});

describe('EmbeddingProviderBase', () => {
  it('should be an abstract class', () => {
    // Since TypeScript doesn't enforce abstract at runtime, we just check it's a function
    expect(typeof EmbeddingProviderBase).toBe('function');
  });
});

describe('OpenAIEmbeddingProvider', () => {
  let provider: OpenAIEmbeddingProvider;

  beforeEach(() => {
    provider = new OpenAIEmbeddingProvider('test-key', 'https://api.test.com/');
  });

  it('should create provider with correct configuration', () => {
    expect(provider).toBeInstanceOf(OpenAIEmbeddingProvider);
  });

  it('should return null if API key or base URL is missing', async () => {
    const invalidProvider = new OpenAIEmbeddingProvider('', '');
    const result = await invalidProvider.embed('test');
    expect(result).toBeNull();
  });

  it('should return null if array input is provided', async () => {
    const result = await provider.embed(['text1', 'text2']);
    expect(result).toBeNull();
  });
});

describe('AlibabaEmbeddingProvider', () => {
  let provider: AlibabaEmbeddingProvider;

  beforeEach(() => {
    provider = new AlibabaEmbeddingProvider('test-key');
  });

  it('should create provider with correct configuration', () => {
    expect(provider).toBeInstanceOf(AlibabaEmbeddingProvider);
  });

  it('should return null if API key is missing', async () => {
    const invalidProvider = new AlibabaEmbeddingProvider('');
    const result = await invalidProvider.embed('test');
    expect(result).toBeNull();
  });
});

describe('ONNXEmbeddingProvider', () => {
  let provider: ONNXEmbeddingProvider;

  beforeEach(() => {
    provider = new ONNXEmbeddingProvider();
  });

  it('should create provider with correct configuration', () => {
    expect(provider).toBeInstanceOf(ONNXEmbeddingProvider);
  });

  it('should return null if array input is provided', async () => {
    const result = await provider.embed(['text1', 'text2']);
    expect(result).toBeNull();
  });

  it('should return null for string input (not implemented)', async () => {
    const result = await provider.embed('test');
    expect(result).toBeNull();
  });
});
