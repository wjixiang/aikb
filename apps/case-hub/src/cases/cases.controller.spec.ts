/**
 * CasesController Unit Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import { CasesController } from './cases.controller.js';
import { CasesService } from './cases.service.js';
import { CreateCaseDto } from './dto/create-case.dto.js';
import { UpdateCaseDto } from './dto/update-case.dto.js';
import { QueryCaseDto } from './dto/query-case.dto.js';
import { CaseStatus, CaseType } from './interfaces/case.interface.js';
import { ClinicalCaseComplete } from '../types/case.type.js';

describe('CasesController', () => {
  let controller: CasesController;
  let service: jest.Mocked<CasesService>;

  const mockCase = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    caseNumber: 'CASE202403170001',
    patientName: '张三',
    gender: '男' as const,
    age: 45,
    department: '普外科',
    disease: '急性阑尾炎',
    status: CaseStatus.ACTIVE,
    caseType: CaseType.TYPE_A,
    content: {} as ClinicalCaseComplete,
    createdAt: new Date('2024-03-17T10:00:00Z'),
    updatedAt: new Date('2024-03-17T10:00:00Z'),
    createdBy: undefined,
    updatedBy: undefined,
    tags: undefined,
    remarks: undefined,
  };

  beforeEach(async () => {
    const mockCasesService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      getDepartments: jest.fn(),
      getDiseases: jest.fn(),
      getStatistics: jest.fn(),
      batchCreate: jest.fn(),
      hardRemove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CasesController],
      providers: [
        {
          provide: CasesService,
          useValue: mockCasesService,
        },
      ],
    }).compile();

    controller = module.get<CasesController>(CasesController);
    service = module.get(CasesService);
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

      service.create.mockResolvedValue(mockCase);

      const result = await controller.create(createCaseDto);

      expect(service.create).toHaveBeenCalledWith(createCaseDto);
      expect(result).toEqual({
        id: mockCase.id,
        caseNumber: mockCase.caseNumber,
        patientName: mockCase.patientName,
        gender: mockCase.gender,
        age: mockCase.age,
        department: mockCase.department,
        disease: mockCase.disease,
        status: mockCase.status,
        caseType: mockCase.caseType,
        content: mockCase.content,
        createdAt: mockCase.createdAt,
        updatedAt: mockCase.updatedAt,
        createdBy: mockCase.createdBy,
        updatedBy: mockCase.updatedBy,
        tags: mockCase.tags,
        remarks: mockCase.remarks,
      });
    });

    it('should create case with minimal data', async () => {
      const createCaseDto: CreateCaseDto = {
        caseNumber: 'CASE202403170002',
        patientName: '李四',
        gender: '女',
        age: 30,
        department: '心内科',
        disease: '高血压',
        content: {} as ClinicalCaseComplete,
      };

      const newCase = {
        ...mockCase,
        id: '550e8400-e29b-41d4-a716-446655440001',
        caseNumber: 'CASE202403170002',
        patientName: '李四',
        gender: '女' as const,
        age: 30,
        department: '心内科',
        disease: '高血压',
      };

      service.create.mockResolvedValue(newCase);

      const result = await controller.create(createCaseDto);

      expect(result.patientName).toBe('李四');
      expect(result.department).toBe('心内科');
    });
  });

  describe('findAll', () => {
    it('should return paginated case list', async () => {
      const queryDto: QueryCaseDto = {
        page: 1,
        pageSize: 10,
        keyword: '张三',
      };

      const mockResult = {
        items: [mockCase],
        total: 1,
        page: 1,
        pageSize: 10,
        totalPages: 1,
      };

      service.findAll.mockResolvedValue(mockResult);

      const result = await controller.findAll(queryDto);

      expect(service.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          keyword: '张三',
          page: 1,
          pageSize: 10,
        })
      );
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
    });

    it('should support filtering by department', async () => {
      const queryDto: QueryCaseDto = {
        department: '普外科',
      };

      const mockResult = {
        items: [mockCase],
        total: 1,
        page: 1,
        pageSize: 10,
        totalPages: 1,
      };

      service.findAll.mockResolvedValue(mockResult);

      const result = await controller.findAll(queryDto);

      expect(service.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          department: '普外科',
        })
      );
      expect(result.items[0].department).toBe('普外科');
    });

    it('should support filtering by disease', async () => {
      const queryDto: QueryCaseDto = {
        disease: '急性阑尾炎',
      };

      const mockResult = {
        items: [mockCase],
        total: 1,
        page: 1,
        pageSize: 10,
        totalPages: 1,
      };

      service.findAll.mockResolvedValue(mockResult);

      const result = await controller.findAll(queryDto);

      expect(service.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          disease: '急性阑尾炎',
        })
      );
    });

    it('should support age range filtering', async () => {
      const queryDto: QueryCaseDto = {
        minAge: 30,
        maxAge: 60,
      };

      const mockResult = {
        items: [mockCase],
        total: 1,
        page: 1,
        pageSize: 10,
        totalPages: 1,
      };

      service.findAll.mockResolvedValue(mockResult);

      await controller.findAll(queryDto);

      expect(service.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          minAge: 30,
          maxAge: 60,
        })
      );
    });

    it('should support status filtering', async () => {
      const queryDto: QueryCaseDto = {
        status: CaseStatus.ACTIVE,
      };

      const mockResult = {
        items: [mockCase],
        total: 1,
        page: 1,
        pageSize: 10,
        totalPages: 1,
      };

      service.findAll.mockResolvedValue(mockResult);

      await controller.findAll(queryDto);

      expect(service.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          status: CaseStatus.ACTIVE,
        })
      );
    });

    it('should support case type filtering', async () => {
      const queryDto: QueryCaseDto = {
        caseType: CaseType.TYPE_A,
      };

      const mockResult = {
        items: [mockCase],
        total: 1,
        page: 1,
        pageSize: 10,
        totalPages: 1,
      };

      service.findAll.mockResolvedValue(mockResult);

      await controller.findAll(queryDto);

      expect(service.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          caseType: CaseType.TYPE_A,
        })
      );
    });

    it('should handle empty results', async () => {
      const queryDto: QueryCaseDto = {
        keyword: 'nonexistent',
      };

      const mockResult = {
        items: [],
        total: 0,
        page: 1,
        pageSize: 10,
        totalPages: 0,
      };

      service.findAll.mockResolvedValue(mockResult);

      const result = await controller.findAll(queryDto);

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('findOne', () => {
    it('should return a single case by id', async () => {
      const caseId = '550e8400-e29b-41d4-a716-446655440000';

      service.findOne.mockResolvedValue(mockCase);

      const result = await controller.findOne(caseId);

      expect(service.findOne).toHaveBeenCalledWith(caseId);
      expect(result.id).toBe(caseId);
      expect(result.patientName).toBe('张三');
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

      service.update.mockResolvedValue(updatedCase);

      const result = await controller.update(caseId, updateCaseDto);

      expect(service.update).toHaveBeenCalledWith(caseId, updateCaseDto);
      expect(result.patientName).toBe('张三（已修改）');
      expect(result.age).toBe(46);
    });

    it('should update case status', async () => {
      const caseId = '550e8400-e29b-41d4-a716-446655440000';
      const updateCaseDto: UpdateCaseDto = {
        status: CaseStatus.ARCHIVED,
      };

      const updatedCase = {
        ...mockCase,
        status: CaseStatus.ARCHIVED,
      };

      service.update.mockResolvedValue(updatedCase);

      const result = await controller.update(caseId, updateCaseDto);

      expect(result.status).toBe(CaseStatus.ARCHIVED);
    });

    it('should update case type', async () => {
      const caseId = '550e8400-e29b-41d4-a716-446655440000';
      const updateCaseDto: UpdateCaseDto = {
        caseType: CaseType.TYPE_B,
      };

      const updatedCase = {
        ...mockCase,
        caseType: CaseType.TYPE_B,
      };

      service.update.mockResolvedValue(updatedCase);

      const result = await controller.update(caseId, updateCaseDto);

      expect(result.caseType).toBe(CaseType.TYPE_B);
    });
  });

  describe('remove', () => {
    it('should remove a case', async () => {
      const caseId = '550e8400-e29b-41d4-a716-446655440000';

      service.remove.mockResolvedValue(undefined);

      const result = await controller.remove(caseId);

      expect(service.remove).toHaveBeenCalledWith(caseId);
      expect(result.success).toBe(true);
      expect(result.message).toBe('病历删除成功');
      expect(result.data).toEqual({ id: caseId });
    });
  });

  describe('getDepartments', () => {
    it('should return list of departments', async () => {
      const mockDepartments = [
        { code: 'internal-medicine', name: '内科', description: '内科疾病诊治', caseCount: 10 },
        { code: 'general-surgery', name: '普外科', description: '普通外科', caseCount: 5 },
      ];

      service.getDepartments.mockResolvedValue(mockDepartments);

      const result = await controller.getDepartments();

      expect(service.getDepartments).toHaveBeenCalled();
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.items[0].name).toBe('内科');
      expect(result.items[0].caseCount).toBe(10);
    });

    it('should handle empty departments list', async () => {
      service.getDepartments.mockResolvedValue([]);

      const result = await controller.getDepartments();

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('getDiseases', () => {
    it('should return list of diseases', async () => {
      const mockDiseases = [
        { code: 'appendicitis', name: '急性阑尾炎', department: '普外科', description: '阑尾炎', caseCount: 3 },
        { code: 'cholecystitis', name: '急性胆囊炎', department: '普外科', description: '胆囊炎', caseCount: 2 },
      ];

      service.getDiseases.mockResolvedValue(mockDiseases);

      const result = await controller.getDiseases();

      expect(service.getDiseases).toHaveBeenCalledWith(undefined);
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should filter diseases by department', async () => {
      const mockDiseases = [
        { code: 'appendicitis', name: '急性阑尾炎', department: '普外科', description: '阑尾炎', caseCount: 3 },
      ];

      service.getDiseases.mockResolvedValue(mockDiseases);

      const result = await controller.getDiseases('general-surgery');

      expect(service.getDiseases).toHaveBeenCalledWith('general-surgery');
      expect(result.items).toHaveLength(1);
      expect(result.items[0].department).toBe('普外科');
    });

    it('should handle empty diseases list', async () => {
      service.getDiseases.mockResolvedValue([]);

      const result = await controller.getDiseases();

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });
});
