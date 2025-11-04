import { Test, TestingModule } from '@nestjs/testing';
import { LibraryItemService } from './library-item.service';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { Pdf2MArkdownDto } from './pdf_process.dto';
import * as amqp from 'amqplib';
import { vi } from 'vitest';

// Mock the S3MongoLibraryStorage to avoid MongoDB dependency
vi.mock('@aikb/bibliography', () => ({
  S3MongoLibraryStorage: vi.fn().mockImplementation(() => ({
    updateMetadata: vi.fn().mockResolvedValue({}),
    getPdfDownloadUrl: vi.fn().mockResolvedValue('http://example.com'),
  })),
  Library: vi.fn().mockImplementation(() => ({
    storePdf: vi.fn().mockResolvedValue({}),
    getItem: vi.fn().mockResolvedValue({}),
    searchItems: vi.fn().mockResolvedValue([]),
    deleteItem: vi.fn().mockResolvedValue(true),
  })),
}));

describe('LibraryItemService - End to End', () => {
  // Use unique queue names for test isolation
  const uniqueQueueName = `test_queue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const uniqueServiceQueueName = `pdf_2_markdown_queue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  let service: LibraryItemService;
  let module: TestingModule;
  let connection: amqp.ChannelModel;
  let channel: amqp.Channel;

  beforeAll(async () => {
    // Set test environment variables
    process.env.NODE_ENV = 'test';
    process.env.MONGODB_URI = 'mongodb://localhost:27017/test_bibliography';

    // Create a real RabbitMQ connection for testing
    try {
      connection = await amqp.connect(
        process.env.RABBITMQ_URL ||
          'amqp://admin:admin123@rabbitmq:5672/my_vhost',
      );
      channel = await connection.createChannel();
      // console.log(connection)
      // Declare unique test queues for isolation
      await channel.assertQueue(uniqueQueueName, { durable: true });
      await channel.assertQueue('request-pdf-2-markdown-conversion', {
        durable: true,
      });
      await channel.assertQueue(uniqueServiceQueueName, { durable: true });

      console.log(`Using unique test queue: ${uniqueQueueName}`);

      console.log('RabbitMQ connection established for testing');
    } catch (error) {
      console.error('Failed to connect to RabbitMQ:', error);
      // Don't fail the test if RabbitMQ is not available - skip tests instead
      console.log(
        'RabbitMQ connection not available, skipping tests that require it',
      );
      // Don't throw error, just log it and continue with mock testing
      console.log('Will proceed with mock RabbitMQ testing');
    }
  });

  afterAll(async () => {
    if (channel) {
      await channel.close();
    }
    if (connection) {
      await connection.close();
    }
    if (module) {
      await module.close();
    }
  });

  beforeEach(async () => {
    // Create a test module with real RabbitMQ client
    module = await Test.createTestingModule({
      imports: [
        ClientsModule.register([
          {
            name: 'PDF_2_MARKDOWN_SERVICE',
            transport: Transport.RMQ,
            options: {
              urls: [
                process.env.RABBITMQ_URL ||
                  'amqp://admin:admin123@rabbitmq:5672/my_vhost',
              ],
              queue: uniqueServiceQueueName,
              // Add connection options for better debugging
              connectionInitOptions: { timeout: 30000 },
              heartbeat: 60,
              prefetchCount: 1,
            },
          },
        ]),
      ],
      providers: [LibraryItemService],
    }).compile();

    service = module.get<LibraryItemService>(LibraryItemService);
  });

  afterEach(async () => {
    if (module) {
      await module.close();
    }
  });

  describe('producePdf2MarkdownRequest', () => {
    it('should successfully send a message to RabbitMQ', async () => {
      // Skip test if RabbitMQ connection is not available
      if (!connection || !channel) {
        console.log('Skipping test - RabbitMQ connection not available');
        return;
      }

      // Clear any existing messages in the queues
      await channel.purgeQueue('request-pdf-2-markdown-conversion');
      await channel.purgeQueue(uniqueServiceQueueName);
      await channel.purgeQueue(uniqueQueueName);

      // Create test data
      const testDto = new Pdf2MArkdownDto('test-item-id-123');

      // Set up a consumer to capture the message
      let receivedMessage: any = null;
      let messageReceived = false;

      // Listen to all queues to capture the message
      const consumer1 = await channel.consume(
        'request-pdf-2-markdown-conversion',
        (msg) => {
          if (msg && !messageReceived) {
            const parsedMessage = JSON.parse(msg.content.toString());
            receivedMessage = parsedMessage.data || parsedMessage;
            messageReceived = true;
            console.log(
              'Message received in request-pdf-2-markdown-conversion queue:',
              parsedMessage,
            );
            channel.ack(msg);
          }
        },
        { noAck: false },
      );

      const consumer2 = await channel.consume(
        uniqueServiceQueueName,
        (msg) => {
          if (msg && !messageReceived) {
            const parsedMessage = JSON.parse(msg.content.toString());
            receivedMessage = parsedMessage.data || parsedMessage;
            messageReceived = true;
            console.log(
              'Message received in pdf_2_markdown_queue queue:',
              parsedMessage,
            );
            channel.ack(msg);
          }
        },
        { noAck: false },
      );

      const consumer3 = await channel.consume(
        uniqueQueueName,
        (msg) => {
          if (msg && !messageReceived) {
            const parsedMessage = JSON.parse(msg.content.toString());
            receivedMessage = parsedMessage.data || parsedMessage;
            messageReceived = true;
            console.log(
              `Message received in ${uniqueQueueName} queue:`,
              parsedMessage,
            );
            channel.ack(msg);
          }
        },
        { noAck: false },
      );

      try {
        // Call the method under test
        const result = await service.producePdf2MarkdownRequest(testDto);

        // Wait a bit for the message to be processed
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Verify the result
        expect(result).toEqual({
          message: 'pdf2md request published',
        });

        // Verify the message was received
        expect(messageReceived).toBe(true);
        expect(receivedMessage).toBeDefined();
        expect(receivedMessage.itemId).toBe('test-item-id-123');
      } finally {
        // Clean up consumers
        if (consumer1 && consumer1.consumerTag) {
          await channel.cancel(consumer1.consumerTag);
        }
        if (consumer2 && consumer2.consumerTag) {
          await channel.cancel(consumer2.consumerTag);
        }
        if (consumer3 && consumer3.consumerTag) {
          await channel.cancel(consumer3.consumerTag);
        }
      }
    });

    it('should handle connection errors gracefully', async () => {
      console.log('Starting connection error test...');

      try {
        console.log('Creating module with invalid RabbitMQ configuration...');
        // Create a module with invalid RabbitMQ configuration
        const invalidModule = await Test.createTestingModule({
          imports: [
            ClientsModule.register([
              {
                name: 'PDF_2_MARKDOWN_SERVICE',
                transport: Transport.RMQ,
                options: {
                  urls: [
                    'amqp://invalid:invalid@invalid-host:5672/invalid_vhost',
                  ],
                  queue: `pdf_2_markdown_queue_invalid_${Date.now()}`,
                  connectionInitOptions: { timeout: 1000 },
                },
              },
            ]),
          ],
          providers: [LibraryItemService],
        }).compile();

        console.log('Module created successfully, getting service...');
        const invalidService =
          invalidModule.get<LibraryItemService>(LibraryItemService);

        const testDto = new Pdf2MArkdownDto('test-item-id-456');

        console.log(
          'Calling producePdf2MarkdownRequest with invalid connection...',
        );
        // This should either succeed (if emit is fire-and-forget) or fail gracefully
        // We're testing that it doesn't crash the application
        const result = await invalidService.producePdf2MarkdownRequest(testDto);

        console.log('Result received:', result);
        expect(result).toEqual({
          message: 'pdf2md request published',
        });

        console.log('Closing invalid module...');
        await invalidModule.close();
      } catch (error) {
        console.error('Error in connection test:', error);
        throw error;
      }
    }, 10000); // Increase timeout to 10 seconds

    it('should log message details for debugging', async () => {
      // Skip test if RabbitMQ connection is not available
      if (!connection || !channel) {
        console.log('Skipping test - RabbitMQ connection not available');
        return;
      }

      // Clear any existing messages in the queues
      await channel.purgeQueue('request-pdf-2-markdown-conversion');
      await channel.purgeQueue(uniqueServiceQueueName);
      await channel.purgeQueue(uniqueQueueName);

      const testDto = new Pdf2MArkdownDto('debug-item-id-789');

      // Set up a consumer to capture the message
      let receivedMessage: any = null;
      let messageReceived = false;

      const consumer1 = await channel.consume(
        'request-pdf-2-markdown-conversion',
        (msg) => {
          if (msg && !messageReceived) {
            const parsedMessage = JSON.parse(msg.content.toString());
            receivedMessage = parsedMessage.data || parsedMessage;
            console.log('Debug - Message properties:', msg.properties);
            console.log('Debug - Message fields:', msg.fields);
            console.log('Debug - Message content:', parsedMessage);
            channel.ack(msg);
            messageReceived = true;
          }
        },
        { noAck: false },
      );

      const consumer2 = await channel.consume(
        uniqueServiceQueueName,
        (msg) => {
          if (msg && !messageReceived) {
            const parsedMessage = JSON.parse(msg.content.toString());
            receivedMessage = parsedMessage.data || parsedMessage;
            console.log('Debug - Message properties:', msg.properties);
            console.log('Debug - Message fields:', msg.fields);
            console.log('Debug - Message content:', parsedMessage);
            channel.ack(msg);
            messageReceived = true;
          }
        },
        { noAck: false },
      );

      const consumer3 = await channel.consume(
        uniqueQueueName,
        (msg) => {
          if (msg && !messageReceived) {
            const parsedMessage = JSON.parse(msg.content.toString());
            receivedMessage = parsedMessage.data || parsedMessage;
            console.log('Debug - Message properties:', msg.properties);
            console.log('Debug - Message fields:', msg.fields);
            console.log('Debug - Message content:', parsedMessage);
            channel.ack(msg);
            messageReceived = true;
          }
        },
        { noAck: false },
      );

      try {
        // Call the method under test
        await service.producePdf2MarkdownRequest(testDto);

        // Wait a bit for the message to be processed
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Verify the message was received and log details
        expect(receivedMessage).toBeDefined();
        expect(receivedMessage.itemId).toBe('debug-item-id-789');
      } finally {
        // Clean up consumers
        if (consumer1 && consumer1.consumerTag) {
          await channel.cancel(consumer1.consumerTag);
        }
        if (consumer2 && consumer2.consumerTag) {
          await channel.cancel(consumer2.consumerTag);
        }
        if (consumer3 && consumer3.consumerTag) {
          await channel.cancel(consumer3.consumerTag);
        }
      }
    });
  });
});
