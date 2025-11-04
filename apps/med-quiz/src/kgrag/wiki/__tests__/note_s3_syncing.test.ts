import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { MongoClient } from 'mongodb';
import { S3SyncService, NoteS3SyncConfig } from '../note_s3_syncing';

// Mock AWS SDK
vi.mock('@aws-sdk/client-s3', () => {
  return {
    S3Client: vi.fn(),
    ListObjectsV2Command: vi.fn(),
    GetObjectCommand: vi.fn(),
    HeadObjectCommand: vi.fn(),
  };
});

// Mock MongoDB
vi.mock('mongodb', () => {
  return {
    MongoClient: vi.fn(),
  };
});

describe('S3SyncService', () => {
  let service: S3SyncService;
  let mockS3Client: any;
  let mockMongoClient: any;
  let mockDb: any;
  let mockCollection: any;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Setup MongoDB mocks
    mockCollection = {
      find: vi.fn(),
      insertOne: vi.fn(),
    };

    mockDb = {
      collection: vi.fn().mockReturnValue(mockCollection),
    };

    mockMongoClient = {
      db: vi.fn().mockReturnValue(mockDb),
    };

    (MongoClient as any).mockImplementation(() => mockMongoClient);

    // Setup S3 mocks
    mockS3Client = {
      send: vi.fn(),
    };
    (S3Client as any).mockImplementation(() => mockS3Client);

    // Set environment variable
    process.env.MONGODB_URI = 'mongodb://test:27017/testdb';

    service = new S3SyncService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with S3Client and MongoClient', () => {
      expect(S3Client).toHaveBeenCalledWith({});
      expect(MongoClient).toHaveBeenCalledWith('mongodb://test:27017/testdb');
    });

    it('should not throw error immediately if MONGODB_URI is not set', () => {
      delete process.env.MONGODB_URI;
      // The non-null assertion operator (!) doesn't throw at runtime
      // The error will occur when trying to connect to MongoDB
      expect(() => new S3SyncService()).not.toThrow();
    });
  });

  describe('listS3Files', () => {
    it('should return only .md files from S3', async () => {
      const mockResponse = {
        Contents: [
          { Key: 'notes/file1.md' },
          { Key: 'notes/file2.md' },
          { Key: 'notes/subfolder/file3.md' },
          { Key: 'notes/file.txt' },
          { Key: 'notes/document.pdf' },
          { Key: 'notes/README' },
        ],
      };
      mockS3Client.send.mockResolvedValue(mockResponse);

      const result = await (service as any).listS3Files(
        'test-bucket',
        'notes/',
      );

      expect(ListObjectsV2Command).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Prefix: 'notes/',
      });
      expect(mockS3Client.send).toHaveBeenCalled();
      expect(result).toEqual([
        'notes/file1.md',
        'notes/file2.md',
        'notes/subfolder/file3.md',
      ]);
    });

    it('should return only .md files regardless of case', async () => {
      const mockResponse = {
        Contents: [
          { Key: 'notes/file1.MD' },
          { Key: 'notes/file2.Md' },
          { Key: 'notes/file3.mD' },
          { Key: 'notes/file4.TXT' },
        ],
      };
      mockS3Client.send.mockResolvedValue(mockResponse);

      const result = await (service as any).listS3Files(
        'test-bucket',
        'notes/',
      );

      expect(result).toEqual([
        'notes/file1.MD',
        'notes/file2.Md',
        'notes/file3.mD',
      ]);
    });

    it('should return empty array when no .md files found', async () => {
      const mockResponse = {
        Contents: [
          { Key: 'notes/file.txt' },
          { Key: 'notes/document.pdf' },
          { Key: 'notes/README' },
        ],
      };
      mockS3Client.send.mockResolvedValue(mockResponse);

      const result = await (service as any).listS3Files(
        'test-bucket',
        'notes/',
      );

      expect(result).toEqual([]);
    });

    it('should return empty array when no files found', async () => {
      mockS3Client.send.mockResolvedValue({});

      const result = await (service as any).listS3Files(
        'test-bucket',
        'notes/',
      );

      expect(result).toEqual([]);
    });

    it('should handle S3 errors', async () => {
      mockS3Client.send.mockRejectedValue(new Error('S3 Error'));

      await expect(
        (service as any).listS3Files('test-bucket', 'notes/'),
      ).rejects.toThrow('S3 Error');
    });
  });

  describe('downloadFromS3', () => {
    it('should download file content from S3', async () => {
      const mockBuffer = Buffer.from('test content');
      const mockResponse = {
        Body: {
          transformToByteArray: vi
            .fn()
            .mockResolvedValue(new Uint8Array(mockBuffer)),
        },
      };
      mockS3Client.send.mockResolvedValue(mockResponse);

      const result = await (service as any).downloadFromS3(
        'test-bucket',
        'notes/file.md',
      );

      expect(GetObjectCommand).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'notes/file.md',
      });
      expect(result).toEqual(mockBuffer);
    });

    it('should throw error when response body is undefined', async () => {
      mockS3Client.send.mockResolvedValue({ Body: undefined });

      await expect(
        (service as any).downloadFromS3('test-bucket', 'notes/file.md'),
      ).rejects.toThrow('S3 response body is undefined');
    });

    it('should handle S3 download errors', async () => {
      mockS3Client.send.mockRejectedValue(new Error('Download failed'));

      await expect(
        (service as any).downloadFromS3('test-bucket', 'notes/file.md'),
      ).rejects.toThrow('Download failed');
    });
  });

  describe('generateSyncPlan', () => {
    it('should generate sync plan for download-only', async () => {
      const s3Files = ['notes/file1.md', 'notes/file2.md'];
      const mongoNotes = [
        { key: 'notes/file1.md', content: 'existing content' },
      ];

      // Mock listS3Files
      vi.spyOn(service as any, 'listS3Files').mockResolvedValue(s3Files);

      // Mock MongoDB find
      mockCollection.find.mockReturnValue({
        toArray: vi.fn().mockResolvedValue(mongoNotes),
      });

      const config: NoteS3SyncConfig = {
        s3Bucket: 'test-bucket',
        s3Prefix: 'notes/',
        mongoCollection: 'notes',
        syncDirection: 'download-only',
      };

      const result = await (service as any).generateSyncPlan(config);

      expect(result).toEqual({
        filesToDownload: ['notes/file2.md'],
        filesToUpload: [],
      });
    });

    it('should handle empty S3 files', async () => {
      vi.spyOn(service as any, 'listS3Files').mockResolvedValue([]);
      mockCollection.find.mockReturnValue({
        toArray: vi.fn().mockResolvedValue([]),
      });

      const config: NoteS3SyncConfig = {
        s3Bucket: 'test-bucket',
        s3Prefix: 'notes/',
        mongoCollection: 'notes',
        syncDirection: 'download-only',
      };

      const result = await (service as any).generateSyncPlan(config);

      expect(result).toEqual({
        filesToDownload: [],
        filesToUpload: [],
      });
    });

    it('should handle all files already existing in MongoDB', async () => {
      const s3Files = ['notes/file1.md', 'notes/file2.md'];
      const mongoNotes = [
        { key: 'notes/file1.md', content: 'content1' },
        { key: 'notes/file2.md', content: 'content2' },
      ];

      vi.spyOn(service as any, 'listS3Files').mockResolvedValue(s3Files);
      mockCollection.find.mockReturnValue({
        toArray: vi.fn().mockResolvedValue(mongoNotes),
      });

      const config: NoteS3SyncConfig = {
        s3Bucket: 'test-bucket',
        s3Prefix: 'notes/',
        mongoCollection: 'notes',
        syncDirection: 'download-only',
      };

      const result = await (service as any).generateSyncPlan(config);

      expect(result).toEqual({
        filesToDownload: [],
        filesToUpload: [],
      });
    });
  });

  describe('sync', () => {
    it('should sync files from S3 to MongoDB', async () => {
      const config: NoteS3SyncConfig = {
        s3Bucket: 'test-bucket',
        s3Prefix: 'notes/',
        mongoCollection: 'notes',
        syncDirection: 'download-only',
      };

      const syncPlan = {
        filesToDownload: ['notes/new-file.md'],
        filesToUpload: [],
      };

      const fileContent = Buffer.from('new file content');

      // Mock generateSyncPlan
      vi.spyOn(service as any, 'generateSyncPlan').mockResolvedValue(syncPlan);

      // Mock downloadFromS3
      vi.spyOn(service as any, 'downloadFromS3').mockResolvedValue(fileContent);

      // Mock insertOne
      mockCollection.insertOne.mockResolvedValue({ insertedId: 'mock-id' });

      await service.sync(config);

      expect(mockCollection.insertOne).toHaveBeenCalledWith({
        key: 'notes/new-file.md',
        content: 'new file content',
        lastModified: expect.any(Date),
      });
    });

    it('should throw error for unsupported sync directions', async () => {
      const config: NoteS3SyncConfig = {
        s3Bucket: 'test-bucket',
        s3Prefix: 'notes/',
        mongoCollection: 'notes',
        syncDirection: 'upload-only',
      };

      await expect(service.sync(config)).rejects.toThrow(
        'Only download-only sync is currently supported',
      );
    });

    it('should handle multiple file downloads', async () => {
      const config: NoteS3SyncConfig = {
        s3Bucket: 'test-bucket',
        s3Prefix: 'notes/',
        mongoCollection: 'notes',
        syncDirection: 'download-only',
      };

      const syncPlan = {
        filesToDownload: ['notes/file1.md', 'notes/file2.md'],
        filesToUpload: [],
      };

      vi.spyOn(service as any, 'generateSyncPlan').mockResolvedValue(syncPlan);
      vi.spyOn(service as any, 'downloadFromS3')
        .mockResolvedValueOnce(Buffer.from('content1'))
        .mockResolvedValueOnce(Buffer.from('content2'));

      mockCollection.insertOne.mockResolvedValue({ insertedId: 'mock-id' });

      await service.sync(config);

      expect(mockCollection.insertOne).toHaveBeenCalledTimes(2);
      expect(mockCollection.insertOne).toHaveBeenNthCalledWith(1, {
        key: 'notes/file1.md',
        content: 'content1',
        lastModified: expect.any(Date),
      });
      expect(mockCollection.insertOne).toHaveBeenNthCalledWith(2, {
        key: 'notes/file2.md',
        content: 'content2',
        lastModified: expect.any(Date),
      });
    });

    it('should handle download errors gracefully', async () => {
      const config: NoteS3SyncConfig = {
        s3Bucket: 'test-bucket',
        s3Prefix: 'notes/',
        mongoCollection: 'notes',
        syncDirection: 'download-only',
      };

      const syncPlan = {
        filesToDownload: ['notes/file1.md'],
        filesToUpload: [],
      };

      vi.spyOn(service as any, 'generateSyncPlan').mockResolvedValue(syncPlan);
      vi.spyOn(service as any, 'downloadFromS3').mockRejectedValue(
        new Error('Download failed'),
      );

      await expect(service.sync(config)).rejects.toThrow('Download failed');
    });

    it('should handle MongoDB insert errors', async () => {
      const config: NoteS3SyncConfig = {
        s3Bucket: 'test-bucket',
        s3Prefix: 'notes/',
        mongoCollection: 'notes',
        syncDirection: 'download-only',
      };

      const syncPlan = {
        filesToDownload: ['notes/file1.md'],
        filesToUpload: [],
      };

      vi.spyOn(service as any, 'generateSyncPlan').mockResolvedValue(syncPlan);
      vi.spyOn(service as any, 'downloadFromS3').mockResolvedValue(
        Buffer.from('content'),
      );
      mockCollection.insertOne.mockRejectedValue(new Error('MongoDB Error'));

      await expect(service.sync(config)).rejects.toThrow('MongoDB Error');
    });
  });

  describe('integration scenarios', () => {
    it('should complete full sync workflow', async () => {
      const config: NoteS3SyncConfig = {
        s3Bucket: 'test-bucket',
        s3Prefix: 'notes/',
        mongoCollection: 'notes',
        syncDirection: 'download-only',
      };

      // Mock S3 responses
      mockS3Client.send
        .mockResolvedValueOnce({
          Contents: [{ Key: 'notes/existing.md' }, { Key: 'notes/new.md' }],
        })
        .mockResolvedValueOnce({
          Body: {
            transformToByteArray: vi
              .fn()
              .mockResolvedValue(new Uint8Array(Buffer.from('new content'))),
          },
        });

      // Mock MongoDB responses
      mockCollection.find.mockReturnValue({
        toArray: vi
          .fn()
          .mockResolvedValue([
            { key: 'notes/existing.md', content: 'existing content' },
          ]),
      });
      mockCollection.insertOne.mockResolvedValue({ insertedId: 'mock-id' });

      await service.sync(config);

      expect(mockCollection.insertOne).toHaveBeenCalledWith({
        key: 'notes/new.md',
        content: 'new content',
        lastModified: expect.any(Date),
      });
    });
  });

  describe('file comparison methods', () => {
    describe('getFileMetadata', () => {
      it('should return file metadata from S3', async () => {
        const mockMetadata = {
          etag: '"abc123def456"',
          lastModified: new Date('2024-01-01'),
          contentLength: 1024,
          contentType: 'text/markdown',
        };
        const mockResponse = {
          ETag: '"abc123def456"',
          LastModified: new Date('2024-01-01'),
          ContentLength: 1024,
          ContentType: 'text/markdown',
        };
        mockS3Client.send.mockResolvedValue(mockResponse);

        const result = await service.getFileMetadata(
          'test-bucket',
          'notes/file.md',
        );

        expect(HeadObjectCommand).toHaveBeenCalledWith({
          Bucket: 'test-bucket',
          Key: 'notes/file.md',
        });
        expect(result).toEqual(mockMetadata);
      });

      it('should handle file not found errors', async () => {
        const error = new Error('NoSuchKey');
        error.name = 'NoSuchKey';
        mockS3Client.send.mockRejectedValue(error);

        await expect(
          service.getFileMetadata('test-bucket', 'nonexistent.md'),
        ).rejects.toThrow('NoSuchKey');
      });
    });

    describe('compareFileByETag', () => {
      it('should return true when ETags match', async () => {
        mockS3Client.send.mockResolvedValue({ ETag: '"abc123def456"' });

        const result = await service.compareFileByETag(
          'test-bucket',
          'notes/file.md',
          '"abc123def456"',
        );
        expect(result).toBe(true);
      });

      it('should return false when ETags do not match', async () => {
        mockS3Client.send.mockResolvedValue({ ETag: '"abc123def456"' });

        const result = await service.compareFileByETag(
          'test-bucket',
          'notes/file.md',
          '"different-etag"',
        );
        expect(result).toBe(false);
      });

      it('should return false when file does not exist', async () => {
        const error = new Error('NoSuchKey');
        error.name = 'NoSuchKey';
        mockS3Client.send.mockRejectedValue(error);

        const result = await service.compareFileByETag(
          'test-bucket',
          'nonexistent.md',
          '"etag"',
        );
        expect(result).toBe(false);
      });

      it('should throw other errors', async () => {
        mockS3Client.send.mockRejectedValue(new Error('Network error'));

        await expect(
          service.compareFileByETag('test-bucket', 'notes/file.md', '"etag"'),
        ).rejects.toThrow('Network error');
      });
    });

    describe('compareFileByLastModified', () => {
      it('should return true when last modified dates match', async () => {
        const lastModified = new Date('2024-01-01T12:00:00Z');
        mockS3Client.send.mockResolvedValue({ LastModified: lastModified });

        const result = await service.compareFileByLastModified(
          'test-bucket',
          'notes/file.md',
          lastModified,
        );
        expect(result).toBe(true);
      });

      it('should return false when last modified dates do not match', async () => {
        mockS3Client.send.mockResolvedValue({
          LastModified: new Date('2024-01-01'),
        });

        const result = await service.compareFileByLastModified(
          'test-bucket',
          'notes/file.md',
          new Date('2024-01-02'),
        );
        expect(result).toBe(false);
      });

      it('should return false when LastModified is undefined', async () => {
        mockS3Client.send.mockResolvedValue({ LastModified: undefined });

        const result = await service.compareFileByLastModified(
          'test-bucket',
          'notes/file.md',
          new Date(),
        );
        expect(result).toBe(false);
      });
    });

    describe('compareFileBySize', () => {
      it('should return true when file sizes match', async () => {
        mockS3Client.send.mockResolvedValue({ ContentLength: 1024 });

        const result = await service.compareFileBySize(
          'test-bucket',
          'notes/file.md',
          1024,
        );
        expect(result).toBe(true);
      });

      it('should return false when file sizes do not match', async () => {
        mockS3Client.send.mockResolvedValue({ ContentLength: 1024 });

        const result = await service.compareFileBySize(
          'test-bucket',
          'notes/file.md',
          2048,
        );
        expect(result).toBe(false);
      });

      it('should return false when file does not exist', async () => {
        const error = new Error('NoSuchKey');
        error.name = 'NoSuchKey';
        mockS3Client.send.mockRejectedValue(error);

        const result = await service.compareFileBySize(
          'test-bucket',
          'nonexistent.md',
          1024,
        );
        expect(result).toBe(false);
      });
    });

    describe('efficient sync with metadata comparison', () => {
      it('should use ETag comparison to avoid unnecessary downloads', async () => {
        const mockMetadata = {
          ETag: '"abc123def456"',
          LastModified: new Date('2024-01-01'),
          ContentLength: 1024,
          ContentType: 'text/markdown',
        };
        mockS3Client.send.mockResolvedValue(mockMetadata);

        // Check if file needs update
        const needsUpdate = !(await service.compareFileByETag(
          'test-bucket',
          'notes/file.md',
          '"different-etag"',
        ));
        expect(needsUpdate).toBe(true);

        // Check if file is up to date
        const isUpToDate = await service.compareFileByETag(
          'test-bucket',
          'notes/file.md',
          '"abc123def456"',
        );
        expect(isUpToDate).toBe(true);
      });
    });
  });
});
