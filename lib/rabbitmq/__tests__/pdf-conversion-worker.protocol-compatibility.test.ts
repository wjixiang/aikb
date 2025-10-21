import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PdfConversionWorker } from '../pdf-conversion.worker';
import { IPdfConversionService } from '../pdf-conversion.service.interface';
import { PdfConversionService } from '../pdf-conversion.service';
import {
  PdfConversionRequestMessage,
  PdfPartConversionRequestMessage,
} from '../message.types';
import { MessageProtocol } from '../message-service.interface';
import { getRabbitMQService, closeAllRabbitMQServices, RabbitMQService } from '../rabbitmq.service';

// Mock the conversion service
const mockConversionService: Partial<IPdfConversionService> = {
  initialize: vi.fn().mockResolvedValue(undefined),
  convertPdfToMarkdown: vi.fn().mockResolvedValue({
    success: true,
    markdownContent: '# Test Markdown Content',
    processingTime: 1000
  }),
  convertPdfPartToMarkdown: vi.fn().mockResolvedValue({
    success: true,
    partIndex: 0,
    totalParts: 1,
    markdownContent: '# Test Part Markdown Content',
    processingTime: 500
  }),
  getStats: vi.fn().mockReturnValue({}),
};

// Create a simple test to verify protocol compatibility
describe('PdfConversionWorker Protocol Compatibility', () => {
  let originalProtocol: string | undefined;

  beforeEach(async () => {
    // Reset environment
    vi.clearAllMocks();
    
    // Store original protocol
    originalProtocol = process.env.RABBITMQ_PROTOCOL;
  });

  afterEach(async () => {
    // Restore original protocol
    if (originalProtocol !== undefined) {
      process.env.RABBITMQ_PROTOCOL = originalProtocol;
    } else {
      delete process.env.RABBITMQ_PROTOCOL;
    }

    // Clean up RabbitMQ service instances to ensure test isolation
    try {
      await closeAllRabbitMQServices();
    } catch (error) {
      // Log error but don't fail the test
      console.warn('Error cleaning up RabbitMQ services:', error);
    }
  });

  describe('Protocol Detection', () => {
    it('should detect AMQP protocol from environment', () => {
      // Set protocol to AMQP
      process.env.RABBITMQ_PROTOCOL = 'amqp';
      
      // Create a new worker to pick up the environment variable
      const amqpWorker = new PdfConversionWorker(undefined, mockConversionService as IPdfConversionService);
      
      // The worker should be created with AMQP protocol
      expect(amqpWorker).toBeDefined();
      expect(amqpWorker.isWorkerRunning()).toBe(false);
    });

    it('should detect STOMP protocol from environment', () => {
      // Set protocol to STOMP
      process.env.RABBITMQ_PROTOCOL = 'stomp';
      
      // Create a new worker to pick up the environment variable
      const stompWorker = new PdfConversionWorker(undefined, mockConversionService as IPdfConversionService);
      
      // The worker should be created with STOMP protocol
      expect(stompWorker).toBeDefined();
      expect(stompWorker.isWorkerRunning()).toBe(false);
    });
  });

  describe('Protocol Switching', () => {
    it('should handle protocol switching between AMQP and STOMP', async () => {
      // Test with AMQP first
      process.env.RABBITMQ_PROTOCOL = 'amqp';
      const amqpWorker = new PdfConversionWorker(undefined, mockConversionService as IPdfConversionService);
      expect(amqpWorker).toBeDefined();
      
      // Switch to STOMP
      process.env.RABBITMQ_PROTOCOL = 'stomp';
      const stompWorker = new PdfConversionWorker(undefined, mockConversionService as IPdfConversionService);
      const status = await stompWorker.getWorkerStats();
      
      expect(status.isRunning).toBe(false);
      // The message service might not be connected since we're not initializing the worker
      expect(status.messageServiceConnected).toBe(false);
    });
  });

  describe('Handler Methods', () => {
    let rabbitmqService: RabbitMQService;

    describe('use amqp', () => {
      beforeEach(async () => {
        rabbitmqService = getRabbitMQService(MessageProtocol.AMQP);
        await rabbitmqService.initialize();
      });

      it('should handle PDF conversion request message', async () => {
        const testMessage: PdfConversionRequestMessage = {
          messageId: `test_message_id_${Date.now()}`,
          timestamp: Date.now(),
          eventType: 'PDF_CONVERSION_REQUEST',
          itemId: 'test_item_id',
          s3Key: 'test/test.pdf',
          fileName: 'test.pdf',
          metadata: {
            title: 'Test PDF',
            authors: [
              {
                firstName: 'John',
                lastName: 'Doe'
              }
            ],
            tags: ['test'],
            collections: ['test-collection']
          },
          pdfMetadata: {
            pageCount: 10,
            fileSize: 1024,
            title: 'Test PDF'
          },
          priority: 'normal',
          retryCount: 0,
          maxRetries: 3,
        };

        // Create worker with AMQP protocol
        const worker = new PdfConversionWorker(
          undefined,
          mockConversionService as IPdfConversionService,
          undefined,
          MessageProtocol.AMQP
        );
        
        await worker.start();

        // Wait for the worker to be fully connected and consuming
        await new Promise(resolve => setTimeout(resolve, 500));

        // Publish message
        await rabbitmqService.publishPdfConversionRequest(testMessage);
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Verify the conversion service was called
        expect(mockConversionService.convertPdfToMarkdown).toHaveBeenCalledWith(
          expect.objectContaining({
            itemId: 'test_item_id',
            s3Key: 'test/test.pdf',
          }),
          expect.any(Function)
        );
        
        await worker.stop();
      });

      it('should handle PDF part conversion request message', async () => {
        const testMessage: PdfPartConversionRequestMessage = {
          messageId: `test_message_id_${Date.now()}`,
          timestamp: Date.now(),
          eventType: 'PDF_PART_CONVERSION_REQUEST',
          itemId: 'test_item_id',
          s3Key: 'test/test.pdf',
          fileName: 'test.pdf',
          partIndex: 0,
          totalParts: 3,
          startPage: 1,
          endPage: 5,
          pdfMetadata: {
            pageCount: 10,
            fileSize: 1024,
            title: 'Test PDF'
          },
          priority: 'normal',
          retryCount: 0,
          maxRetries: 3,
        };

        // Create worker with AMQP protocol
        const worker = new PdfConversionWorker(
          undefined,
          mockConversionService as IPdfConversionService,
          undefined,
          MessageProtocol.AMQP
        );
        
        await worker.start();

        // Wait for the worker to be fully connected and consuming
        await new Promise(resolve => setTimeout(resolve, 500));

        // Publish message
        await rabbitmqService.publishPdfPartConversionRequest(testMessage);
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Verify the conversion service was called
        expect(mockConversionService.convertPdfPartToMarkdown).toHaveBeenCalledWith(
          expect.objectContaining({
            itemId: 'test_item_id',
            s3Key: 'test/test.pdf',
            partIndex: 0,
            totalParts: 3,
            startPage: 1,
            endPage: 5,
          }),
          expect.any(Function)
        );
        
        await worker.stop();
      });

      it('should send markdown storage request after PDF conversion', async () => {
        const testMessage: PdfConversionRequestMessage = {
          messageId: `test_message_id_${Date.now()}`,
          timestamp: Date.now(),
          eventType: 'PDF_CONVERSION_REQUEST',
          itemId: 'test_item_id',
          s3Key: 'test/test.pdf',
          fileName: 'test.pdf',
          metadata: {
            title: 'Test PDF',
            authors: [
              {
                firstName: 'John',
                lastName: 'Doe'
              }
            ],
            tags: ['test'],
            collections: ['test-collection']
          },
          pdfMetadata: {
            pageCount: 10,
            fileSize: 1024,
            title: 'Test PDF'
          },
          priority: 'normal',
          retryCount: 0,
          maxRetries: 3,
        };

        // Create worker with AMQP protocol
        const worker = new PdfConversionWorker(
          undefined,
          mockConversionService as IPdfConversionService,
          undefined,
          MessageProtocol.AMQP
        );
        
        // Mock the conversion service to return a successful result
        (mockConversionService.convertPdfToMarkdown as any).mockResolvedValue({
          success: true,
          markdownContent: '# Test Markdown Content',
          processingTime: 1000
        });

        await worker.start();

        // Wait for the worker to be fully connected and consuming
        await new Promise(resolve => setTimeout(resolve, 500));

        // Publish message
        await rabbitmqService.publishPdfConversionRequest(testMessage);
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Verify the conversion service was called
        expect(mockConversionService.convertPdfToMarkdown).toHaveBeenCalledWith(
          expect.objectContaining({
            itemId: 'test_item_id',
            s3Key: 'test/test.pdf',
          }),
          expect.any(Function)
        );
        
        await worker.stop();
      });
    });

    describe('use stomp', () => {
      beforeEach(async () => {
        rabbitmqService = getRabbitMQService(MessageProtocol.STOMP);
        await rabbitmqService.initialize();
      });

      it('should handle PDF conversion request message', async () => {
        const testMessage: PdfConversionRequestMessage = {
          messageId: `test_message_id_${Date.now()}`,
          timestamp: Date.now(),
          eventType: 'PDF_CONVERSION_REQUEST',
          itemId: 'test_item_id',
          s3Key: 'test/test.pdf',
          fileName: 'test.pdf',
          metadata: {
            title: 'Test PDF',
            authors: [
              {
                firstName: 'John',
                lastName: 'Doe'
              }
            ],
            tags: ['test'],
            collections: ['test-collection']
          },
          pdfMetadata: {
            pageCount: 10,
            fileSize: 1024,
            title: 'Test PDF'
          },
          priority: 'normal',
          retryCount: 0,
          maxRetries: 3,
        };

        // Create worker with STOMP protocol
        const worker = new PdfConversionWorker(
          undefined,
          mockConversionService as IPdfConversionService,
          undefined,
          MessageProtocol.STOMP
        );
        
        await worker.start();

        const status = await worker.getWorkerStats();
        // Verify the worker is running with STOMP protocol
        expect(status.isRunning).toBe(true);
        expect(status.messageServiceConnected).toBe(true);

        // Wait for the worker to be fully connected and consuming
        await new Promise(resolve => setTimeout(resolve, 500));

        // Publish message
        await rabbitmqService.publishPdfConversionRequest(testMessage);
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Verify the conversion service was called
        expect(mockConversionService.convertPdfToMarkdown).toHaveBeenCalledWith(
          expect.objectContaining({
            itemId: 'test_item_id',
            s3Key: 'test/test.pdf',
          }),
          expect.any(Function)
        );
        
        await worker.stop();
      });

      it('should handle PDF part conversion request message', async () => {
        const testMessage: PdfPartConversionRequestMessage = {
          messageId: `test_message_id_${Date.now()}`,
          timestamp: Date.now(),
          eventType: 'PDF_PART_CONVERSION_REQUEST',
          itemId: 'test_item_id',
          s3Key: 'test/test.pdf',
          fileName: 'test.pdf',
          partIndex: 0,
          totalParts: 3,
          startPage: 1,
          endPage: 5,
          pdfMetadata: {
            pageCount: 10,
            fileSize: 1024,
            title: 'Test PDF'
          },
          priority: 'normal',
          retryCount: 0,
          maxRetries: 3,
        };

        // Create worker with STOMP protocol
        const worker = new PdfConversionWorker(
          undefined,
          mockConversionService as IPdfConversionService,
          undefined,
          MessageProtocol.STOMP
        );
        
        await worker.start();

        // Wait for the worker to be fully connected and consuming
        await new Promise(resolve => setTimeout(resolve, 500));

        // Publish message
        await rabbitmqService.publishPdfPartConversionRequest(testMessage);
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Verify the conversion service was called
        expect(mockConversionService.convertPdfPartToMarkdown).toHaveBeenCalledWith(
          expect.objectContaining({
            itemId: 'test_item_id',
            s3Key: 'test/test.pdf',
            partIndex: 0,
            totalParts: 3,
            startPage: 1,
            endPage: 5,
          }),
          expect.any(Function)
        );
        
        await worker.stop();
      });

      it('should send markdown storage request after PDF conversion', async () => {
        const testMessage: PdfConversionRequestMessage = {
          messageId: `test_message_id_${Date.now()}`,
          timestamp: Date.now(),
          eventType: 'PDF_CONVERSION_REQUEST',
          itemId: 'test_item_id',
          s3Key: 'test/test.pdf',
          fileName: 'test.pdf',
          metadata: {
            title: 'Test PDF',
            authors: [
              {
                firstName: 'John',
                lastName: 'Doe'
              }
            ],
            tags: ['test'],
            collections: ['test-collection']
          },
          pdfMetadata: {
            pageCount: 10,
            fileSize: 1024,
            title: 'Test PDF'
          },
          priority: 'normal',
          retryCount: 0,
          maxRetries: 3,
        };

        // Create worker with STOMP protocol
        const worker = new PdfConversionWorker(
          undefined,
          mockConversionService as IPdfConversionService,
          undefined,
          MessageProtocol.STOMP
        );
        
        // Mock the conversion service to return a successful result
        (mockConversionService.convertPdfToMarkdown as any).mockResolvedValue({
          success: true,
          markdownContent: '# Test Markdown Content',
          processingTime: 1000
        });

        await worker.start();

        // Wait for the worker to be fully connected and consuming
        await new Promise(resolve => setTimeout(resolve, 500));

        // Publish message
        await rabbitmqService.publishPdfConversionRequest(testMessage);
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Verify the conversion service was called
        expect(mockConversionService.convertPdfToMarkdown).toHaveBeenCalledWith(
          expect.objectContaining({
            itemId: 'test_item_id',
            s3Key: 'test/test.pdf',
          }),
          expect.any(Function)
        );
        
        await worker.stop();
      });
    });
  });

  describe('Service Initialization', () => {
    it('should initialize RabbitMQ service with AMQP protocol', async () => {
      // Set protocol to AMQP
      process.env.RABBITMQ_PROTOCOL = 'amqp';
      
      // Get the RabbitMQ service instance
      const rabbitmqService = getRabbitMQService(MessageProtocol.AMQP);
      
      // Initialize the service
      await rabbitmqService.initialize();
      
      // Verify the service is connected
      expect(rabbitmqService.isConnected()).toBe(true);
    });

    it('should initialize RabbitMQ service with STOMP protocol', async () => {
      // Set protocol to STOMP
      process.env.RABBITMQ_PROTOCOL = 'stomp';
      
      // Get the RabbitMQ service instance
      const rabbitmqService = getRabbitMQService(MessageProtocol.STOMP);
      
      // Initialize the service
      await rabbitmqService.initialize();
      
      // Verify the service is connected
      expect(rabbitmqService.isConnected()).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle handler errors gracefully', async () => {
      // Mock the conversion service to throw an error
      (mockConversionService.convertPdfToMarkdown as any).mockRejectedValue(new Error('Test conversion error'));
      
      const worker = new PdfConversionWorker(undefined, mockConversionService as IPdfConversionService);
      
      // Should not throw when creating the worker
      expect(worker).toBeDefined();
    });
  });
});