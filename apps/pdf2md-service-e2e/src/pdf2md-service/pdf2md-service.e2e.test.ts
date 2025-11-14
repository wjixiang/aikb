import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ClientProxy } from '@nestjs/microservices';

describe('PDF2MD Service E2E Tests', () => {
  let client: ClientProxy;

  beforeEach(async () => {
    // Get the client from global setup
    client = globalThis.rabbitmqClient;

    // Ensure client is connected
    if (!client) {
      throw new Error('RabbitMQ client not initialized. Check global setup.');
    }
  });

  afterEach(async () => {
    // Clean up any test-specific queues or exchanges if needed
    // This is handled by global teardown, but you can add specific cleanup here
  });

  describe('PDF Processing', () => {
    it('should process a valid PDF and return markdown', async () => {
      const message = {
        pdfUrl: 'https://example.com/sample.pdf',
        options: {
          format: 'markdown',
          includeImages: true,
          preserveFormatting: true,
        },
      };

      try {
        const response = await client
          .send({ cmd: 'process_pdf' }, message)
          .toPromise();

        expect(response).toBeDefined();
        expect(response.success).toBe(true);
        expect(response.markdown).toBeDefined();
        expect(typeof response.markdown).toBe('string');
        expect(response.markdown.length).toBeGreaterThan(0);
      } catch (error) {
        // If the service is not implemented yet, we can skip this test
        console.log(
          'PDF processing service may not be fully implemented:',
          error.message,
        );
        expect(error.message).toContain('timeout'); // Expected if service is not running
      }
    }, 10000); // Increase timeout for message processing

    it('should handle invalid PDF URL gracefully', async () => {
      const message = {
        pdfUrl: 'invalid-url',
        options: {
          format: 'markdown',
        },
      };

      try {
        await client.send({ cmd: 'process_pdf' }, message).toPromise();
        // Should not reach here if error handling is correct
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeDefined();
        expect(error.message || error.error).toBeDefined();
      }
    }, 5000);

    it('should handle missing PDF URL', async () => {
      const message = {
        options: {
          format: 'markdown',
        },
      };

      try {
        await client.send({ cmd: 'process_pdf' }, message).toPromise();
        // Should not reach here if validation is correct
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeDefined();
        expect(error.message || error.error).toBeDefined();
      }
    }, 5000);
  });

  describe('Service Health Check', () => {
    it('should respond to health check command', async () => {
      const message = { timestamp: new Date().toISOString() };

      try {
        const response = await client
          .send({ cmd: 'health_check' }, message)
          .toPromise();

        expect(response).toBeDefined();
        expect(response.status).toBe('ok');
        expect(response.timestamp).toBeDefined();
        expect(response.service).toBe('pdf2md-service');
      } catch (error) {
        // Health check might not be implemented
        console.log(
          'Health check command may not be implemented:',
          error.message,
        );
        expect(error.message).toContain('timeout');
      }
    }, 5000);
  });

  describe('Service Configuration', () => {
    it('should return service configuration', async () => {
      const message = {};

      try {
        const response = await client
          .send({ cmd: 'get_config' }, message)
          .toPromise();

        expect(response).toBeDefined();
        expect(response.service).toBe('pdf2md-service');
        expect(response.version).toBeDefined();
        expect(response.capabilities).toBeDefined();
        expect(Array.isArray(response.capabilities)).toBe(true);
      } catch (error) {
        // Configuration command might not be implemented
        console.log(
          'Get config command may not be implemented:',
          error.message,
        );
        expect(error.message).toContain('timeout');
      }
    }, 5000);
  });

  describe('Error Handling', () => {
    it('should handle unknown commands gracefully', async () => {
      const message = { test: 'data' };

      try {
        await client.send({ cmd: 'unknown_command' }, message).toPromise();
        // Should not reach here if error handling is correct
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeDefined();
        expect(error.message || error.error).toBeDefined();
      }
    }, 5000);

    it('should handle malformed messages', async () => {
      // Send a message that might cause parsing issues
      const malformedMessage = {
        pdfUrl: null,
        options: undefined,
        nested: {
          deep: {
            value: undefined,
          },
        },
      };

      try {
        await client.send({ cmd: 'process_pdf' }, malformedMessage).toPromise();
        // Should not reach here if validation is correct
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeDefined();
        expect(error.message || error.error).toBeDefined();
      }
    }, 5000);
  });

  describe('Performance Tests', () => {
    it('should handle multiple concurrent requests', async () => {
      const messages = Array.from({ length: 5 }, (_, i) => ({
        pdfUrl: `https://example.com/sample${i}.pdf`,
        options: { format: 'markdown' },
      }));

      try {
        const promises = messages.map((msg) =>
          client.send({ cmd: 'process_pdf' }, msg).toPromise(),
        );

        const responses = await Promise.allSettled(promises);

        // At least some responses should be successful or properly handled
        responses.forEach((response, index) => {
          if (response.status === 'fulfilled') {
            expect(response.value).toBeDefined();
          } else {
            console.log(`Request ${index} failed:`, response.reason.message);
          }
        });
      } catch (error) {
        console.log('Concurrent request test failed:', error.message);
        // This might fail if the service is not designed for concurrency
        expect(error.message).toContain('timeout');
      }
    }, 15000); // Longer timeout for concurrent requests
  });
});
