import { app_config } from 'knowledgeBase/config';
import { MinerUClient } from '../MinerU/MinerUClient';
import { MinerUPdfConvertor } from '../MinerU/MinerUPdfConvertor';
import { config } from 'dotenv';
config();

/**
 * Basic tests for MinerU client and converter
 * Note: These tests require a valid MinerU token to run
 */

describe('MinerU Client', () => {
  const TEST_TOKEN = process.env.MINERU_TOKEN || 'test-token';

  describe('Constructor', () => {
    it('should create client with token', () => {
      const client = new MinerUClient(app_config.MinerU);
      expect(client).toBeInstanceOf(MinerUClient);
    });

    it('should throw error without token', () => {
      expect(
        () => new MinerUClient({ ...app_config.MinerU, token: '' }),
      ).toThrow('Token is required');
    });

    it('should accept custom configuration', () => {
      const client = new MinerUClient({
        ...app_config.MinerU,
        token: TEST_TOKEN,
        baseUrl: 'https://custom-url.com',
        timeout: 60000,
        maxRetries: 5,
      });
      expect(client).toBeInstanceOf(MinerUClient);
    });
  });

  describe('Static methods', () => {
    it('should validate file formats correctly', () => {
      expect(MinerUClient.isValidFileFormat('document.pdf')).toBe(true);
      expect(MinerUClient.isValidFileFormat('image.jpg')).toBe(true);
      expect(MinerUClient.isValidFileFormat('presentation.pptx')).toBe(true);
      expect(MinerUClient.isValidFileFormat('text.txt')).toBe(false);
      expect(MinerUClient.isValidFileFormat('video.mp4')).toBe(false);
    });

    it('should return supported languages', () => {
      const languages = MinerUClient.getSupportedLanguages();
      expect(languages).toContain('ch');
      expect(languages).toContain('en');
      expect(languages).toContain('japan');
      expect(languages.length).toBeGreaterThan(10);
    });
  });
});

describe('MinerU PDF Converter', () => {
  const TEST_TOKEN = process.env.MINERU_TOKEN || 'test-token';

  describe('Constructor', () => {
    it('should create converter with token', () => {
      const converter = new MinerUPdfConvertor({ token: TEST_TOKEN });
      expect(converter).toBeInstanceOf(MinerUPdfConvertor);
    });

    it('should accept custom configuration', () => {
      const converter = new MinerUPdfConvertor({
        token: TEST_TOKEN,
        downloadDir: './test-downloads',
        defaultOptions: {
          is_ocr: true,
          enable_formula: false,
          language: 'en',
        },
      });
      expect(converter).toBeInstanceOf(MinerUPdfConvertor);
    });
  });

  describe('File management', () => {
    it('should manage download directory', () => {
      const converter = new MinerUPdfConvertor({ token: TEST_TOKEN });

      const originalDir = converter.getDownloadDirectory();
      expect(typeof originalDir).toBe('string');

      const newDir = './custom-downloads';
      converter.setDownloadDirectory(newDir);
      expect(converter.getDownloadDirectory()).toBe(newDir);
    });
  });
});

describe('Integration tests (requires valid token)', () => {
  const token = process.env.MINERU_TOKEN;

  if (!token) {
    console.warn('Skipping integration tests - MINERU_TOKEN not set');
    return;
  }

  let client: MinerUClient;
  let converter: MinerUPdfConvertor;

  beforeAll(() => {
    client = new MinerUClient(app_config.MinerU);
    converter = new MinerUPdfConvertor({
      token,
      downloadDir: './test-downloads',
    });
  });

  afterAll(async () => {
    // Cleanup test downloads
    await converter.cleanupDownloadedFiles(0);
  });

  describe('API connectivity', () => {
    it('should validate token format', () => {
      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
    });

    // Note: These tests would require actual API calls
    // They are commented out to avoid hitting the API during testing

    /*
    it('should create single file task', async () => {
      const taskId = await client.createSingleFileTask({
        url: 'https://cdn-mineru.openxlab.org.cn/demo/example.pdf',
        is_ocr: true,
        data_id: 'test-task'
      });
      
      expect(typeof taskId).toBe('string');
      expect(taskId.length).toBeGreaterThan(0);
    }, 30000);

    it('should get task status', async () => {
      // First create a task
      const taskId = await client.createSingleFileTask({
        url: 'https://cdn-mineru.openxlab.org.cn/demo/example.pdf',
        is_ocr: true,
        data_id: 'test-status'
      });
      
      // Then get status
      const status = await client.getTaskResult(taskId);
      expect(status).toHaveProperty('task_id', taskId);
      expect(status).toHaveProperty('state');
    }, 30000);
    */
  });
});

describe('Error handling', () => {
  it('should handle invalid token gracefully', () => {
    expect(() => {
      new MinerUClient({ ...app_config.MinerU, token: 'invalid-token-format' });
    }).not.toThrow();
  });

  it('should create converter with minimal config', () => {
    const converter = new MinerUPdfConvertor({
      token: 'test-token',
    });
    expect(converter).toBeInstanceOf(MinerUPdfConvertor);
  });
});
