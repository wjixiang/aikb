import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { UploadTestPdf } from '../library.integrated.test';
import { getRabbitMQService } from '../../lib/rabbitmq/rabbitmq.service';
import {
  PdfSplittingRequestMessage,
  PdfProcessingStatus,
  RABBITMQ_QUEUES,
  RABBITMQ_CONSUMER_TAGS,
} from '../../lib/rabbitmq/message.types';
import { v4 as uuidv4 } from 'uuid';

describe('Python PDF Splitting Worker Integration', () => {
  let rabbitMQService = getRabbitMQService();
  let testPdfInfo: any;
  let receivedMessages: any[] = [];

  beforeAll(async () => {
    // Initialize RabbitMQ service
    await rabbitMQService.initialize();
    
    // Upload test PDF
    console.log('Uploading test PDF...');
    const book = await UploadTestPdf();
    testPdfInfo = {
      id: book.metadata.id,
      s3Key: book.metadata.s3Key,
      s3Url: await book.getPdfDownloadUrl(),
      pageCount: book.metadata.pageCount,
    };
    
    console.log('Test PDF uploaded:', testPdfInfo);
    
    // Set up a consumer to listen for progress messages
    await rabbitMQService.consumeMessages(
      RABBITMQ_QUEUES.PDF_CONVERSION_PROGRESS,
      async (message: any, originalMessage: any) => {
        console.log('Received progress message:', message);
        receivedMessages.push(message);
        // Message will be automatically acknowledged since we're using the consumeMessages method
      },
      {
        consumerTag: 'test-python-integration',
        noAck: false,
      }
    );
  }, 60000);

  afterAll(async () => {
    // Clean up
    if (rabbitMQService.isConnected()) {
      await rabbitMQService.stopConsuming('test-python-integration');
      await rabbitMQService.close();
    }
  });

  it('should send PDF splitting request to Python worker', async () => {
    // Clear previous messages
    receivedMessages = [];
    
    // Create a PDF splitting request message
    const splittingRequest: PdfSplittingRequestMessage = {
      messageId: uuidv4(),
      timestamp: Date.now(),
      eventType: 'PDF_SPLITTING_REQUEST',
      itemId: testPdfInfo.id,
      s3Url: testPdfInfo.s3Url,
      s3Key: testPdfInfo.s3Key,
      fileName: 'viral_pneumonia.pdf',
      pageCount: testPdfInfo.pageCount,
      splitSize: 10, // Split into 10-page parts
      priority: 'normal',
      retryCount: 0,
      maxRetries: 3,
    };

    console.log('Sending PDF splitting request:', splittingRequest);

    // Publish the splitting request
    const published = await rabbitMQService.publishPdfSplittingRequest(splittingRequest);
    expect(published).toBe(true);

    // Wait for processing (give it enough time to download, split, and upload)
    console.log('Waiting for PDF splitting to complete...');
    await new Promise(resolve => setTimeout(resolve, 120000)); // 2 minutes

    // Check if we received any progress messages
    expect(receivedMessages.length).toBeGreaterThan(0);
    
    // Verify the messages contain expected status updates
    const statusMessages = receivedMessages.map(msg => msg.status);
    console.log('Received status messages:', statusMessages);
    
    // Should have received at least SPLITTING status
    expect(statusMessages).toContain(PdfProcessingStatus.SPLITTING);
    
    // Should eventually reach PROCESSING status (after splitting is complete)
    expect(statusMessages).toContain(PdfProcessingStatus.PROCESSING);
  }, 180000); // 3 minutes timeout

  it('should handle different split sizes', async () => {
    // Clear previous messages
    receivedMessages = [];
    
    // Test with a different split size
    const splittingRequest: PdfSplittingRequestMessage = {
      messageId: uuidv4(),
      timestamp: Date.now(),
      eventType: 'PDF_SPLITTING_REQUEST',
      itemId: testPdfInfo.id,
      s3Url: testPdfInfo.s3Url,
      s3Key: testPdfInfo.s3Key,
      fileName: 'viral_pneumonia.pdf',
      pageCount: testPdfInfo.pageCount,
      splitSize: 5, // Smaller split size
      priority: 'normal',
      retryCount: 0,
      maxRetries: 3,
    };

    console.log('Sending PDF splitting request with split size 5:', splittingRequest);

    // Publish the splitting request
    const published = await rabbitMQService.publishPdfSplittingRequest(splittingRequest);
    expect(published).toBe(true);

    // Wait for processing
    console.log('Waiting for PDF splitting to complete...');
    await new Promise(resolve => setTimeout(resolve, 120000)); // 2 minutes

    // Check if we received progress messages
    expect(receivedMessages.length).toBeGreaterThan(0);
    
    // Verify the messages contain expected status updates
    const statusMessages = receivedMessages.map(msg => msg.status);
    console.log('Received status messages for split size 5:', statusMessages);
    
    // Should have received at least SPLITTING status
    expect(statusMessages).toContain(PdfProcessingStatus.SPLITTING);
    
    // Should eventually reach PROCESSING status
    expect(statusMessages).toContain(PdfProcessingStatus.PROCESSING);
  }, 180000); // 3 minutes timeout

  it('should handle error cases gracefully', async () => {
    // Clear previous messages
    receivedMessages = [];
    
    // Create a request with invalid S3 URL to test error handling
    const splittingRequest: PdfSplittingRequestMessage = {
      messageId: uuidv4(),
      timestamp: Date.now(),
      eventType: 'PDF_SPLITTING_REQUEST',
      itemId: testPdfInfo.id + '-invalid',
      s3Url: 'https://invalid-url-that-does-not-exist.com/test.pdf',
      s3Key: 'invalid/test.pdf',
      fileName: 'invalid.pdf',
      pageCount: 10,
      splitSize: 5,
      priority: 'normal',
      retryCount: 0,
      maxRetries: 1, // Limit retries for this test
    };

    console.log('Sending invalid PDF splitting request to test error handling:', splittingRequest);

    // Publish the splitting request
    const published = await rabbitMQService.publishPdfSplittingRequest(splittingRequest);
    expect(published).toBe(true);

    // Wait for error handling
    console.log('Waiting for error handling...');
    await new Promise(resolve => setTimeout(resolve, 60000)); // 1 minute

    // Check if we received any error messages
    expect(receivedMessages.length).toBeGreaterThan(0);
    
    // Should have received FAILED status
    const statusMessages = receivedMessages.map(msg => msg.status);
    console.log('Received status messages for error case:', statusMessages);
    
    expect(statusMessages).toContain(PdfProcessingStatus.FAILED);
    
    // Check error message
    const failedMessage = receivedMessages.find(msg => msg.status === PdfProcessingStatus.FAILED);
    expect(failedMessage).toBeDefined();
    expect(failedMessage.error).toBeDefined();
    console.log('Error message:', failedMessage.error);
  }, 120000); // 2 minutes timeout
});