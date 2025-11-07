import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  MinerUClient,
  MinerUApiError,
  MinerUTimeoutError,
  MinerUDefaultConfig,
} from './mineru-client';

// Mock axios
const mockAxiosInstance = {
  get: vi.fn(),
  post: vi.fn(),
  delete: vi.fn(),
  interceptors: {
    response: {
      use: vi.fn(),
    },
  },
};

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => mockAxiosInstance),
  },
}));

// Mock fs
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
  },
  createWriteStream: vi.fn(),
}));

// Mock path
vi.mock('path', () => ({
  default: {
    basename: vi.fn((path: string) => path.split('/').pop()),
    resolve: vi.fn((...paths: string[]) => paths.join('/')),
    join: vi.fn((...paths: string[]) => paths.join('/')),
    extname: vi.fn((path: string) => '.' + path.split('.').pop()),
  },
}));

describe('MinerUClient', () => {
  let client: MinerUClient;
  const mockConfig = {
    token: 'test-token',
    downloadDir: './test-downloads',
    defaultOptions: {
      is_ocr: false,
      enable_formula: true,
      enable_table: true,
      language: 'ch' as const,
      model_version: 'pipeline' as const,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    client = new MinerUClient(mockConfig);
  });

  describe('Constructor', () => {
    it('should create client with default config', () => {
      const testClient = new MinerUClient(mockConfig);
      expect(testClient).toBeInstanceOf(MinerUClient);
    });

    it('should throw error when token is missing', () => {
      expect(() => {
        new MinerUClient({ ...mockConfig, token: '' });
      }).toThrow('Token is required for MinerU API authentication');
    });
  });

  describe('validateToken', () => {
    it('should return true for valid token (404 response)', async () => {
      const axios = await import('axios');
      const mockAxiosInstance = {
        get: vi.fn().mockRejectedValue({
          response: {
            status: 404,
            data: { code: 'NOT_FOUND' },
          },
        }),
        interceptors: {
          response: { use: vi.fn() },
        },
      };

      vi.mocked(axios.default.create).mockReturnValue(mockAxiosInstance as any);
      const testClient = new MinerUClient(mockConfig);

      const isValid = await testClient.validateToken();
      expect(isValid).toBe(true);
    });

    it('should return false for invalid token (401 response)', async () => {
      const axios = await import('axios');
      const mockAxiosInstance = {
        get: vi
          .fn()
          .mockRejectedValue(
            new MinerUApiError('UNAUTHORIZED', 'Invalid token'),
          ),
        interceptors: {
          response: { use: vi.fn() },
        },
      };

      vi.mocked(axios.default.create).mockReturnValue(mockAxiosInstance as any);
      const testClient = new MinerUClient(mockConfig);

      const isValid = await testClient.validateToken();
      expect(isValid).toBe(false);
    });
  });

  describe('createSingleFileTask', () => {
    it('should create single file task successfully', async () => {
      const axios = await import('axios');
      const mockResponse = {
        data: {
          data: { task_id: 'test-task-id' },
        },
      };

      const mockAxiosInstance = {
        post: vi.fn().mockResolvedValue(mockResponse),
        interceptors: {
          response: { use: vi.fn() },
        },
      };

      vi.mocked(axios.default.create).mockReturnValue(mockAxiosInstance as any);
      const testClient = new MinerUClient(mockConfig);

      const taskId = await testClient.createSingleFileTask({
        url: 'https://example.com/test.pdf',
      });

      expect(taskId).toBe('test-task-id');
    });

    it('should handle alternative task identifiers', async () => {
      const axios = await import('axios');
      const mockResponse = {
        data: {
          data: { id: 'alternative-id' },
        },
      };

      const mockAxiosInstance = {
        post: vi.fn().mockResolvedValue(mockResponse),
        interceptors: {
          response: { use: vi.fn() },
        },
      };

      vi.mocked(axios.default.create).mockReturnValue(mockAxiosInstance as any);
      const testClient = new MinerUClient(mockConfig);

      const taskId = await testClient.createSingleFileTask({
        url: 'https://example.com/test.pdf',
      });

      expect(taskId).toBe('alternative-id');
    });
  });

  describe('getTaskResult', () => {
    it('should get task result successfully', async () => {
      const axios = await import('axios');
      const mockResult = {
        task_id: 'test-task-id',
        state: 'done',
        full_zip_url: 'https://example.com/result.zip',
      };

      const mockResponse = {
        data: {
          data: mockResult,
        },
      };

      const mockAxiosInstance = {
        get: vi.fn().mockResolvedValue(mockResponse),
        interceptors: {
          response: { use: vi.fn() },
        },
      };

      vi.mocked(axios.default.create).mockReturnValue(mockAxiosInstance as any);
      const testClient = new MinerUClient(mockConfig);

      const result = await testClient.getTaskResult('test-task-id');
      expect(result).toEqual(mockResult);
    });
  });

  describe('cancelTask', () => {
    it('should cancel task successfully', async () => {
      const axios = await import('axios');
      const mockResponse = {
        data: {
          data: { cancelled: true },
        },
      };

      const mockAxiosInstance = {
        delete: vi.fn().mockResolvedValue(mockResponse),
        interceptors: {
          response: { use: vi.fn() },
        },
      };

      vi.mocked(axios.default.create).mockReturnValue(mockAxiosInstance as any);
      const testClient = new MinerUClient(mockConfig);

      const cancelled = await testClient.cancelTask('test-task-id');
      expect(cancelled).toBe(true);
    });
  });

  describe('createBatchUrlTask', () => {
    it('should create batch URL task successfully', async () => {
      const axios = await import('axios');
      const mockResponse = {
        data: {
          data: { batch_id: 'test-batch-id' },
        },
      };

      const mockAxiosInstance = {
        post: vi.fn().mockResolvedValue(mockResponse),
        interceptors: {
          response: { use: vi.fn() },
        },
      };

      vi.mocked(axios.default.create).mockReturnValue(mockAxiosInstance as any);
      const testClient = new MinerUClient(mockConfig);

      const batchId = await testClient.createBatchUrlTask({
        files: [{ url: 'https://example.com/test1.pdf' }],
      });

      expect(batchId).toBe('test-batch-id');
    });
  });

  describe('getBatchTaskResults', () => {
    it('should get batch task results successfully', async () => {
      const axios = await import('axios');
      const mockResults = {
        batch_id: 'test-batch-id',
        extract_result: [
          {
            task_id: 'task-1',
            state: 'done',
            full_zip_url: 'https://example.com/result1.zip',
          },
        ],
      };

      const mockResponse = {
        data: {
          data: mockResults,
        },
      };

      const mockAxiosInstance = {
        get: vi.fn().mockResolvedValue(mockResponse),
        interceptors: {
          response: { use: vi.fn() },
        },
      };

      vi.mocked(axios.default.create).mockReturnValue(mockAxiosInstance as any);
      const testClient = new MinerUClient(mockConfig);

      const results = await testClient.getBatchTaskResults('test-batch-id');
      expect(results).toEqual(mockResults);
    });
  });

  describe('Static methods', () => {
    it('should validate file format correctly', () => {
      expect(MinerUClient.isValidFileFormat('test.pdf')).toBe(true);
      expect(MinerUClient.isValidFileFormat('test.docx')).toBe(true);
      expect(MinerUClient.isValidFileFormat('test.txt')).toBe(false);
      expect(MinerUClient.isValidFileFormat('test.PDF')).toBe(true);
    });

    it('should return supported languages', () => {
      const languages = MinerUClient.getSupportedLanguages();
      expect(languages).toContain('en');
      expect(languages).toContain('ch');
      expect(languages).toContain('japan');
      expect(Array.isArray(languages)).toBe(true);
    });
  });

  describe('Error handling', () => {
    it('should handle API errors correctly', async () => {
      const axios = await import('axios');
      const mockAxiosInstance = {
        get: vi.fn().mockRejectedValue({
          response: {
            status: 400,
            data: { code: 'BAD_REQUEST', msg: 'Invalid request' },
          },
        }),
        interceptors: {
          response: {
            use: vi.fn((_, error) => {
              throw new MinerUApiError('BAD_REQUEST', 'Invalid request');
            }),
          },
        },
      };

      vi.mocked(axios.default.create).mockReturnValue(mockAxiosInstance as any);
      const testClient = new MinerUClient(mockConfig);

      await expect(testClient.getTaskResult('invalid-task')).rejects.toThrow(
        MinerUApiError,
      );
    });

    it('should handle network errors correctly', async () => {
      const axios = await import('axios');
      const mockAxiosInstance = {
        get: vi.fn().mockRejectedValue(new Error('Network error')),
        interceptors: {
          response: {
            use: vi.fn((_, error) => {
              throw new MinerUTimeoutError(
                'Network request failed: Network error',
              );
            }),
          },
        },
      };

      vi.mocked(axios.default.create).mockReturnValue(mockAxiosInstance as any);
      const testClient = new MinerUClient(mockConfig);

      await expect(testClient.getTaskResult('invalid-task')).rejects.toThrow(
        MinerUTimeoutError,
      );
    });
  });

  describe('Default configuration', () => {
    it('should have correct default values', () => {
      expect(MinerUDefaultConfig.baseUrl).toBe('https://mineru.net/api/v4');
      expect(MinerUDefaultConfig.timeout).toBe(30000);
      expect(MinerUDefaultConfig.maxRetries).toBe(3);
      expect(MinerUDefaultConfig.retryDelay).toBe(1000);
      expect(MinerUDefaultConfig.downloadDir).toBe('./mineru-downloads');
      expect(MinerUDefaultConfig.defaultOptions.is_ocr).toBe(false);
      expect(MinerUDefaultConfig.defaultOptions.enable_formula).toBe(true);
      expect(MinerUDefaultConfig.defaultOptions.enable_table).toBe(true);
      expect(MinerUDefaultConfig.defaultOptions.language).toBe('ch');
      expect(MinerUDefaultConfig.defaultOptions.model_version).toBe('pipeline');
    });
  });
});
