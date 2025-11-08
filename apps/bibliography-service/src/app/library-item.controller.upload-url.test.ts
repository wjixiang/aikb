import { Test, TestingModule } from '@nestjs/testing';
import { LibraryItemController } from './library-item.controller';
import { LibraryItemService } from './library-item.service';
import { PdfUploadUrlResponseDto } from 'library-shared';
import { vi } from 'vitest';

describe('LibraryItemController - Upload URL', () => {
  let controller: LibraryItemController;
  let service: LibraryItemService;

  const mockLibraryItemService = {
    getPdfUploadUrl: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LibraryItemController],
      providers: [
        {
          provide: LibraryItemService,
          useValue: mockLibraryItemService,
        },
      ],
    }).compile();

    controller = module.get<LibraryItemController>(LibraryItemController);
    service = module.get<LibraryItemService>(LibraryItemService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getUploadUrl', () => {
    it('should return a PDF upload URL', async () => {
      const mockResponse: PdfUploadUrlResponseDto = {
        uploadUrl: 'https://example-bucket.s3.amazonaws.com/presigned-upload-url',
        s3Key: 'library/pdfs/2023/1234567890-test-file.pdf',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      };

      mockLibraryItemService.getPdfUploadUrl.mockResolvedValue(mockResponse);

      const result = await controller.getUploadUrl({
        fileName: 'test-file.pdf',
        expiresIn: 3600,
      });

      expect(service.getPdfUploadUrl).toHaveBeenCalledWith({
        fileName: 'test-file.pdf',
        expiresIn: 3600,
      });
      expect(result).toEqual(mockResponse);
    });

    it('should use default expiration time when not provided', async () => {
      const mockResponse: PdfUploadUrlResponseDto = {
        uploadUrl: 'https://example-bucket.s3.amazonaws.com/presigned-upload-url',
        s3Key: 'library/pdfs/2023/1234567890-test-file.pdf',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      };

      mockLibraryItemService.getPdfUploadUrl.mockResolvedValue(mockResponse);

      await controller.getUploadUrl({
        fileName: 'test-file.pdf',
      });

      expect(service.getPdfUploadUrl).toHaveBeenCalledWith({
        fileName: 'test-file.pdf',
      });
    });

    it('should throw an error when service fails', async () => {
      const errorMessage = 'Failed to generate upload URL';
      mockLibraryItemService.getPdfUploadUrl.mockRejectedValue(new Error(errorMessage));

      await expect(controller.getUploadUrl({
        fileName: 'test-file.pdf',
      })).rejects.toThrow(`Failed to get PDF upload URL: ${errorMessage}`);
    });
  });
});