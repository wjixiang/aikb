import { Test, TestingModule } from '@nestjs/testing';
import { EmbeddingController } from './embedding.controller';
import { EmbeddingService } from '../services/embedding.service';
import { EmbeddingProvider } from 'embedding';

describe('EmbeddingController', () => {
  let controller: EmbeddingController;
  let embeddingService: EmbeddingService;

  const mockEmbeddingService = {
    embed: jest.fn(),
    embedBatch: jest.fn(),
    setProvider: jest.fn(),
    getProvider: jest.fn(),
    getProviderInfo: jest.fn(),
    healthCheck: jest.fn(),
    getStats: jest.fn(),
    resetStats: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EmbeddingController],
      providers: [
        {
          provide: EmbeddingService,
          useValue: mockEmbeddingService,
        },
      ],
    }).compile();

    controller = module.get<EmbeddingController>(EmbeddingController);
    embeddingService = module.get<EmbeddingService>(EmbeddingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('embed', () => {
    it('should generate embedding successfully', async () => {
      const request = {
        text: 'test text',
        provider: EmbeddingProvider.ALIBABA,
      };

      const expectedResult = {
        success: true,
        embedding: [0.1, 0.2, 0.3],
        provider: EmbeddingProvider.ALIBABA,
      };

      mockEmbeddingService.embed.mockResolvedValue(expectedResult);

      const result = await controller.embed(request);

      expect(embeddingService.embed).toHaveBeenCalledWith(request);
      expect(result).toEqual(expectedResult);
    });

    it('should handle embedding failure', async () => {
      const request = {
        text: 'test text',
        provider: EmbeddingProvider.ALIBABA,
      };

      const expectedResult = {
        success: false,
        error: 'Failed to generate embedding',
        provider: EmbeddingProvider.ALIBABA,
      };

      mockEmbeddingService.embed.mockResolvedValue(expectedResult);

      const result = await controller.embed(request);

      expect(embeddingService.embed).toHaveBeenCalledWith(request);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('embedBatch', () => {
    it('should generate batch embeddings successfully', async () => {
      const request = {
        texts: ['text1', 'text2', 'text3'],
        provider: EmbeddingProvider.ALIBABA,
        concurrencyLimit: 2,
      };

      const expectedResult = {
        success: true,
        embeddings: [
          [0.1, 0.2],
          [0.3, 0.4],
          [0.5, 0.6],
        ],
        provider: EmbeddingProvider.ALIBABA,
        totalCount: 3,
        successCount: 3,
        failureCount: 0,
      };

      mockEmbeddingService.embedBatch.mockResolvedValue(expectedResult);

      const result = await controller.embedBatch(request);

      expect(embeddingService.embedBatch).toHaveBeenCalledWith(request);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('getProviders', () => {
    it('should return provider information', () => {
      const expectedResult = [
        {
          provider: EmbeddingProvider.ALIBABA,
          available: true,
          initialized: true,
        },
        {
          provider: EmbeddingProvider.OPENAI,
          available: false,
          initialized: false,
        },
        {
          provider: EmbeddingProvider.ONNX,
          available: true,
          initialized: true,
        },
      ];

      mockEmbeddingService.getProviderInfo.mockReturnValue(expectedResult);

      const result = controller.getProviders();

      expect(embeddingService.getProviderInfo).toHaveBeenCalled();
      expect(result).toEqual(expectedResult);
    });
  });

  describe('getCurrentProvider', () => {
    it('should return current provider', () => {
      const expectedProvider = EmbeddingProvider.ALIBABA;
      mockEmbeddingService.getProvider.mockReturnValue(expectedProvider);

      const result = controller.getCurrentProvider();

      expect(embeddingService.getProvider).toHaveBeenCalled();
      expect(result).toEqual({ provider: expectedProvider });
    });
  });

  describe('setProvider', () => {
    it('should set provider successfully', () => {
      const provider = EmbeddingProvider.OPENAI;
      mockEmbeddingService.setProvider.mockReturnValue(true);

      const result = controller.setProvider(provider);

      expect(embeddingService.setProvider).toHaveBeenCalledWith(provider);
      expect(result).toEqual({
        success: true,
        message: `Provider set to ${provider} successfully`,
      });
    });

    it('should handle provider setting failure', () => {
      const provider = EmbeddingProvider.OPENAI;
      mockEmbeddingService.setProvider.mockReturnValue(false);

      const result = controller.setProvider(provider);

      expect(embeddingService.setProvider).toHaveBeenCalledWith(provider);
      expect(result).toEqual({
        success: false,
        message: `Failed to set provider to ${provider}`,
      });
    });
  });

  describe('health', () => {
    it('should return health check result', async () => {
      const expectedResult = {
        status: 'healthy' as const,
        providers: [
          {
            provider: EmbeddingProvider.ALIBABA,
            available: true,
            initialized: true,
          },
        ],
        timestamp: '2023-01-01T00:00:00.000Z',
      };

      mockEmbeddingService.healthCheck.mockResolvedValue(expectedResult);

      const result = await controller.health();

      expect(embeddingService.healthCheck).toHaveBeenCalled();
      expect(result).toEqual(expectedResult);
    });
  });

  describe('getStats', () => {
    it('should return statistics', () => {
      const expectedResult = {
        totalRequests: 100,
        successfulRequests: 95,
        failedRequests: 5,
        averageResponseTime: 150,
        providerStats: {
          [EmbeddingProvider.ALIBABA]: {
            requests: 80,
            successes: 78,
            failures: 2,
            averageResponseTime: 140,
          },
          [EmbeddingProvider.OPENAI]: {
            requests: 20,
            successes: 17,
            failures: 3,
            averageResponseTime: 180,
          },
          [EmbeddingProvider.ONNX]: {
            requests: 0,
            successes: 0,
            failures: 0,
            averageResponseTime: 0,
          },
        },
      };

      mockEmbeddingService.getStats.mockReturnValue(expectedResult);

      const result = controller.getStats();

      expect(embeddingService.getStats).toHaveBeenCalled();
      expect(result).toEqual(expectedResult);
    });
  });

  describe('resetStats', () => {
    it('should reset statistics', () => {
      mockEmbeddingService.resetStats.mockImplementation(() => {});

      const result = controller.resetStats();

      expect(embeddingService.resetStats).toHaveBeenCalled();
      expect(result).toEqual({
        success: true,
        message: 'Statistics reset successfully',
      });
    });
  });
});
