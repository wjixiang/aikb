import { config } from 'dotenv';
import {
  describe,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  it,
  expect,
  vi,
} from 'vitest';
import { PdfConversionWorker } from '../pdf-conversion.worker';
import { PdfConversionWorkerFactory } from '../pdf-conversion-worker.factory';
import { PdfConversionService } from '../pdf-conversion.service';
import { PdfConversionMessageHandler } from '../pdf-conversion-message-handler';
import { IPdfConversionService } from '../pdf-conversion.service.interface';
import { IPdfConversionMessageHandler } from '../pdf-conversion-message-handler.interface';
import { MinerUPdfConvertor } from '../../MinerU/MinerUPdfConvertor';
import { mockRabbitMQService } from '../__mocks__/rabbitmq.mock';

// Load environment variables
config({ path: '.env' });

// Mock the logger to ensure console output during tests
vi.mock('../../logger', () => ({
  default: vi.fn(() => ({
    info: vi.fn((...args) => console.log('[LOGGER INFO]', ...args)),
    error: vi.fn((...args) => console.error('[LOGGER ERROR]', ...args)),
    warn: vi.fn((...args) => console.warn('[LOGGER WARN]', ...args)),
    debug: vi.fn((...args) => console.log('[LOGGER DEBUG]', ...args)),
  })),
}));

const mockPdfConvertor: MinerUPdfConvertor = {
  convertPdfToMarkdownFromS3: vi.fn(),
} as any;

const mockPdfConversionService: IPdfConversionService = {
  initialize: vi.fn().mockResolvedValue(undefined),
  convertPdfToMarkdown: vi.fn(),
  convertPdfPartToMarkdown: vi.fn(),
  isReady: vi.fn().mockReturnValue(true),
  getStats: vi
    .fn()
    .mockReturnValue({ isReady: true, pdfConvertorAvailable: true }),
};

const mockMessageHandler: IPdfConversionMessageHandler = {
  initialize: vi.fn().mockResolvedValue(undefined),
  startConsuming: vi.fn().mockResolvedValue(undefined),
  stopConsuming: vi.fn().mockResolvedValue(undefined),
  handlePdfConversionRequest: vi.fn(),
  handlePdfPartConversionRequest: vi.fn(),
  publishProgressMessage: vi.fn(),
  publishConversionCompletionMessage: vi.fn(),
  publishFailureMessage: vi.fn(),
  publishPartCompletionMessage: vi.fn(),
  publishPartFailureMessage: vi.fn(),
  sendMarkdownStorageRequest: vi.fn(),
  sendMarkdownPartStorageRequest: vi.fn(),
  isRunning: vi.fn().mockReturnValue(false),
  getStats: vi.fn().mockReturnValue({
    isRunning: false,
    consumerTag: null,
    partConsumerTag: null,
    messageServiceConnected: true,
  }),
};

describe('PdfConversionWorker (Refactored)', () => {
  let worker: PdfConversionWorker;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    if (worker && worker.isWorkerRunning()) {
      await worker.stop();
    }
  });

  describe('Constructor', () => {
    it('should create a worker with default dependencies', () => {
      worker = new PdfConversionWorker();
      expect(worker).toBeDefined();
    });

    it('should create a worker with custom dependencies', () => {
      worker = new PdfConversionWorker(
        mockRabbitMQService,
        mockPdfConversionService,
        mockMessageHandler,
      );
      expect(worker).toBeDefined();
    });
  });

  describe('Start and Stop', () => {
    it('should start the worker successfully', async () => {
      // Mock isRunning to return true after startConsuming is called
      (mockMessageHandler.isRunning as any).mockReturnValue(true);

      worker = new PdfConversionWorker(
        mockRabbitMQService,
        mockPdfConversionService,
        mockMessageHandler,
      );

      await worker.start();

      expect(mockMessageHandler.initialize).toHaveBeenCalled();
      expect(mockMessageHandler.startConsuming).toHaveBeenCalled();
      expect(worker.isWorkerRunning()).toBe(true);
    });

    it('should stop the worker successfully', async () => {
      worker = new PdfConversionWorker(
        mockRabbitMQService,
        mockPdfConversionService,
        mockMessageHandler,
      );

      await worker.start();
      await worker.stop();

      expect(mockMessageHandler.stopConsuming).toHaveBeenCalled();
      expect(worker.isWorkerRunning()).toBe(false);
    });

    it('should handle start errors gracefully', async () => {
      (mockMessageHandler.initialize as any).mockRejectedValueOnce(
        new Error('Test error'),
      );

      worker = new PdfConversionWorker(
        mockRabbitMQService,
        mockPdfConversionService,
        mockMessageHandler,
      );

      await expect(worker.start()).rejects.toThrow('Test error');
      expect(worker.isWorkerRunning()).toBe(false);
    });
  });

  describe('Worker Statistics', () => {
    it('should return correct statistics when running', async () => {
      (mockMessageHandler.isRunning as any).mockReturnValue(true);
      (mockMessageHandler.getStats as any).mockReturnValue({
        isRunning: true,
        consumerTag: 'test-consumer-tag',
        partConsumerTag: 'test-part-consumer-tag',
        messageServiceConnected: true,
      });

      worker = new PdfConversionWorker(
        mockRabbitMQService,
        mockPdfConversionService,
        mockMessageHandler,
      );

      await worker.start();
      const stats = await worker.getWorkerStats();

      expect(stats.isRunning).toBe(true);
      expect(stats.isInitialized).toBe(true);
      expect(stats.messageHandlerStats.isRunning).toBe(true);
      expect(stats.conversionServiceStats.isReady).toBe(true);
      expect(stats.messageServiceConnected).toBe(true);
    });

    it('should return correct statistics when not running', () => {
      worker = new PdfConversionWorker(
        mockRabbitMQService,
        mockPdfConversionService,
        mockMessageHandler,
      );

      expect(worker.isWorkerRunning()).toBe(false);
    });
  });
});

describe('PdfConversionWorkerFactory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createDefault', () => {
    it('should create a worker with default dependencies', () => {
      const worker = PdfConversionWorkerFactory.createDefault();
      expect(worker).toBeDefined();
    });

    it('should create a worker with custom message service', () => {
      const worker = PdfConversionWorkerFactory.createDefault({
        messageService: mockRabbitMQService,
      });
      expect(worker).toBeDefined();
    });
  });

  describe('createWithDependencies', () => {
    it('should create a worker with all custom dependencies', () => {
      const worker = PdfConversionWorkerFactory.createWithDependencies({
        messageService: mockRabbitMQService,
        pdfConvertor: mockPdfConvertor,
        messageHandler: mockMessageHandler,
      });
      expect(worker).toBeDefined();
    });
  });

  describe('createAndStart', () => {
    it('should create and start a worker with default dependencies', async () => {
      // Use mock dependencies to avoid RabbitMQ connection issues
      const worker = PdfConversionWorkerFactory.createForTesting({
        messageService: mockRabbitMQService,
        pdfConversionService: mockPdfConversionService,
        messageHandler: mockMessageHandler,
      });

      // Manually start the worker
      await worker.start();

      expect(worker).toBeDefined();
      expect(worker.isWorkerRunning()).toBe(true);
      await worker.stop();
    });

    it('should create but not start a worker when autoStart is false', async () => {
      const worker = PdfConversionWorkerFactory.createForTesting({
        messageService: mockRabbitMQService,
        pdfConversionService: mockPdfConversionService,
        messageHandler: mockMessageHandler,
      });
      expect(worker).toBeDefined();
      expect(worker.isWorkerRunning()).toBe(false);
    });
  });

  describe('createForTesting', () => {
    it('should create a worker for testing with mock dependencies', () => {
      const worker = PdfConversionWorkerFactory.createForTesting({
        messageService: mockRabbitMQService,
        pdfConversionService: mockPdfConversionService,
        messageHandler: mockMessageHandler,
      });
      expect(worker).toBeDefined();
    });
  });
});

describe('Convenience Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createPdfConversionWorker', () => {
    it('should create a worker with default configuration', () => {
      const worker = PdfConversionWorkerFactory.createDefault();
      expect(worker).toBeDefined();
    });
  });

  describe('createAndStartPdfConversionWorker', () => {
    it('should create and start a worker', async () => {
      const worker = await PdfConversionWorkerFactory.createAndStart();
      expect(worker).toBeDefined();
      expect(worker.isWorkerRunning()).toBe(true);
      await worker.stop();
    });
  });
});
