/**
 * CasesService Unit Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { CasesService } from './cases.service.js';
import { PrismaService } from '../storage/prisma.service.js';
import { CreateCaseDto } from './dto/create-case.dto.js';
import { UpdateCaseDto } from './dto/update-case.dto.js';
import { CaseStatus, CaseType, ICaseQuery } from './interfaces/case.interface.js';
import { ClinicalCaseComplete } from '../types/case.type.js';
import type { Case } from '../generated/prisma/index.js';

describe('CasesService', () => {
  let service: CasesService;
  let prismaService: jest.Mocked<PrismaService>;

  const mockCase: Case = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    caseNumber: 'CASE202403170001',
    patientName: '张三',
    gender: '男',
    age: 45,
    department: '普外科',
    disease: '急性阑尾炎',
    status: 'ACTIVE',
    content: {
      commonItems: {
        name: '张三',
        gender: '男',
        age: 45,
      },
    },
    caseType: 'A型',
    metadata: {},
    createdAt: new Date('2024-03-17T10:00:00Z'),
    updatedAt: new Date('2024-03-17T10:00:00Z'),
    createdBy: null,
    updatedBy: null,
  };

  beforeEach(async () => {
    const mockPrismaService = {
      case: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
        groupBy: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CasesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<CasesService>(CasesService);
    prismaService = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new case', async () => {
      const createCaseDto: CreateCaseDto = {
        caseNumber: 'CASE202403170001',
        patientName: '张三',
        gender: '男',
        age: 45,
        department: '普外科',
        disease: '急性阑尾炎',
        content: {
          commonItems: {
            name: '张三',
            gender: '男',
            age: 45,
          },
        } as ClinicalCaseComplete,
      };

      prismaService.case.findUnique = jest.fn().mockResolvedValue(null);
      prismaService.case.create = jest.fn().mockResolvedValue(mockCase);

      const result = await service.create(createCaseDto);

      expect(prismaService.case.findUnique).toHaveBeenCalledWith({
        where: { caseNumber: createCaseDto.caseNumber },
      });
      expect(prismaService.case.create).toHaveBeenCalled();
      expect(result.patientName).toBe('张三');
      expect(result.caseNumber).toBe('CASE202403170001');
    });

    it('should throw ConflictException when case number exists', async () => {
      const createCaseDto: CreateCaseDto = {
        caseNumber: 'CASE202403170001',
        patientName: '张三',
        gender: '男',
        age: 45,
        department: '普外科',
        disease: '急性阑尾炎',
        content: {} as ClinicalCaseComplete,
      };

      prismaService.case.findUnique = jest.fn().mockResolvedValue(mockCase);

      await expect(service.create(createCaseDto)).rejects.toThrow(ConflictException);
      expect(prismaService.case.findUnique).toHaveBeenCalledWith({
        where: { caseNumber: createCaseDto.caseNumber },
      });
    });

    it('should generate case number if not provided', async () => {
      const createCaseDto: CreateCaseDto = {
        patientName: '张三',
        gender: '男',
        age: 45,
        department: '普外科',
        disease: '急性阑尾炎',
        content: {} as ClinicalCaseComplete,
      };

      const createdCase = {
        ...mockCase,
        caseNumber: expect.stringMatching(/^CASE\d{8}\d{4}$/),
      };

      prismaService.case.create = jest.fn().mockResolvedValue(createdCase);

      const result = await service.create(createCaseDto);

      expect(prismaService.case.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            caseNumber: expect.stringMatching(/^CASE\d{8}\d{4}$/),
          }),
        })
      );
      expect(result.caseNumber).toMatch(/^CASE\d{8}\d{4}$/);
    });

    it('should set default values when optional fields are not provided', async () => {
      const createCaseDto: CreateCaseDto = {
        caseNumber: 'CASE202403170002',
        patientName: '李四',
        gender: '女',
        age: 30,
        department: '心内科',
        disease: '高血压',
        content: {} as ClinicalCaseComplete,
      };

      const createdCase = {
        ...mockCase,
        id: '550e8400-e29b-41d4-a716-446655440001',
        caseNumber: 'CASE202403170002',
        patientName: '李四',
        gender: '女',
        age: 30,
        department: '心内科',
        disease: '高血压',
      };

      prismaService.case.findUnique = jest.fn().mockResolvedValue(null);
      prismaService.case.create = jest.fn().mockResolvedValue(createdCase);

      const result = await service.create(createCaseDto);

      expect(result.patientName).toBe('李四');
      expect(result.department).toBe('心内科');
    });
  });

  describe('findAll', () => {
    it('should return paginated results', async () => {
      const query: ICaseQuery = {
        keyword: undefined,
        department: undefined,
        disease: undefined,
        gender: undefined,
        minAge: undefined,
        maxAge: undefined,
        status: undefined,
        caseType: undefined,
        createdFrom: undefined,
        createdTo: undefined,
        page: 1,
        pageSize: 10,
        sortBy: undefined,
        sortOrder: undefined,
      };

      prismaService.case.findMany = jest.fn().mockResolvedValue([mockCase]);
      prismaService.case.count = jest.fn().mockResolvedValue(1);

      const result = await service.findAll(query);

      expect(prismaService.case.findMany).toHaveBeenCalled();
      expect(prismaService.case.count).toHaveBeenCalled();
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);
      expect(result.totalPages).toBe(1);
    });

    it('should filter by keyword', async () => {
      const query: ICaseQuery = {
        keyword: '张三',
        page: 1,
        pageSize: 10,
      };

      prismaService.case.findMany = jest.fn().mockResolvedValue([mockCase]);
      prismaService.case.count = jest.fn().mockResolvedValue(1);

      await service.findAll(query);

      expect(prismaService.case.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ patientName: expect.any(Object) }),
              expect.objectContaining({ caseNumber: expect.any(Object) }),
              expect.objectContaining({ disease: expect.any(Object) }),
            ]),
          }),
        })
      );
    });

    it('should filter by department', async () => {
      const query: ICaseQuery = {
        department: '普外科',
        page: 1,
        pageSize: 10,
      };

      prismaService.case.findMany = jest.fn().mockResolvedValue([mockCase]);
      prismaService.case.count = jest.fn().mockResolvedValue(1);

      await service.findAll(query);

      expect(prismaService.case.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            department: '普外科',
          }),
        })
      );
    });

    it('should filter by disease', async () => {
      const query: ICaseQuery = {
        disease: '急性阑尾炎',
        page: 1,
        pageSize: 10,
      };

      prismaService.case.findMany = jest.fn().mockResolvedValue([mockCase]);
      prismaService.case.count = jest.fn().mockResolvedValue(1);

      await service.findAll(query);

      expect(prismaService.case.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            disease: '急性阑尾炎',
          }),
        })
      );
    });

    it('should filter by age range', async () => {
      const query: ICaseQuery = {
        minAge: 30,
        maxAge: 60,
        page: 1,
        pageSize: 10,
      };

      prismaService.case.findMany = jest.fn().mockResolvedValue([mockCase]);
      prismaService.case.count = jest.fn().mockResolvedValue(1);

      await service.findAll(query);

      expect(prismaService.case.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            age: {
              gte: 30,
              lte: 60,
            },
          }),
        })
      );
    });

    it('should filter by status', async () => {
      const query: ICaseQuery = {
        status: CaseStatus.ACTIVE,
        page: 1,
        pageSize: 10,
      };

      prismaService.case.findMany = jest.fn().mockResolvedValue([mockCase]);
      prismaService.case.count = jest.fn().mockResolvedValue(1);

      await service.findAll(query);

      expect(prismaService.case.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'ACTIVE',
          }),
        })
      );
    });

    it('should filter by case type', async () => {
      const query: ICaseQuery = {
        caseType: CaseType.TYPE_A,
        page: 1,
        pageSize: 10,
      };

      prismaService.case.findMany = jest.fn().mockResolvedValue([mockCase]);
      prismaService.case.count = jest.fn().mockResolvedValue(1);

      await service.findAll(query);

      expect(prismaService.case.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            caseType: 'A型',
          }),
        })
      );
    });

    it('should filter by created date range', async () => {
      const query: ICaseQuery = {
        createdFrom: new Date('2024-01-01'),
        createdTo: new Date('2024-12-31'),
        page: 1,
        pageSize: 10,
      };

      prismaService.case.findMany = jest.fn().mockResolvedValue([mockCase]);
      prismaService.case.count = jest.fn().mockResolvedValue(1);

      await service.findAll(query);

      expect(prismaService.case.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: {
              gte: new Date('2024-01-01'),
              lte: new Date('2024-12-31'),
            },
          }),
        })
      );
    });

    it('should use default pagination values', async () => {
      const query: ICaseQuery = {};

      prismaService.case.findMany = jest.fn().mockResolvedValue([mockCase]);
      prismaService.case.count = jest.fn().mockResolvedValue(1);

      const result = await service.findAll(query);

      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);
    });

    it('should handle empty results', async () => {
      const query: ICaseQuery = {
        keyword: 'nonexistent',
        page: 1,
        pageSize: 10,
      };

      prismaService.case.findMany = jest.fn().mockResolvedValue([]);
      prismaService.case.count = jest.fn().mockResolvedValue(0);

      const result = await service.findAll(query);

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
    });
  });

  describe('findOne', () => {
    it('should return a case by id', async () => {
      const caseId = '550e8400-e29b-41d4-a716-446655440000';

      prismaService.case.findUnique = jest.fn().mockResolvedValue(mockCase);

      const result = await service.findOne(caseId);

      expect(prismaService.case.findUnique).toHaveBeenCalledWith({
        where: { id: caseId },
      });
      expect(result.id).toBe(caseId);
      expect(result.patientName).toBe('张三');
    });

    it('should throw NotFoundException when case not found', async () => {
      const caseId = 'non-existent-id';

      prismaService.case.findUnique = jest.fn().mockResolvedValue(null);

      await expect(service.findOne(caseId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByCaseNumber', () => {
    it('should return a case by case number', async () => {
      const caseNumber = 'CASE202403170001';

      prismaService.case.findUnique = jest.fn().mockResolvedValue(mockCase);

      const result = await service.findByCaseNumber(caseNumber);

      expect(prismaService.case.findUnique).toHaveBeenCalledWith({
        where: { caseNumber },
      });
      expect(result).not.toBeNull();
      expect(result!.caseNumber).toBe(caseNumber);
    });

    it('should return null when case not found', async () => {
      const caseNumber = 'NON-EXISTENT';

      prismaService.case.findUnique = jest.fn().mockResolvedValue(null);

      const result = await service.findByCaseNumber(caseNumber);

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update a case', async () => {
      const caseId = '550e8400-e29b-41d4-a716-446655440000';
      const updateCaseDto: UpdateCaseDto = {
        patientName: '张三（已修改）',
        age: 46,
      };

      const updatedCase = {
        ...mockCase,
        patientName: '张三（已修改）',
        age: 46,
      };

      prismaService.case.findUnique = jest.fn().mockResolvedValue(mockCase);
      prismaService.case.update = jest.fn().mockResolvedValue(updatedCase);

      const result = await service.update(caseId, updateCaseDto);

      expect(prismaService.case.update).toHaveBeenCalledWith({
        where: { id: caseId },
        data: expect.objectContaining({
          patientName: '张三（已修改）',
          age: 46,
          updatedAt: expect.any(Date),
        }),
      });
      expect(result.patientName).toBe('张三（已修改）');
      expect(result.age).toBe(46);
    });

    it('should throw NotFoundException when case not found', async () => {
      const caseId = 'non-existent-id';
      const updateCaseDto: UpdateCaseDto = { patientName: 'New Name' };

      prismaService.case.findUnique = jest.fn().mockResolvedValue(null);

      await expect(service.update(caseId, updateCaseDto)).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when updating to existing case number', async () => {
      const caseId = '550e8400-e29b-41d4-a716-446655440000';
      const updateCaseDto: UpdateCaseDto = {
        caseNumber: 'CASE202403170002',
      };

      const existingCase = {
        ...mockCase,
        id: 'different-id',
        caseNumber: 'CASE202403170002',
      };

      prismaService.case.findUnique = jest.fn()
        .mockResolvedValueOnce(mockCase)
        .mockResolvedValueOnce(existingCase);

      await expect(service.update(caseId, updateCaseDto)).rejects.toThrow(ConflictException);
    });

    it('should update metadata tags and remarks', async () => {
      const caseId = '550e8400-e29b-41d4-a716-446655440000';
      const updateCaseDto: UpdateCaseDto = {
        tags: ['急症', '手术'],
        remarks: '需要随访',
      };

      const updatedCase = {
        ...mockCase,
        metadata: { tags: ['急症', '手术'], remarks: '需要随访' },
      };

      prismaService.case.findUnique = jest.fn().mockResolvedValue(mockCase);
      prismaService.case.update = jest.fn().mockResolvedValue(updatedCase);

      const result = await service.update(caseId, updateCaseDto);

      expect(prismaService.case.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            metadata: expect.objectContaining({
              tags: ['急症', '手术'],
              remarks: '需要随访',
            }),
          }),
        })
      );
    });
  });

  describe('remove', () => {
    it('should soft delete a case', async () => {
      const caseId = '550e8400-e29b-41d4-a716-446655440000';

      prismaService.case.findUnique = jest.fn().mockResolvedValue(mockCase);
      prismaService.case.update = jest.fn().mockResolvedValue({ ...mockCase, status: 'DELETED' });

      await service.remove(caseId);

      expect(prismaService.case.update).toHaveBeenCalledWith({
        where: { id: caseId },
        data: {
          status: 'DELETED',
          updatedAt: expect.any(Date),
        },
      });
    });

    it('should throw NotFoundException when case not found', async () => {
      const caseId = 'non-existent-id';

      prismaService.case.findUnique = jest.fn().mockResolvedValue(null);

      await expect(service.remove(caseId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('hardRemove', () => {
    it('should hard delete a case', async () => {
      const caseId = '550e8400-e29b-41d4-a716-446655440000';

      prismaService.case.findUnique = jest.fn().mockResolvedValue(mockCase);
      prismaService.case.delete = jest.fn().mockResolvedValue(mockCase);

      await service.hardRemove(caseId);

      expect(prismaService.case.delete).toHaveBeenCalledWith({
        where: { id: caseId },
      });
    });

    it('should throw NotFoundException when case not found', async () => {
      const caseId = 'non-existent-id';

      prismaService.case.findUnique = jest.fn().mockResolvedValue(null);

      await expect(service.hardRemove(caseId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getDepartments', () => {
    it('should return all departments with case counts', async () => {
      prismaService.case.groupBy = jest.fn().mockResolvedValue([
        { department: '普外科', _count: { id: 5 } },
        { department: '心内科', _count: { id: 3 } },
      ]);

      const result = await service.getDepartments();

      expect(prismaService.case.groupBy).toHaveBeenCalledWith({
        by: ['department'],
        _count: { id: true },
        where: { status: { not: 'DELETED' } },
      });
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('code');
      expect(result[0]).toHaveProperty('name');
      expect(result[0]).toHaveProperty('caseCount');
    });

    it('should return zero count for departments without cases', async () => {
      prismaService.case.groupBy = jest.fn().mockResolvedValue([]);

      const result = await service.getDepartments();

      expect(result.every(d => d.caseCount === 0)).toBe(true);
    });
  });

  describe('getDiseases', () => {
    it('should return all diseases with case counts', async () => {
      prismaService.case.groupBy = jest.fn().mockResolvedValue([
        { disease: '急性阑尾炎', _count: { id: 3 } },
        { disease: '高血压', _count: { id: 2 } },
      ]);

      const result = await service.getDiseases();

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('code');
      expect(result[0]).toHaveProperty('name');
      expect(result[0]).toHaveProperty('caseCount');
    });

    it('should filter diseases by department', async () => {
      prismaService.case.groupBy = jest.fn().mockResolvedValue([
        { disease: '急性阑尾炎', _count: { id: 3 } },
      ]);

      const result = await service.getDiseases('general-surgery');

      expect(result.every((d) => d.department === '普外科' || !d.department)).toBe(true);
    });

    it('should return all diseases when no department specified', async () => {
      prismaService.case.groupBy = jest.fn().mockResolvedValue([
        { disease: '急性阑尾炎', _count: { id: 3 } },
        { disease: '高血压', _count: { id: 2 } },
        { disease: '糖尿病', _count: { id: 1 } },
      ]);

      const result = await service.getDiseases();

      expect(result.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('batchCreate', () => {
    it('should create multiple cases', async () => {
      const createCaseDtos: CreateCaseDto[] = [
        {
          caseNumber: 'CASE202403170001',
          patientName: '张三',
          gender: '男',
          age: 45,
          department: '普外科',
          disease: '急性阑尾炎',
          content: {} as ClinicalCaseComplete,
        },
        {
          caseNumber: 'CASE202403170002',
          patientName: '李四',
          gender: '女',
          age: 30,
          department: '心内科',
          disease: '高血压',
          content: {} as ClinicalCaseComplete,
        },
      ];

      prismaService.case.findUnique = jest.fn().mockResolvedValue(null);
      prismaService.case.create = jest.fn()
        .mockResolvedValueOnce(mockCase)
        .mockResolvedValueOnce({ ...mockCase, id: '550e8400-e29b-41d4-a716-446655440001' });

      const result = await service.batchCreate(createCaseDtos);

      expect(result.length).toBe(2);
    });

    it('should continue processing when one case fails', async () => {
      const createCaseDtos: CreateCaseDto[] = [
        {
          caseNumber: 'CASE202403170001',
          patientName: '张三',
          gender: '男',
          age: 45,
          department: '普外科',
          disease: '急性阑尾炎',
          content: {} as ClinicalCaseComplete,
        },
        {
          caseNumber: 'CASE202403170002',
          patientName: '李四',
          gender: '女',
          age: 30,
          department: '心内科',
          disease: '高血压',
          content: {} as ClinicalCaseComplete,
        },
      ];

      prismaService.case.findUnique = jest.fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockCase); // Second case already exists

      prismaService.case.create = jest.fn().mockResolvedValue(mockCase);

      const result = await service.batchCreate(createCaseDtos);

      // Should only have 1 successful creation
      expect(result.length).toBe(1);
    });
  });

  describe('getStatistics', () => {
    it('should return case statistics', async () => {
      prismaService.case.count = jest.fn()
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(10);
      prismaService.case.groupBy = jest.fn()
        .mockResolvedValueOnce([
          { department: '普外科', _count: { id: 50 } },
          { department: '心内科', _count: { id: 30 } },
        ])
        .mockResolvedValueOnce([
          { disease: '急性阑尾炎', _count: { id: 20 } },
          { disease: '高血压', _count: { id: 15 } },
        ]);

      const result = await service.getStatistics();

      expect(result.totalCases).toBe(100);
      expect(result.newCasesThisMonth).toBe(10);
      expect(result.departmentDistribution).toHaveProperty('普外科');
      expect(result.departmentDistribution).toHaveProperty('心内科');
      expect(result.diseaseDistribution).toHaveProperty('急性阑尾炎');
    });

    it('should handle empty database', async () => {
      prismaService.case.count = jest.fn()
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);
      prismaService.case.groupBy = jest.fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await service.getStatistics();

      expect(result.totalCases).toBe(0);
      expect(result.newCasesThisMonth).toBe(0);
      expect(Object.keys(result.departmentDistribution)).toHaveLength(0);
      expect(Object.keys(result.diseaseDistribution)).toHaveLength(0);
    });
  });

  describe('getDepartmentByCode', () => {
    it('should return department by code', async () => {
      const result = await service.getDepartmentByCode('general-surgery');

      expect(result).toBeDefined();
      expect(result!.code).toBe('general-surgery');
      expect(result!.name).toBe('普外科');
    });

    it('should return undefined for non-existent code', async () => {
      const result = await service.getDepartmentByCode('non-existent');

      expect(result).toBeUndefined();
    });
  });

  describe('getDiseaseByCode', () => {
    it('should return disease by code', async () => {
      const result = await service.getDiseaseByCode('appendicitis');

      expect(result).toBeDefined();
      expect(result!.code).toBe('appendicitis');
      expect(result!.name).toBe('急性阑尾炎');
    });

    it('should return undefined for non-existent code', async () => {
      const result = await service.getDiseaseByCode('non-existent');

      expect(result).toBeUndefined();
    });
  });
});
