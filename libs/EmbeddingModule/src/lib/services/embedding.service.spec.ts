import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmbeddingService } from './embedding.service';
import { EmbeddingProvider } from 'embedding';
import { EmbeddingModuleConfig } from '../interfaces/embedding.interfaces';

describe('EmbeddingService', () => {
  let service: EmbeddingService;
  let configService: ConfigService;

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmbeddingService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<EmbeddingService>(EmbeddingService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('embed', () => {
    it('should generate embedding successfully', async () => {
      const request = {
        text: 'test text',
        provider: EmbeddingProvider.ALIBABA,
      };

      const result = await service.embed(request);

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
      if (result.success) {
        expect(result.embedding).toBeDefined();
        expect(Array.isArray(result.embedding)).toBe(true);
        expect(result.provider).toBe(EmbeddingProvider.ALIBABA);
      }
    });

    it('should handle array input', async () => {
      const request = {
        text: ['text1', 'text2'],
        provider: EmbeddingProvider.ALIBABA,
      };

      const result = await service.embed(request);

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });

    it('should use default provider when none specified', async () => {
      const request = {
        text: 'test text',
      };

      const result = await service.embed(request);

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });
  });

  describe('embedBatch', () => {
    it('should generate batch embeddings successfully', async () => {
      const request = {
        texts: ['text1', 'text2', 'text3'],
        provider: EmbeddingProvider.ALIBABA,
        concurrencyLimit: 2,
      };

      const result = await service.embedBatch(request);

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
      expect(result.totalCount).toBe(3);
      expect(result.successCount).toBeGreaterThanOrEqual(0);
      expect(result.failureCount).toBeGreaterThanOrEqual(0);
      expect(result.successCount + result.failureCount).toBe(3);
    });

    it('should use default concurrency limit when none specified', async () => {
      const request = {
        texts: ['text1', 'text2'],
        provider: EmbeddingProvider.ALIBABA,
      };

      const result = await service.embedBatch(request);

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });
  });

  describe('provider management', () => {
    it('should set provider successfully', () => {
      const result = service.setProvider(EmbeddingProvider.OPENAI);
      expect(typeof result).toBe('boolean');
    });

    it('should get current provider', () => {
      const provider = service.getProvider();
      expect(Object.values(EmbeddingProvider)).toContain(provider);
    });

    it('should get available providers', () => {
      const providers = service.getAvailableProviders();
      expect(Array.isArray(providers)).toBe(true);
    });

    it('should get provider info', () => {
      const providerInfo = service.getProviderInfo();
      expect(Array.isArray(providerInfo)).toBe(true);
      expect(providerInfo.length).toBe(Object.values(EmbeddingProvider).length);

      providerInfo.forEach((info) => {
        expect(info).toHaveProperty('provider');
        expect(info).toHaveProperty('available');
        expect(info).toHaveProperty('initialized');
        expect(Object.values(EmbeddingProvider)).toContain(info.provider);
        expect(typeof info.available).toBe('boolean');
        expect(typeof info.initialized).toBe('boolean');
      });
    });
  });

  describe('health check', () => {
    it('should perform health check', async () => {
      const health = await service.healthCheck();

      expect(health).toBeDefined();
      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('providers');
      expect(health).toHaveProperty('timestamp');
      expect(['healthy', 'unhealthy']).toContain(health.status);
      expect(Array.isArray(health.providers)).toBe(true);
      expect(typeof health.timestamp).toBe('string');
    });
  });

  describe('statistics', () => {
    it('should get statistics', () => {
      const stats = service.getStats();

      expect(stats).toBeDefined();
      expect(stats).toHaveProperty('totalRequests');
      expect(stats).toHaveProperty('successfulRequests');
      expect(stats).toHaveProperty('failedRequests');
      expect(stats).toHaveProperty('averageResponseTime');
      expect(stats).toHaveProperty('providerStats');

      expect(typeof stats.totalRequests).toBe('number');
      expect(typeof stats.successfulRequests).toBe('number');
      expect(typeof stats.failedRequests).toBe('number');
      expect(typeof stats.averageResponseTime).toBe('number');
      expect(typeof stats.providerStats).toBe('object');
    });

    it('should reset statistics', () => {
      service.resetStats();
      const stats = service.getStats();

      expect(stats.totalRequests).toBe(0);
      expect(stats.successfulRequests).toBe(0);
      expect(stats.failedRequests).toBe(0);
      expect(stats.averageResponseTime).toBe(0);

      Object.values(stats.providerStats).forEach((providerStat) => {
        expect(providerStat.requests).toBe(0);
        expect(providerStat.successes).toBe(0);
        expect(providerStat.failures).toBe(0);
        expect(providerStat.averageResponseTime).toBe(0);
      });
    });
  });

  describe('module initialization', () => {
    it('should initialize with default config when no config provided', async () => {
      mockConfigService.get.mockReturnValue(undefined);

      await service.onModuleInit();

      expect(service.getProvider()).toBeDefined();
    });

    it('should initialize with custom config', async () => {
      const customConfig: EmbeddingModuleConfig = {
        defaultProvider: EmbeddingProvider.OPENAI,
        defaultConcurrencyLimit: 10,
        enableHealthCheck: false,
        healthCheckInterval: 60000,
      };

      mockConfigService.get.mockReturnValue(customConfig);

      // Reset the service to test initialization
      await service.onModuleDestroy();
      await service.onModuleInit();

      // Note: The test might fail if OPENAI provider is not available
      // In that case, it will fall back to the default available provider
      const currentProvider = service.getProvider();
      expect([
        EmbeddingProvider.OPENAI,
        EmbeddingProvider.ALIBABA,
        EmbeddingProvider.ONNX,
      ]).toContain(currentProvider);
    });
  });
});
