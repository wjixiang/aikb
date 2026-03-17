/**
 * GeneratorController Unit Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { GeneratorController } from './generator.controller.js';
import { GeneratorService } from './generator.service.js';
import { GenerateCaseDto } from './dto/generate-case.dto.js';
import { BatchGenerateDto } from './dto/batch-generate.dto.js';
import { GenerateLongCaseDto } from './dto/generate-long-case.dto.js';
import type { GenerationJob, GenerationJobStatus } from './interfaces/generator.interface.js';
import type { GeneratedCase } from '../types/generator.type.js';

describe('GeneratorController', () => {
  let controller: GeneratorController;
  let service: jest.Mocked<GeneratorService>;

  const mockGeneratedCase: GeneratedCase = {
    content: '# 病历内容\n\n患者主诉：腹痛',
    metadata: {
      department: '普外科',
      disease: '急性阑尾炎',
      caseType: 'A型',
      generatedAt: '2024-03-17T10:00:00.000Z',
    },
  };

  const mockGenerationJob: GenerationJob = {
    id: 'job-123',
    type: 'batch',
    status: 'running' as GenerationJobStatus,
    total: 5,
    completed: 2,
    failed: 0,
    results: [mockGeneratedCase],
    errors: [],
    createdAt: new Date('2024-03-17T10:00:00Z'),
  };

  beforeEach(async () => {
    const mockGeneratorService = {
      generateCase: jest.fn(),
      batchGenerate: jest.fn(),
      generateLongCase: jest.fn(),
      getJobStatus: jest.fn(),
      getAllJobs: jest.fn(),
      getTemplates: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [GeneratorController],
      providers: [
        {
          provide: GeneratorService,
          useValue: mockGeneratorService,
        },
      ],
    }).compile();

    controller = module.get<GeneratorController>(GeneratorController);
    service = module.get(GeneratorService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateCase', () => {
    it('should generate a single case', async () => {
      const dto: GenerateCaseDto = {
        department: '普外科',
        disease: '急性阑尾炎',
        patientName: '张三',
        gender: '男',
        caseType: 'A型',
      };

      service.generateCase.mockResolvedValue(mockGeneratedCase);

      const result = await controller.generateCase(dto);

      expect(service.generateCase).toHaveBeenCalledWith(
        expect.objectContaining({
          department: '普外科',
          disease: '急性阑尾炎',
          patientName: '张三',
          gender: '男',
          caseType: 'A型',
        })
      );
      expect(result.success).toBe(true);
      expect(result.data.content).toBe(mockGeneratedCase.content);
      expect(result.data.metadata.department).toBe('普外科');
      expect(result.data.metadata.disease).toBe('急性阑尾炎');
    });

    it('should return error response when generation fails', async () => {
      const dto: GenerateCaseDto = {
        department: '普外科',
      };

      service.generateCase.mockRejectedValue(new Error('Generation failed'));

      const result = await controller.generateCase(dto);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Generation failed');
    });

    it('should generate case with minimal options', async () => {
      const dto: GenerateCaseDto = {};

      service.generateCase.mockResolvedValue(mockGeneratedCase);

      const result = await controller.generateCase(dto);

      expect(service.generateCase).toHaveBeenCalledWith({});
      expect(result.success).toBe(true);
    });

    it('should pass ageRange to service', async () => {
      const dto: GenerateCaseDto = {
        department: '心内科',
        ageRange: {
          min: 30,
          max: 60,
        },
      };

      service.generateCase.mockResolvedValue(mockGeneratedCase);

      await controller.generateCase(dto);

      expect(service.generateCase).toHaveBeenCalledWith(
        expect.objectContaining({
          department: '心内科',
          ageRange: { min: 30, max: 60 },
        })
      );
    });

    it('should pass anonymize option to service', async () => {
      const dto: GenerateCaseDto = {
        department: '普外科',
        anonymize: true,
      };

      service.generateCase.mockResolvedValue(mockGeneratedCase);

      await controller.generateCase(dto);

      expect(service.generateCase).toHaveBeenCalledWith(
        expect.objectContaining({
          department: '普外科',
          anonymize: true,
        })
      );
    });
  });

  describe('batchGenerate', () => {
    it('should start batch generation job', async () => {
      const dto: BatchGenerateDto = {
        count: 5,
        options: {
          department: '普外科',
          disease: '急性阑尾炎',
        },
      };

      service.batchGenerate.mockResolvedValue(mockGenerationJob);

      const result = await controller.batchGenerate(dto);

      expect(service.batchGenerate).toHaveBeenCalledWith(
        5,
        expect.objectContaining({
          department: '普外科',
          disease: '急性阑尾炎',
        })
      );
      expect(result.success).toBe(true);
      expect(result.job.id).toBe('job-123');
      expect(result.job.total).toBe(5);
    });

    it('should start batch generation without options', async () => {
      const dto: BatchGenerateDto = {
        count: 3,
      };

      service.batchGenerate.mockResolvedValue({
        ...mockGenerationJob,
        id: 'job-456',
        total: 3,
      });

      const result = await controller.batchGenerate(dto);

      expect(service.batchGenerate).toHaveBeenCalledWith(3, {});
      expect(result.success).toBe(true);
      expect(result.job.total).toBe(3);
    });

    it('should throw BadRequestException on error', async () => {
      const dto: BatchGenerateDto = {
        count: 5,
      };

      service.batchGenerate.mockRejectedValue(new Error('Invalid count'));

      await expect(controller.batchGenerate(dto)).rejects.toThrow(BadRequestException);
    });

    it('should handle batch generation with all options', async () => {
      const dto: BatchGenerateDto = {
        count: 10,
        options: {
          department: '骨科',
          disease: '骨折',
          patientName: '测试患者',
          gender: '女',
          caseType: 'B型',
          ageRange: { min: 20, max: 50 },
          anonymize: false,
        },
      };

      service.batchGenerate.mockResolvedValue({
        ...mockGenerationJob,
        id: 'job-789',
        total: 10,
      });

      const result = await controller.batchGenerate(dto);

      expect(service.batchGenerate).toHaveBeenCalledWith(
        10,
        expect.objectContaining({
          department: '骨科',
          disease: '骨折',
          patientName: '测试患者',
          gender: '女',
          caseType: 'B型',
          ageRange: { min: 20, max: 50 },
          anonymize: false,
        })
      );
      expect(result.job.total).toBe(10);
    });
  });

  describe('generateLongCase', () => {
    it('should generate a long case', async () => {
      const dto: GenerateLongCaseDto = {
        department: '普外科',
        disease: '急性阑尾炎',
        patientName: '李四',
        gender: '女',
        caseType: 'B型',
      };

      const longCaseResult = {
        ...mockGeneratedCase,
        content: '# 详细病历\n\n（约3000字内容）',
      };

      service.generateLongCase.mockResolvedValue(longCaseResult);

      const result = await controller.generateLongCase(dto);

      expect(service.generateLongCase).toHaveBeenCalledWith(
        expect.objectContaining({
          department: '普外科',
          disease: '急性阑尾炎',
          patientName: '李四',
          gender: '女',
          caseType: 'B型',
        })
      );
      expect(result.success).toBe(true);
    });

    it('should return error response when long case generation fails', async () => {
      const dto: GenerateLongCaseDto = {
        department: '心内科',
      };

      service.generateLongCase.mockRejectedValue(new Error('Long case generation failed'));

      const result = await controller.generateLongCase(dto);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Long case generation failed');
    });

    it('should generate long case with minimal options', async () => {
      const dto: GenerateLongCaseDto = {};

      service.generateLongCase.mockResolvedValue(mockGeneratedCase);

      const result = await controller.generateLongCase(dto);

      expect(service.generateLongCase).toHaveBeenCalledWith({});
      expect(result.success).toBe(true);
    });

    it('should pass ageRange to service for long case', async () => {
      const dto: GenerateLongCaseDto = {
        department: '呼吸内科',
        disease: '肺炎',
        ageRange: { min: 40, max: 70 },
      };

      service.generateLongCase.mockResolvedValue(mockGeneratedCase);

      await controller.generateLongCase(dto);

      expect(service.generateLongCase).toHaveBeenCalledWith(
        expect.objectContaining({
          department: '呼吸内科',
          disease: '肺炎',
          ageRange: { min: 40, max: 70 },
        })
      );
    });
  });

  describe('getJobStatus', () => {
    it('should return job status', () => {
      const jobId = 'job-123';

      service.getJobStatus.mockReturnValue(mockGenerationJob);

      const result = controller.getJobStatus(jobId);

      expect(service.getJobStatus).toHaveBeenCalledWith(jobId);
      expect(result.success).toBe(true);
      expect(result.job).toBeDefined();
      expect(result.job!.id).toBe('job-123');
      expect(result.job!.status).toBe('running');
    });

    it('should throw NotFoundException when job not found', () => {
      const jobId = 'non-existent-job';

      service.getJobStatus.mockReturnValue(undefined);

      expect(() => controller.getJobStatus(jobId)).toThrow(NotFoundException);
    });

    it('should return job with all properties', () => {
      const jobWithResults: GenerationJob = {
        ...mockGenerationJob,
        completed: 5,
        failed: 1,
        errors: ['Error 1'],
        completedAt: new Date('2024-03-17T11:00:00Z'),
      };

      service.getJobStatus.mockReturnValue(jobWithResults);

      const result = controller.getJobStatus('job-123');

      expect(result.job!.completed).toBe(5);
      expect(result.job!.failed).toBe(1);
      expect(result.job!.errors).toContain('Error 1');
      expect(result.job!.completedAt).toBeDefined();
    });
  });

  describe('getAllJobs', () => {
    it('should return all jobs', () => {
      const mockJobs: GenerationJob[] = [
        mockGenerationJob,
        { ...mockGenerationJob, id: 'job-456', type: 'single', status: 'completed' as GenerationJobStatus },
      ];

      service.getAllJobs.mockReturnValue(mockJobs);

      const result = controller.getAllJobs();

      expect(service.getAllJobs).toHaveBeenCalled();
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('job-123');
      expect(result[1].id).toBe('job-456');
    });

    it('should return empty array when no jobs', () => {
      service.getAllJobs.mockReturnValue([]);

      const result = controller.getAllJobs();

      expect(result).toEqual([]);
    });

    it('should map job results correctly', () => {
      const jobWithResults: GenerationJob = {
        ...mockGenerationJob,
        results: [
          {
            content: 'Case 1',
            metadata: {
              department: '普外科',
              disease: '急性阑尾炎',
              caseType: 'A型',
              generatedAt: '2024-03-17T10:00:00Z',
            },
          },
        ],
      };

      service.getAllJobs.mockReturnValue([jobWithResults]);

      const result = controller.getAllJobs();

      expect(result[0].results).toHaveLength(1);
      expect(result[0].results[0].content).toBe('Case 1');
    });
  });

  describe('getTemplates', () => {
    it('should return available templates', () => {
      const mockTemplates = {
        templates: [
          { department: '普外科', diseases: ['急性阑尾炎', '急性胆囊炎'] },
          { department: '心内科', diseases: ['高血压', '冠心病'] },
        ],
        totalDepartments: 2,
        totalDiseases: 4,
      };

      service.getTemplates.mockReturnValue(mockTemplates);

      const result = controller.getTemplates();

      expect(service.getTemplates).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.templates).toHaveLength(2);
      expect(result.totalDepartments).toBe(2);
      expect(result.totalDiseases).toBe(4);
      expect(result.templates[0].department).toBe('普外科');
      expect(result.templates[0].diseases).toContain('急性阑尾炎');
    });

    it('should handle empty templates', () => {
      service.getTemplates.mockReturnValue({
        templates: [],
        totalDepartments: 0,
        totalDiseases: 0,
      });

      const result = controller.getTemplates();

      expect(result.success).toBe(true);
      expect(result.templates).toEqual([]);
      expect(result.totalDepartments).toBe(0);
    });

    it('should map template diseases correctly', () => {
      const mockTemplates = {
        templates: [
          { department: '骨科', diseases: ['骨折', '关节炎', '椎间盘突出'] },
        ],
        totalDepartments: 1,
        totalDiseases: 3,
      };

      service.getTemplates.mockReturnValue(mockTemplates);

      const result = controller.getTemplates();

      expect(result.templates[0].diseases).toHaveLength(3);
      expect(result.templates[0].diseases).toContain('骨折');
      expect(result.templates[0].diseases).toContain('关节炎');
      expect(result.templates[0].diseases).toContain('椎间盘突出');
    });
  });
});
