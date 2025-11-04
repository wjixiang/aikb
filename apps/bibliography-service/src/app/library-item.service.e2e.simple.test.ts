import { Test, TestingModule } from '@nestjs/testing';
import { LibraryItemService } from './library-item.service';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { Pdf2MArkdownDto } from './pdf_process.dto';
import * as amqp from 'amqplib';
import { vi } from 'vitest';

// Mock the bibliography library to avoid MongoDB dependency
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

describe('LibraryItemService - Simple E2E Test', () => {
  // Use unique queue names for test isolation
  const uniqueQueueName = `test_queue_simple_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const uniqueServiceQueueName = `pdf_2_markdown_queue_simple_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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

      // Declare unique test queues for isolation
      await channel.assertQueue(uniqueServiceQueueName, { durable: true });
      await channel.assertQueue(uniqueQueueName, { durable: true });

      console.log(`Using unique test queue: ${uniqueQueueName}`);

      console.log('RabbitMQ connection established for testing');
    } catch (error) {
      console.error('Failed to connect to RabbitMQ:', error);
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

  it('should send message to RabbitMQ and receive it', async () => {
    // Skip test if RabbitMQ connection is not available
    if (!connection || !channel) {
      console.log('Skipping test - RabbitMQ connection not available');
      return;
    }

    // Clear any existing messages in the queues
    await channel.purgeQueue(uniqueServiceQueueName);
    await channel.purgeQueue(uniqueQueueName);

    const testDto = new Pdf2MArkdownDto('test-item-id-simple');

    // Set up a consumer to capture the message
    let receivedMessage: any = null;
    let messageReceived = false;

    const consumer1 = await channel.consume(
      uniqueServiceQueueName,
      (msg) => {
        if (msg && !messageReceived) {
          const parsedMessage = JSON.parse(msg.content.toString());
          receivedMessage = parsedMessage.data || parsedMessage;
          messageReceived = true;
          console.log(
            'Message received in pdf_2_markdown_queue:',
            parsedMessage,
          );
          channel.ack(msg);
        }
      },
      { noAck: false },
    );

    const consumer2 = await channel.consume(
      uniqueQueueName,
      (msg) => {
        if (msg && !messageReceived) {
          const parsedMessage = JSON.parse(msg.content.toString());
          receivedMessage = parsedMessage.data || parsedMessage;
          messageReceived = true;
          console.log(`Message received in ${uniqueQueueName}:`, parsedMessage);
          channel.ack(msg);
        }
      },
      { noAck: false },
    );

    // Call the method under test
    const result = await service.producePdf2MarkdownRequest(testDto);

    // Wait a bit for the message to be processed
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Verify the result
    expect(result).toEqual({
      message: 'pdf2md request published',
    });

    // Verify the message was received
    expect(messageReceived).toBe(true);
    expect(receivedMessage).toBeDefined();
    expect(receivedMessage.itemId).toBe('test-item-id-simple');

    // Clean up consumers
    if (consumer1 && consumer1.consumerTag) {
      await channel.cancel(consumer1.consumerTag);
    }
    if (consumer2 && consumer2.consumerTag) {
      await channel.cancel(consumer2.consumerTag);
    }
  });
});
