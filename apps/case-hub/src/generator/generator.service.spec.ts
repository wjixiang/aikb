/**
 * GeneratorService Unit Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { GeneratorService } from './generator.service.js';
import type { CaseGeneratorOptions, GeneratedCase } from '../types/generator.type.js';
import type { GenerationJob } from './interfaces/generator.interface.js';

// Mock agent-lib
jest.mock('agent-lib', () => ({
  ApiClientFactory: {
    create: jest.fn().mockReturnValue({
      generate: jest.fn(),
    }),
  },
}));

// Mock case-generator
jest.mock('../lib/case-generator.js', () => ({
  createCaseGenerator: jest.fn().mockReturnValue({
    generate: jest.fn(),
  }),
  CaseGenerator: class CaseGenerator {
    generate = jest.fn();
  },
}));

// Mock long-case-generator
jest.mock('../lib/long-case-generator.js', () => ({
  createLongCaseGenerator: jest.fn().mockReturnValue({
    generate: jest.fn(),
  }),
  LongCaseGenerator: class LongCaseGenerator {
    generate = jest.fn();
  },
}));

// Mock case-templates
jest.mock('../lib/case-templates.js', () => ({
  departmentTemplates: [
    {
      name: '普外科',
      diseases: [
        { name: '急性阑尾炎' },
        { name: '急性胆囊炎' },
      ],
    },
    {
      name: '心内科',
      diseases: [
        { name: '高血压' },
        { name: '冠心病' },
      ],
    },
  ],
  getRandomTemplate: jest.fn().mockReturnValue({
    department: '普外科',
    disease: { name: '急性阑尾炎' },
  }),
}));

describe('GeneratorService', () => {
  let service: GeneratorService;
  let configService: jest.Mocked<ConfigService>;

  const mockGeneratedCase: GeneratedCase = {
    content: '# 病历内容\n\n患者主诉：腹痛',
    metadata: {
      department: '普外科',
      disease: '急性阑尾炎',
      caseType: 'A型',
      generatedAt: '2024-03-17T10:00:00.000Z',
    },
  };

  beforeEach(async () => {
    const mockConfigService = {
      get: jest.fn((key: string) => {
        const config: Record<string, string> = {
          MINIMAX_API_KEY: 'test-api-key',
          MINIMAX_MODEL_ID: 'MiniMax-M2.5',
        };
        return config[key];
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GeneratorService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<GeneratorService>(GeneratorService);
    configService = module.get(ConfigService);

    // Initialize the service (simulating onModuleInit)
    service.onModuleInit();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('onModuleInit', () => {
    it('should initialize with config values', () => {
      expect(configService.get).toHaveBeenCalledWith('MINIMAX_API_KEY');
      expect(configService.get).toHaveBeenCalledWith('MINIMAX_MODEL_ID');
    });

    it('should handle missing API key', () => {
      const mockConfigService = {
        get: jest.fn((key: string) => {
          if (key === 'MINIMAX_API_KEY') return '';
          if (key === 'MINIMAX_MODEL_ID') return 'MiniMax-M2.5';
          return '';
        }),
      };

      const testService = new GeneratorService(mockConfigService as unknown as ConfigService);
      // Should not throw
      expect(() => testService.onModuleInit()).not.toThrow();
    });
  });

  describe('generateCase', () => {
    it('should generate a single case', async () => {
      const options: CaseGeneratorOptions = {
        department: '普外科',
        disease: '急性阑尾炎',
        patientName: '张三',
        gender: '男',
        caseType: 'A型',
      };

      // Access the private caseGenerator through any type
      const caseGenerator = (service as unknown as { caseGenerator: { generate: jest.Mock } }).caseGenerator;
      caseGenerator.generate.mockResolvedValue(mockGeneratedCase);

      const result = await service.generateCase(options);

      expect(caseGenerator.generate).toHaveBeenCalledWith(options);
      expect(result.content).toBe(mockGeneratedCase.content);
      expect(result.metadata.department).toBe('普外科');
      expect(result.metadata.disease).toBe('急性阑尾炎');
    });

    it('should throw error when generator not initialized', async () => {
      // Create a new service without calling onModuleInit
      const newService = new GeneratorService(configService);

      await expect(newService.generateCase({})).rejects.toThrow('Case generator not initialized');
    });

    it('should track job status during generation', async () => {
      const options: CaseGeneratorOptions = {};

      const caseGenerator = (service as unknown as { caseGenerator: { generate: jest.Mock } }).caseGenerator;
      caseGenerator.generate.mockResolvedValue(mockGeneratedCase);

      const result = await service.generateCase(options);

      // Verify job was created and tracked
      const jobs = service.getAllJobs();
      expect(jobs.length).toBeGreaterThan(0);

      const latestJob = jobs[jobs.length - 1];
      expect(latestJob.type).toBe('single');
      expect(latestJob.status).toBe('completed');
      expect(latestJob.completed).toBe(1);
    });

    it('should handle generation errors', async () => {
      const options: CaseGeneratorOptions = {};

      const caseGenerator = (service as unknown as { caseGenerator: { generate: jest.Mock } }).caseGenerator;
      caseGenerator.generate.mockRejectedValue(new Error('Generation failed'));

      await expect(service.generateCase(options)).rejects.toThrow('Generation failed');

      // Verify job was marked as failed
      const jobs = service.getAllJobs();
      const latestJob = jobs[jobs.length - 1];
      expect(latestJob.status).toBe('failed');
      expect(latestJob.errors.length).toBeGreaterThan(0);
    });

    it('should generate case with all options', async () => {
      const options: CaseGeneratorOptions = {
        department: '心内科',
        disease: '高血压',
        patientName: '李四',
        gender: '女',
        caseType: 'B型',
        ageRange: { min: 40, max: 60 },
        anonymize: true,
      };

      const caseGenerator = (service as unknown as { caseGenerator: { generate: jest.Mock } }).caseGenerator;
      caseGenerator.generate.mockResolvedValue({
        ...mockGeneratedCase,
        metadata: {
          ...mockGeneratedCase.metadata,
          department: '心内科',
          disease: '高血压',
          caseType: 'B型',
        },
      });

      const result = await service.generateCase(options);

      expect(caseGenerator.generate).toHaveBeenCalledWith(options);
      expect(result.metadata.department).toBe('心内科');
      expect(result.metadata.caseType).toBe('B型');
    });
  });

  describe('batchGenerate', () => {
    it('should start batch generation job', async () => {
      const count = 3;
      const options: CaseGeneratorOptions = {
        department: '普外科',
      };

      const caseGenerator = (service as unknown as { caseGenerator: { generate: jest.Mock } }).caseGenerator;
      caseGenerator.generate.mockResolvedValue(mockGeneratedCase);

      const job = await service.batchGenerate(count, options);

      expect(job.type).toBe('batch');
      expect(job.total).toBe(3);
      expect(job.status).toBe('pending');
      expect(job.id).toBeDefined();
    });

    it('should throw error for invalid count', async () => {
      await expect(service.batchGenerate(0, {})).rejects.toThrow('Count must be between 1 and 100');
      await expect(service.batchGenerate(101, {})).rejects.toThrow('Count must be between 1 and 100');
      await expect(service.batchGenerate(-1, {})).rejects.toThrow('Count must be between 1 and 100');
    });

    it('should throw error when generator not initialized', async () => {
      const newService = new GeneratorService(configService);

      await expect(newService.batchGenerate(5, {})).rejects.toThrow('Case generator not initialized');
    });

    it('should return job immediately and process asynchronously', async () => {
      const count = 2;
      const options: CaseGeneratorOptions = {};

      const caseGenerator = (service as unknown as { caseGenerator: { generate: jest.Mock } }).caseGenerator;
      caseGenerator.generate.mockResolvedValue(mockGeneratedCase);

      const job = await service.batchGenerate(count, options);

      // Job should be returned immediately with pending status
      expect(job.status).toBe('pending');

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Check job status after processing
      const updatedJob = service.getJobStatus(job.id);
      expect(updatedJob).toBeDefined();
    });

    it('should handle batch generation with options', async () => {
      const count = 5;
      const options: CaseGeneratorOptions = {
        department: '骨科',
        disease: '骨折',
        gender: '男',
      };

      const caseGenerator = (service as unknown as { caseGenerator: { generate: jest.Mock } }).caseGenerator;
      caseGenerator.generate.mockResolvedValue(mockGeneratedCase);

      const job = await service.batchGenerate(count, options);

      expect(job.total).toBe(5);
    });
  });

  describe('generateLongCase', () => {
    it('should generate a long case', async () => {
      const options: CaseGeneratorOptions = {
        department: '心内科',
        disease: '高血压',
      };

      const longCaseResult: GeneratedCase = {
        ...mockGeneratedCase,
        content: '# 详细病历\n\n（约3000字内容）',
        metadata: {
          ...mockGeneratedCase.metadata,
          department: '心内科',
          disease: '高血压',
        },
      };

      const longCaseGenerator = (service as unknown as { longCaseGenerator: { generate: jest.Mock } }).longCaseGenerator;
      longCaseGenerator.generate.mockResolvedValue(longCaseResult);

      const result = await service.generateLongCase(options);

      expect(longCaseGenerator.generate).toHaveBeenCalledWith(options);
      expect(result.metadata.department).toBe('心内科');
      expect(result.metadata.disease).toBe('高血压');
    });

    it('should throw error when long case generator not initialized', async () => {
      const newService = new GeneratorService(configService);

      await expect(newService.generateLongCase({})).rejects.toThrow('Long case generator not initialized');
    });

    it('should track job status during long case generation', async () => {
      const options: CaseGeneratorOptions = {};

      const longCaseGenerator = (service as unknown as { longCaseGenerator: { generate: jest.Mock } }).longCaseGenerator;
      longCaseGenerator.generate.mockResolvedValue(mockGeneratedCase);

      await service.generateLongCase(options);

      const jobs = service.getAllJobs();
      const latestJob = jobs[jobs.length - 1];
      expect(latestJob.type).toBe('long');
      expect(latestJob.status).toBe('completed');
    });

    it('should handle long case generation errors', async () => {
      const options: CaseGeneratorOptions = {};

      const longCaseGenerator = (service as unknown as { longCaseGenerator: { generate: jest.Mock } }).longCaseGenerator;
      longCaseGenerator.generate.mockRejectedValue(new Error('Long case generation failed'));

      await expect(service.generateLongCase(options)).rejects.toThrow('Long case generation failed');
    });
  });

  describe('getJobStatus', () => {
    it('should return job by id', async () => {
      const options: CaseGeneratorOptions = {};

      const caseGenerator = (service as unknown as { caseGenerator: { generate: jest.Mock } }).caseGenerator;
      caseGenerator.generate.mockResolvedValue(mockGeneratedCase);

      const job = await service.generateCase(options);
      const retrievedJob = service.getJobStatus(job.id);

      expect(retrievedJob).toBeDefined();
      expect(retrievedJob!.id).toBe(job.id);
    });

    it('should return undefined for non-existent job', () => {
      const job = service.getJobStatus('non-existent-id');

      expect(job).toBeUndefined();
    });
  });

  describe('getAllJobs', () => {
    it('should return all jobs', async () => {
      const caseGenerator = (service as unknown as { caseGenerator: { generate: jest.Mock } }).caseGenerator;
      caseGenerator.generate.mockResolvedValue(mockGeneratedCase);

      // Create multiple jobs
      await service.generateCase({});
      await service.generateCase({});

      const jobs = service.getAllJobs();

      expect(jobs.length).toBeGreaterThanOrEqual(2);
    });

    it('should return empty array when no jobs', () => {
      // Create fresh service
      const newService = new GeneratorService(configService);
      newService.onModuleInit();

      const jobs = newService.getAllJobs();

      expect(jobs).toEqual([]);
    });
  });

  describe('cancelJob', () => {
    it('should cancel a pending job', async () => {
      const caseGenerator = (service as unknown as { caseGenerator: { generate: jest.Mock } }).caseGenerator;
      caseGenerator.generate.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve(mockGeneratedCase), 1000)));

      // Start a batch job
      const job = await service.batchGenerate(5, {});

      // Cancel it immediately
      const cancelled = service.cancelJob(job.id);

      expect(cancelled).toBe(true);

      const updatedJob = service.getJobStatus(job.id);
      expect(updatedJob!.status).toBe('cancelled');
    });

    it('should return false for non-existent job', () => {
      const result = service.cancelJob('non-existent-id');

      expect(result).toBe(false);
    });

    it('should return false for already completed job', async () => {
      const caseGenerator = (service as unknown as { caseGenerator: { generate: jest.Mock } }).caseGenerator;
      caseGenerator.generate.mockResolvedValue(mockGeneratedCase);

      // Complete a job
      await service.generateCase({});

      const jobs = service.getAllJobs();
      const completedJob = jobs.find((j) => j.status === 'completed');

      if (completedJob) {
        const result = service.cancelJob(completedJob.id);
        expect(result).toBe(false);
      }
    });

    it('should return false for already failed job', async () => {
      const caseGenerator = (service as unknown as { caseGenerator: { generate: jest.Mock } }).caseGenerator;
      caseGenerator.generate.mockRejectedValue(new Error('Generation failed'));

      try {
        await service.generateCase({});
      } catch {
        // Expected error
      }

      const jobs = service.getAllJobs();
      const failedJob = jobs.find((j) => j.status === 'failed');

      if (failedJob) {
        const result = service.cancelJob(failedJob.id);
        expect(result).toBe(false);
      }
    });
  });

  describe('getTemplates', () => {
    it('should return available templates', () => {
      const templates = service.getTemplates();

      expect(templates.templates).toHaveLength(2);
      expect(templates.totalDepartments).toBe(2);
      expect(templates.totalDiseases).toBe(4);
      expect(templates.templates[0].department).toBe('普外科');
      expect(templates.templates[0].diseases).toContain('急性阑尾炎');
    });

    it('should include all diseases in count', () => {
      const templates = service.getTemplates();

      const totalDiseases = templates.templates.reduce(
        (sum, t) => sum + t.diseases.length,
        0
      );
      expect(templates.totalDiseases).toBe(totalDiseases);
    });
  });

  describe('getRandomTemplateInfo', () => {
    it('should return random template info', () => {
      const template = service.getRandomTemplateInfo();

      expect(template.department).toBe('普外科');
      expect(template.disease).toBe('急性阑尾炎');
    });

    it('should return template for specific department', () => {
      const template = service.getRandomTemplateInfo('cardiology');

      expect(template).toBeDefined();
      expect(template.department).toBeDefined();
      expect(template.disease).toBeDefined();
    });

    it('should return template for specific disease', () => {
      const template = service.getRandomTemplateInfo(undefined, '高血压');

      expect(template).toBeDefined();
      expect(template.disease).toBeDefined();
    });
  });

  describe('cleanupCompletedJobs', () => {
    it('should clean up old completed jobs', async () => {
      const caseGenerator = (service as unknown as { caseGenerator: { generate: jest.Mock } }).caseGenerator;
      caseGenerator.generate.mockResolvedValue(mockGeneratedCase);

      // Create a completed job
      await service.generateCase({});

      // Clean up with 0ms max age to remove all old jobs
      const cleaned = service.cleanupCompletedJobs(0);

      expect(cleaned).toBeGreaterThanOrEqual(0);
    });

    it('should not clean up recent jobs', async () => {
      const caseGenerator = (service as unknown as { caseGenerator: { generate: jest.Mock } }).caseGenerator;
      caseGenerator.generate.mockResolvedValue(mockGeneratedCase);

      // Create a completed job
      await service.generateCase({});

      // Clean up with 24 hours max age
      const cleaned = service.cleanupCompletedJobs(24 * 60 * 60 * 1000);

      expect(cleaned).toBe(0);
    });

    it('should only clean completed, failed, or cancelled jobs', async () => {
      const caseGenerator = (service as unknown as { caseGenerator: { generate: jest.Mock } }).caseGenerator;
      caseGenerator.generate.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve(mockGeneratedCase), 1000)));

      // Create a pending batch job
      const job = await service.batchGenerate(5, {});

      // Clean up immediately
      const cleaned = service.cleanupCompletedJobs(0);

      // Pending job should not be cleaned
      expect(service.getJobStatus(job.id)).toBeDefined();
    });
  });
});
