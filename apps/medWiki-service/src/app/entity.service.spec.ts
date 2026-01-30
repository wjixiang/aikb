import { Test, TestingModule } from '@nestjs/testing';
import { EntityService, WIKI_PRISMA_SERVICE_TOKEN } from './entity.service';
import { EntityWhereInput, CreateEntityInput } from '../graphql';

describe('EntityService', () => {
  let service: EntityService;
  let mockedPrismaService: any;

  beforeEach(async () => {
    mockedPrismaService = {
      entity: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EntityService,
        {
          provide: WIKI_PRISMA_SERVICE_TOKEN,
          useValue: mockedPrismaService
        }
      ],
    }).compile();

    service = module.get<EntityService>(EntityService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getEntity', () => {
    it('should get Entity', async () => {
      const mockEntity = {
        id: 'test_uuid',
        definition: 'Test definition',
        nomenclatures: [
          { name: 'Test Name', acronym: 'TN', language: 'en' }
        ]
      };
      mockedPrismaService.entity.findFirst.mockResolvedValue(mockEntity);

      const testFilter: EntityWhereInput = {
        id: "test_uuid"
      };
      const result = await service.getEntity(testFilter);

      expect(result).toEqual({
        id: 'test_uuid',
        definition: 'Test definition',
        nomenclature: [
          { name: 'Test Name', acronym: 'TN', language: 'en' }
        ]
      });
    });

    it('should return null when entity is not found', async () => {
      mockedPrismaService.entity.findFirst.mockResolvedValue(null);

      const testFilter: EntityWhereInput = {
        id: "non_existent_uuid"
      };
      const result = await service.getEntity(testFilter);

      expect(result).toBeNull();
    });

    it('should call findFirst with correct filter for id', async () => {
      const mockEntity = {
        id: 'test_uuid',
        definition: 'Test definition',
        nomenclatures: []
      };
      mockedPrismaService.entity.findFirst.mockResolvedValue(mockEntity);

      const testFilter: EntityWhereInput = {
        id: "test_uuid"
      };
      await service.getEntity(testFilter);

      expect(mockedPrismaService.entity.findFirst).toHaveBeenCalledWith({
        where: { id: 'test_uuid' },
        include: { nomenclatures: true }
      });
    });

    it('should call findFirst with correct filter for id_in', async () => {
      const mockEntity = {
        id: 'test_uuid',
        definition: 'Test definition',
        nomenclatures: []
      };
      mockedPrismaService.entity.findFirst.mockResolvedValue(mockEntity);

      const testFilter: EntityWhereInput = {
        id_in: ['uuid1', 'uuid2']
      };
      await service.getEntity(testFilter);

      expect(mockedPrismaService.entity.findFirst).toHaveBeenCalledWith({
        where: { id: { in: ['uuid1', 'uuid2'] } },
        include: { nomenclatures: true }
      });
    });

    it('should call findFirst with correct filter for id_not_in', async () => {
      const mockEntity = {
        id: 'test_uuid',
        definition: 'Test definition',
        nomenclatures: []
      };
      mockedPrismaService.entity.findFirst.mockResolvedValue(mockEntity);

      const testFilter: EntityWhereInput = {
        id_not_in: ['uuid1', 'uuid2']
      };
      await service.getEntity(testFilter);

      expect(mockedPrismaService.entity.findFirst).toHaveBeenCalledWith({
        where: { id: { notIn: ['uuid1', 'uuid2'] } },
        include: { nomenclatures: true }
      });
    });

    it('should call findFirst with correct filter for definition', async () => {
      const mockEntity = {
        id: 'test_uuid',
        definition: 'Test definition',
        nomenclatures: []
      };
      mockedPrismaService.entity.findFirst.mockResolvedValue(mockEntity);

      const testFilter: EntityWhereInput = {
        definition: 'Test definition'
      };
      await service.getEntity(testFilter);

      expect(mockedPrismaService.entity.findFirst).toHaveBeenCalledWith({
        where: { definition: 'Test definition' },
        include: { nomenclatures: true }
      });
    });

    it('should call findFirst with correct filter for definition_contains', async () => {
      const mockEntity = {
        id: 'test_uuid',
        definition: 'Test definition',
        nomenclatures: []
      };
      mockedPrismaService.entity.findFirst.mockResolvedValue(mockEntity);

      const testFilter: EntityWhereInput = {
        definition_contains: 'test'
      };
      await service.getEntity(testFilter);

      expect(mockedPrismaService.entity.findFirst).toHaveBeenCalledWith({
        where: { definition: { contains: 'test', mode: 'insensitive' } },
        include: { nomenclatures: true }
      });
    });

    it('should call findFirst with correct filter for definition_starts_with', async () => {
      const mockEntity = {
        id: 'test_uuid',
        definition: 'Test definition',
        nomenclatures: []
      };
      mockedPrismaService.entity.findFirst.mockResolvedValue(mockEntity);

      const testFilter: EntityWhereInput = {
        definition_starts_with: 'Test'
      };
      await service.getEntity(testFilter);

      expect(mockedPrismaService.entity.findFirst).toHaveBeenCalledWith({
        where: { definition: { startsWith: 'Test', mode: 'insensitive' } },
        include: { nomenclatures: true }
      });
    });

    it('should call findFirst with correct filter for definition_ends_with', async () => {
      const mockEntity = {
        id: 'test_uuid',
        definition: 'Test definition',
        nomenclatures: []
      };
      mockedPrismaService.entity.findFirst.mockResolvedValue(mockEntity);

      const testFilter: EntityWhereInput = {
        definition_ends_with: 'definition'
      };
      await service.getEntity(testFilter);

      expect(mockedPrismaService.entity.findFirst).toHaveBeenCalledWith({
        where: { definition: { endsWith: 'definition', mode: 'insensitive' } },
        include: { nomenclatures: true }
      });
    });

    it('should call findFirst with correct filter for definition_in', async () => {
      const mockEntity = {
        id: 'test_uuid',
        definition: 'Test definition',
        nomenclatures: []
      };
      mockedPrismaService.entity.findFirst.mockResolvedValue(mockEntity);

      const testFilter: EntityWhereInput = {
        definition_in: ['def1', 'def2']
      };
      await service.getEntity(testFilter);

      expect(mockedPrismaService.entity.findFirst).toHaveBeenCalledWith({
        where: { definition: { in: ['def1', 'def2'] } },
        include: { nomenclatures: true }
      });
    });

    it('should call findFirst with correct filter for definition_not_in', async () => {
      const mockEntity = {
        id: 'test_uuid',
        definition: 'Test definition',
        nomenclatures: []
      };
      mockedPrismaService.entity.findFirst.mockResolvedValue(mockEntity);

      const testFilter: EntityWhereInput = {
        definition_not_in: ['def1', 'def2']
      };
      await service.getEntity(testFilter);

      expect(mockedPrismaService.entity.findFirst).toHaveBeenCalledWith({
        where: { definition: { notIn: ['def1', 'def2'] } },
        include: { nomenclatures: true }
      });
    });

    it('should call findFirst with correct filter for nomenclature', async () => {
      const mockEntity = {
        id: 'test_uuid',
        definition: 'Test definition',
        nomenclatures: [{ name: 'Test Name', acronym: 'TN', language: 'en' }]
      };
      mockedPrismaService.entity.findFirst.mockResolvedValue(mockEntity);

      const testFilter: EntityWhereInput = {
        nomenclature: { name: 'Test Name' }
      };
      await service.getEntity(testFilter);

      expect(mockedPrismaService.entity.findFirst).toHaveBeenCalledWith({
        where: { nomenclatures: { some: { name: 'Test Name' } } },
        include: { nomenclatures: true }
      });
    });

    it('should call findFirst with correct filter for nomenclature_some', async () => {
      const mockEntity = {
        id: 'test_uuid',
        definition: 'Test definition',
        nomenclatures: [{ name: 'Test Name', acronym: 'TN', language: 'en' }]
      };
      mockedPrismaService.entity.findFirst.mockResolvedValue(mockEntity);

      const testFilter: EntityWhereInput = {
        nomenclature_some: { name: 'Test Name' }
      };
      await service.getEntity(testFilter);

      expect(mockedPrismaService.entity.findFirst).toHaveBeenCalledWith({
        where: { nomenclatures: { some: { name: 'Test Name' } } },
        include: { nomenclatures: true }
      });
    });

    it('should call findFirst with correct filter for nomenclature_every', async () => {
      const mockEntity = {
        id: 'test_uuid',
        definition: 'Test definition',
        nomenclatures: [{ name: 'Test Name', acronym: 'TN', language: 'en' }]
      };
      mockedPrismaService.entity.findFirst.mockResolvedValue(mockEntity);

      const testFilter: EntityWhereInput = {
        nomenclature_every: { name: 'Test Name' }
      };
      await service.getEntity(testFilter);

      expect(mockedPrismaService.entity.findFirst).toHaveBeenCalledWith({
        where: { nomenclatures: { every: { name: 'Test Name' } } },
        include: { nomenclatures: true }
      });
    });

    it('should call findFirst with correct filter for nomenclature_none', async () => {
      const mockEntity = {
        id: 'test_uuid',
        definition: 'Test definition',
        nomenclatures: []
      };
      mockedPrismaService.entity.findFirst.mockResolvedValue(mockEntity);

      const testFilter: EntityWhereInput = {
        nomenclature_none: { name: 'Test Name' }
      };
      await service.getEntity(testFilter);

      expect(mockedPrismaService.entity.findFirst).toHaveBeenCalledWith({
        where: { nomenclatures: { none: { name: 'Test Name' } } },
        include: { nomenclatures: true }
      });
    });

    it('should call findFirst with correct filter for AND operator', async () => {
      const mockEntity = {
        id: 'test_uuid',
        definition: 'Test definition',
        nomenclatures: []
      };
      mockedPrismaService.entity.findFirst.mockResolvedValue(mockEntity);

      const testFilter: EntityWhereInput = {
        AND: [
          { id: 'test_uuid' },
          { definition: 'Test definition' }
        ]
      };
      await service.getEntity(testFilter);

      expect(mockedPrismaService.entity.findFirst).toHaveBeenCalledWith({
        where: {
          AND: [
            { id: 'test_uuid' },
            { definition: 'Test definition' }
          ]
        },
        include: { nomenclatures: true }
      });
    });

    it('should call findFirst with correct filter for OR operator', async () => {
      const mockEntity = {
        id: 'test_uuid',
        definition: 'Test definition',
        nomenclatures: []
      };
      mockedPrismaService.entity.findFirst.mockResolvedValue(mockEntity);

      const testFilter: EntityWhereInput = {
        OR: [
          { id: 'test_uuid' },
          { id: 'another_uuid' }
        ]
      };
      await service.getEntity(testFilter);

      expect(mockedPrismaService.entity.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [
            { id: 'test_uuid' },
            { id: 'another_uuid' }
          ]
        },
        include: { nomenclatures: true }
      });
    });

    it('should call findFirst with correct filter for NOT operator', async () => {
      const mockEntity = {
        id: 'test_uuid',
        definition: 'Test definition',
        nomenclatures: []
      };
      mockedPrismaService.entity.findFirst.mockResolvedValue(mockEntity);

      const testFilter: EntityWhereInput = {
        NOT: { id: 'excluded_uuid' }
      };
      await service.getEntity(testFilter);

      expect(mockedPrismaService.entity.findFirst).toHaveBeenCalledWith({
        where: {
          NOT: { id: 'excluded_uuid' }
        },
        include: { nomenclatures: true }
      });
    });

    it('should call findFirst with empty where when filter is empty object', async () => {
      const mockEntity = {
        id: 'test_uuid',
        definition: 'Test definition',
        nomenclatures: []
      };
      mockedPrismaService.entity.findFirst.mockResolvedValue(mockEntity);

      await service.getEntity({});

      expect(mockedPrismaService.entity.findFirst).toHaveBeenCalledWith({
        where: {},
        include: { nomenclatures: true }
      });
    });

    it('should convert nomenclatures to nomenclature in response', async () => {
      const mockEntity = {
        id: 'test_uuid',
        definition: 'Test definition',
        nomenclatures: [
          { name: 'Name 1', acronym: 'A1', language: 'en' },
          { name: 'Name 2', acronym: 'A2', language: 'es' }
        ]
      };
      mockedPrismaService.entity.findFirst.mockResolvedValue(mockEntity);

      const result = await service.getEntity({ id: 'test_uuid' });

      expect(result?.nomenclature).toEqual([
        { name: 'Name 1', acronym: 'A1', language: 'en' },
        { name: 'Name 2', acronym: 'A2', language: 'es' }
      ]);
    });

    it('should handle nomenclature with null acronym', async () => {
      const mockEntity = {
        id: 'test_uuid',
        definition: 'Test definition',
        nomenclatures: [
          { name: 'Test Name', acronym: null, language: 'en' }
        ]
      };
      mockedPrismaService.entity.findFirst.mockResolvedValue(mockEntity);

      const result = await service.getEntity({ id: 'test_uuid' });

      expect(result?.nomenclature).toEqual([
        { name: 'Test Name', acronym: null, language: 'en' }
      ]);
    });
  });

  describe('getEntities', () => {
    it('should get multiple entities', async () => {
      const mockEntities = [
        {
          id: 'uuid1',
          definition: 'Definition 1',
          nomenclatures: [{ name: 'Name 1', acronym: 'N1', language: 'en' }]
        },
        {
          id: 'uuid2',
          definition: 'Definition 2',
          nomenclatures: [{ name: 'Name 2', acronym: 'N2', language: 'es' }]
        }
      ];
      mockedPrismaService.entity.findMany.mockResolvedValue(mockEntities);

      const testFilter: EntityWhereInput = {
        id_in: ['uuid1', 'uuid2']
      };
      const result = await service.getEntities(testFilter);

      expect(result).toEqual([
        {
          id: 'uuid1',
          definition: 'Definition 1',
          nomenclature: [{ name: 'Name 1', acronym: 'N1', language: 'en' }]
        },
        {
          id: 'uuid2',
          definition: 'Definition 2',
          nomenclature: [{ name: 'Name 2', acronym: 'N2', language: 'es' }]
        }
      ]);
    });

    it('should return empty array when no entities found', async () => {
      mockedPrismaService.entity.findMany.mockResolvedValue([]);

      const result = await service.getEntities({ id: 'non_existent' });

      expect(result).toEqual([]);
    });

    it('should call findMany with correct filter', async () => {
      const mockEntities = [
        {
          id: 'uuid1',
          definition: 'Definition 1',
          nomenclatures: []
        }
      ];
      mockedPrismaService.entity.findMany.mockResolvedValue(mockEntities);

      const testFilter: EntityWhereInput = {
        definition_contains: 'test'
      };
      await service.getEntities(testFilter);

      expect(mockedPrismaService.entity.findMany).toHaveBeenCalledWith({
        where: { definition: { contains: 'test', mode: 'insensitive' } },
        include: { nomenclatures: true }
      });
    });

    it('should call findMany with empty where when filter is null', async () => {
      const mockEntities = [
        {
          id: 'uuid1',
          definition: 'Definition 1',
          nomenclatures: []
        }
      ];
      mockedPrismaService.entity.findMany.mockResolvedValue(mockEntities);

      await service.getEntities({});

      expect(mockedPrismaService.entity.findMany).toHaveBeenCalledWith({
        where: {},
        include: { nomenclatures: true }
      });
    });

    it('should convert all entities correctly', async () => {
      const mockEntities = [
        {
          id: 'uuid1',
          definition: 'Definition 1',
          nomenclatures: [
            { name: 'Name 1', acronym: 'A1', language: 'en' },
            { name: 'Name 2', acronym: 'A2', language: 'es' }
          ]
        },
        {
          id: 'uuid2',
          definition: 'Definition 2',
          nomenclatures: [
            { name: 'Name 3', acronym: 'A3', language: 'fr' }
          ]
        }
      ];
      mockedPrismaService.entity.findMany.mockResolvedValue(mockEntities);

      const result = await service.getEntities({});

      expect(result).toHaveLength(2);
      expect(result[0].nomenclature).toHaveLength(2);
      expect(result[1].nomenclature).toHaveLength(1);
    });
  });

  describe('createEntity', () => {
    it('should create a new entity', async () => {
      const mockCreatedEntity = {
        id: 'new_uuid',
        definition: 'New definition',
        nomenclatures: [
          { name: 'New Name', acronym: 'NN', language: 'en' }
        ]
      };
      mockedPrismaService.entity.create.mockResolvedValue(mockCreatedEntity);

      const input: CreateEntityInput = {
        definition: 'New definition',
        nomenclature: [
          { name: 'New Name', acronym: 'NN', language: 'en' }
        ]
      };
      const result = await service.createEntity(input);

      expect(result).toEqual({
        id: 'new_uuid',
        definition: 'New definition',
        nomenclature: [
          { name: 'New Name', acronym: 'NN', language: 'en' }
        ]
      });
    });

    it('should call create with correct data structure', async () => {
      const mockCreatedEntity = {
        id: 'new_uuid',
        definition: 'New definition',
        nomenclatures: []
      };
      mockedPrismaService.entity.create.mockResolvedValue(mockCreatedEntity);

      const input: CreateEntityInput = {
        definition: 'New definition',
        nomenclature: [
          { name: 'Name 1', acronym: 'A1', language: 'en' },
          { name: 'Name 2', acronym: 'A2', language: 'es' }
        ]
      };
      await service.createEntity(input);

      expect(mockedPrismaService.entity.create).toHaveBeenCalledWith({
        data: {
          definition: 'New definition',
          nomenclatures: {
            create: [
              { name: 'Name 1', acronym: 'A1', language: 'en' },
              { name: 'Name 2', acronym: 'A2', language: 'es' }
            ]
          }
        },
        include: { nomenclatures: true }
      });
    });

    it('should create entity with nomenclature without acronym', async () => {
      const mockCreatedEntity = {
        id: 'new_uuid',
        definition: 'New definition',
        nomenclatures: [
          { name: 'New Name', acronym: null, language: 'en' }
        ]
      };
      mockedPrismaService.entity.create.mockResolvedValue(mockCreatedEntity);

      const input: CreateEntityInput = {
        definition: 'New definition',
        nomenclature: [
          { name: 'New Name', language: 'en' }
        ]
      };
      const result = await service.createEntity(input);

      expect(result.nomenclature).toEqual([
        { name: 'New Name', acronym: null, language: 'en' }
      ]);
    });

    it('should convert created entity to GraphQL format', async () => {
      const mockCreatedEntity = {
        id: 'new_uuid',
        definition: 'New definition',
        nomenclatures: [
          { name: 'Name 1', acronym: 'A1', language: 'en' },
          { name: 'Name 2', acronym: 'A2', language: 'es' }
        ]
      };
      mockedPrismaService.entity.create.mockResolvedValue(mockCreatedEntity);

      const input: CreateEntityInput = {
        definition: 'New definition',
        nomenclature: [
          { name: 'Name 1', acronym: 'A1', language: 'en' },
          { name: 'Name 2', acronym: 'A2', language: 'es' }
        ]
      };
      const result = await service.createEntity(input);

      expect(result.nomenclature).toHaveLength(2);
      expect(result.nomenclature[0].name).toBe('Name 1');
      expect(result.nomenclature[1].name).toBe('Name 2');
    });
  });

  describe('nomenclature filter conversion', () => {
    it('should convert nomenclature filter with name', async () => {
      const mockEntity = {
        id: 'test_uuid',
        definition: 'Test definition',
        nomenclatures: []
      };
      mockedPrismaService.entity.findFirst.mockResolvedValue(mockEntity);

      const testFilter: EntityWhereInput = {
        nomenclature: { name: 'Test Name' }
      };
      await service.getEntity(testFilter);

      expect(mockedPrismaService.entity.findFirst).toHaveBeenCalledWith({
        where: { nomenclatures: { some: { name: 'Test Name' } } },
        include: { nomenclatures: true }
      });
    });

    it('should convert nomenclature filter with name_contains', async () => {
      const mockEntity = {
        id: 'test_uuid',
        definition: 'Test definition',
        nomenclatures: []
      };
      mockedPrismaService.entity.findFirst.mockResolvedValue(mockEntity);

      const testFilter: EntityWhereInput = {
        nomenclature: { name_contains: 'Test' }
      };
      await service.getEntity(testFilter);

      expect(mockedPrismaService.entity.findFirst).toHaveBeenCalledWith({
        where: { nomenclatures: { some: { name: { contains: 'Test', mode: 'insensitive' } } } },
        include: { nomenclatures: true }
      });
    });

    it('should convert nomenclature filter with name_starts_with', async () => {
      const mockEntity = {
        id: 'test_uuid',
        definition: 'Test definition',
        nomenclatures: []
      };
      mockedPrismaService.entity.findFirst.mockResolvedValue(mockEntity);

      const testFilter: EntityWhereInput = {
        nomenclature: { name_starts_with: 'Test' }
      };
      await service.getEntity(testFilter);

      expect(mockedPrismaService.entity.findFirst).toHaveBeenCalledWith({
        where: { nomenclatures: { some: { name: { startsWith: 'Test', mode: 'insensitive' } } } },
        include: { nomenclatures: true }
      });
    });

    it('should convert nomenclature filter with name_ends_with', async () => {
      const mockEntity = {
        id: 'test_uuid',
        definition: 'Test definition',
        nomenclatures: []
      };
      mockedPrismaService.entity.findFirst.mockResolvedValue(mockEntity);

      const testFilter: EntityWhereInput = {
        nomenclature: { name_ends_with: 'Name' }
      };
      await service.getEntity(testFilter);

      expect(mockedPrismaService.entity.findFirst).toHaveBeenCalledWith({
        where: { nomenclatures: { some: { name: { endsWith: 'Name', mode: 'insensitive' } } } },
        include: { nomenclatures: true }
      });
    });

    it('should convert nomenclature filter with name_in', async () => {
      const mockEntity = {
        id: 'test_uuid',
        definition: 'Test definition',
        nomenclatures: []
      };
      mockedPrismaService.entity.findFirst.mockResolvedValue(mockEntity);

      const testFilter: EntityWhereInput = {
        nomenclature: { name_in: ['Name1', 'Name2'] }
      };
      await service.getEntity(testFilter);

      expect(mockedPrismaService.entity.findFirst).toHaveBeenCalledWith({
        where: { nomenclatures: { some: { name: { in: ['Name1', 'Name2'] } } } },
        include: { nomenclatures: true }
      });
    });

    it('should convert nomenclature filter with name_not_in', async () => {
      const mockEntity = {
        id: 'test_uuid',
        definition: 'Test definition',
        nomenclatures: []
      };
      mockedPrismaService.entity.findFirst.mockResolvedValue(mockEntity);

      const testFilter: EntityWhereInput = {
        nomenclature: { name_not_in: ['Name1', 'Name2'] }
      };
      await service.getEntity(testFilter);

      expect(mockedPrismaService.entity.findFirst).toHaveBeenCalledWith({
        where: { nomenclatures: { some: { name: { notIn: ['Name1', 'Name2'] } } } },
        include: { nomenclatures: true }
      });
    });

    it('should convert nomenclature filter with acronym', async () => {
      const mockEntity = {
        id: 'test_uuid',
        definition: 'Test definition',
        nomenclatures: []
      };
      mockedPrismaService.entity.findFirst.mockResolvedValue(mockEntity);

      const testFilter: EntityWhereInput = {
        nomenclature: { acronym: 'TN' }
      };
      await service.getEntity(testFilter);

      expect(mockedPrismaService.entity.findFirst).toHaveBeenCalledWith({
        where: { nomenclatures: { some: { acronym: 'TN' } } },
        include: { nomenclatures: true }
      });
    });

    it('should convert nomenclature filter with acronym_contains', async () => {
      const mockEntity = {
        id: 'test_uuid',
        definition: 'Test definition',
        nomenclatures: []
      };
      mockedPrismaService.entity.findFirst.mockResolvedValue(mockEntity);

      const testFilter: EntityWhereInput = {
        nomenclature: { acronym_contains: 'T' }
      };
      await service.getEntity(testFilter);

      expect(mockedPrismaService.entity.findFirst).toHaveBeenCalledWith({
        where: { nomenclatures: { some: { acronym: { contains: 'T', mode: 'insensitive' } } } },
        include: { nomenclatures: true }
      });
    });

    it('should convert nomenclature filter with acronym_starts_with', async () => {
      const mockEntity = {
        id: 'test_uuid',
        definition: 'Test definition',
        nomenclatures: []
      };
      mockedPrismaService.entity.findFirst.mockResolvedValue(mockEntity);

      const testFilter: EntityWhereInput = {
        nomenclature: { acronym_starts_with: 'T' }
      };
      await service.getEntity(testFilter);

      expect(mockedPrismaService.entity.findFirst).toHaveBeenCalledWith({
        where: { nomenclatures: { some: { acronym: { startsWith: 'T', mode: 'insensitive' } } } },
        include: { nomenclatures: true }
      });
    });

    it('should convert nomenclature filter with acronym_ends_with', async () => {
      const mockEntity = {
        id: 'test_uuid',
        definition: 'Test definition',
        nomenclatures: []
      };
      mockedPrismaService.entity.findFirst.mockResolvedValue(mockEntity);

      const testFilter: EntityWhereInput = {
        nomenclature: { acronym_ends_with: 'N' }
      };
      await service.getEntity(testFilter);

      expect(mockedPrismaService.entity.findFirst).toHaveBeenCalledWith({
        where: { nomenclatures: { some: { acronym: { endsWith: 'N', mode: 'insensitive' } } } },
        include: { nomenclatures: true }
      });
    });

    it('should convert nomenclature filter with acronym_in', async () => {
      const mockEntity = {
        id: 'test_uuid',
        definition: 'Test definition',
        nomenclatures: []
      };
      mockedPrismaService.entity.findFirst.mockResolvedValue(mockEntity);

      const testFilter: EntityWhereInput = {
        nomenclature: { acronym_in: ['A1', 'A2'] }
      };
      await service.getEntity(testFilter);

      expect(mockedPrismaService.entity.findFirst).toHaveBeenCalledWith({
        where: { nomenclatures: { some: { acronym: { in: ['A1', 'A2'] } } } },
        include: { nomenclatures: true }
      });
    });

    it('should convert nomenclature filter with acronym_not_in', async () => {
      const mockEntity = {
        id: 'test_uuid',
        definition: 'Test definition',
        nomenclatures: []
      };
      mockedPrismaService.entity.findFirst.mockResolvedValue(mockEntity);

      const testFilter: EntityWhereInput = {
        nomenclature: { acronym_not_in: ['A1', 'A2'] }
      };
      await service.getEntity(testFilter);

      expect(mockedPrismaService.entity.findFirst).toHaveBeenCalledWith({
        where: { nomenclatures: { some: { acronym: { notIn: ['A1', 'A2'] } } } },
        include: { nomenclatures: true }
      });
    });

    it('should convert nomenclature filter with acronym_is_null true', async () => {
      const mockEntity = {
        id: 'test_uuid',
        definition: 'Test definition',
        nomenclatures: []
      };
      mockedPrismaService.entity.findFirst.mockResolvedValue(mockEntity);

      const testFilter: EntityWhereInput = {
        nomenclature: { acronym_is_null: true }
      };
      await service.getEntity(testFilter);

      expect(mockedPrismaService.entity.findFirst).toHaveBeenCalledWith({
        where: { nomenclatures: { some: { acronym: null } } },
        include: { nomenclatures: true }
      });
    });

    it('should convert nomenclature filter with acronym_is_null false', async () => {
      const mockEntity = {
        id: 'test_uuid',
        definition: 'Test definition',
        nomenclatures: []
      };
      mockedPrismaService.entity.findFirst.mockResolvedValue(mockEntity);

      const testFilter: EntityWhereInput = {
        nomenclature: { acronym_is_null: false }
      };
      await service.getEntity(testFilter);

      expect(mockedPrismaService.entity.findFirst).toHaveBeenCalledWith({
        where: { nomenclatures: { some: { acronym: { not: null } } } },
        include: { nomenclatures: true }
      });
    });

    it('should convert nomenclature filter with language', async () => {
      const mockEntity = {
        id: 'test_uuid',
        definition: 'Test definition',
        nomenclatures: []
      };
      mockedPrismaService.entity.findFirst.mockResolvedValue(mockEntity);

      const testFilter: EntityWhereInput = {
        nomenclature: { language: 'en' }
      };
      await service.getEntity(testFilter);

      expect(mockedPrismaService.entity.findFirst).toHaveBeenCalledWith({
        where: { nomenclatures: { some: { language: 'en' } } },
        include: { nomenclatures: true }
      });
    });

    it('should convert nomenclature filter with language_contains', async () => {
      const mockEntity = {
        id: 'test_uuid',
        definition: 'Test definition',
        nomenclatures: []
      };
      mockedPrismaService.entity.findFirst.mockResolvedValue(mockEntity);

      const testFilter: EntityWhereInput = {
        nomenclature: { language_contains: 'en' }
      };
      await service.getEntity(testFilter);

      expect(mockedPrismaService.entity.findFirst).toHaveBeenCalledWith({
        where: { nomenclatures: { some: { language: { contains: 'en', mode: 'insensitive' } } } },
        include: { nomenclatures: true }
      });
    });

    it('should convert nomenclature filter with language_starts_with', async () => {
      const mockEntity = {
        id: 'test_uuid',
        definition: 'Test definition',
        nomenclatures: []
      };
      mockedPrismaService.entity.findFirst.mockResolvedValue(mockEntity);

      const testFilter: EntityWhereInput = {
        nomenclature: { language_starts_with: 'en' }
      };
      await service.getEntity(testFilter);

      expect(mockedPrismaService.entity.findFirst).toHaveBeenCalledWith({
        where: { nomenclatures: { some: { language: { startsWith: 'en', mode: 'insensitive' } } } },
        include: { nomenclatures: true }
      });
    });

    it('should convert nomenclature filter with language_ends_with', async () => {
      const mockEntity = {
        id: 'test_uuid',
        definition: 'Test definition',
        nomenclatures: []
      };
      mockedPrismaService.entity.findFirst.mockResolvedValue(mockEntity);

      const testFilter: EntityWhereInput = {
        nomenclature: { language_ends_with: 'en' }
      };
      await service.getEntity(testFilter);

      expect(mockedPrismaService.entity.findFirst).toHaveBeenCalledWith({
        where: { nomenclatures: { some: { language: { endsWith: 'en', mode: 'insensitive' } } } },
        include: { nomenclatures: true }
      });
    });

    it('should convert nomenclature filter with language_in', async () => {
      const mockEntity = {
        id: 'test_uuid',
        definition: 'Test definition',
        nomenclatures: []
      };
      mockedPrismaService.entity.findFirst.mockResolvedValue(mockEntity);

      const testFilter: EntityWhereInput = {
        nomenclature: { language_in: ['en', 'es'] }
      };
      await service.getEntity(testFilter);

      expect(mockedPrismaService.entity.findFirst).toHaveBeenCalledWith({
        where: { nomenclatures: { some: { language: { in: ['en', 'es'] } } } },
        include: { nomenclatures: true }
      });
    });

    it('should convert nomenclature filter with language_not_in', async () => {
      const mockEntity = {
        id: 'test_uuid',
        definition: 'Test definition',
        nomenclatures: []
      };
      mockedPrismaService.entity.findFirst.mockResolvedValue(mockEntity);

      const testFilter: EntityWhereInput = {
        nomenclature: { language_not_in: ['en', 'es'] }
      };
      await service.getEntity(testFilter);

      expect(mockedPrismaService.entity.findFirst).toHaveBeenCalledWith({
        where: { nomenclatures: { some: { language: { notIn: ['en', 'es'] } } } },
        include: { nomenclatures: true }
      });
    });

    it('should convert nomenclature filter with AND operator', async () => {
      const mockEntity = {
        id: 'test_uuid',
        definition: 'Test definition',
        nomenclatures: []
      };
      mockedPrismaService.entity.findFirst.mockResolvedValue(mockEntity);

      const testFilter: EntityWhereInput = {
        nomenclature: {
          AND: [
            { name: 'Test Name' },
            { language: 'en' }
          ]
        }
      };
      await service.getEntity(testFilter);

      expect(mockedPrismaService.entity.findFirst).toHaveBeenCalledWith({
        where: {
          nomenclatures: {
            some: {
              AND: [
                { name: 'Test Name' },
                { language: 'en' }
              ]
            }
          }
        },
        include: { nomenclatures: true }
      });
    });

    it('should convert nomenclature filter with OR operator', async () => {
      const mockEntity = {
        id: 'test_uuid',
        definition: 'Test definition',
        nomenclatures: []
      };
      mockedPrismaService.entity.findFirst.mockResolvedValue(mockEntity);

      const testFilter: EntityWhereInput = {
        nomenclature: {
          OR: [
            { name: 'Name 1' },
            { name: 'Name 2' }
          ]
        }
      };
      await service.getEntity(testFilter);

      expect(mockedPrismaService.entity.findFirst).toHaveBeenCalledWith({
        where: {
          nomenclatures: {
            some: {
              OR: [
                { name: 'Name 1' },
                { name: 'Name 2' }
              ]
            }
          }
        },
        include: { nomenclatures: true }
      });
    });

    it('should convert nomenclature filter with NOT operator', async () => {
      const mockEntity = {
        id: 'test_uuid',
        definition: 'Test definition',
        nomenclatures: []
      };
      mockedPrismaService.entity.findFirst.mockResolvedValue(mockEntity);

      const testFilter: EntityWhereInput = {
        nomenclature: {
          NOT: { name: 'Excluded Name' }
        }
      };
      await service.getEntity(testFilter);

      expect(mockedPrismaService.entity.findFirst).toHaveBeenCalledWith({
        where: {
          nomenclatures: {
            some: {
              NOT: { name: 'Excluded Name' }
            }
          }
        },
        include: { nomenclatures: true }
      });
    });

    it('should handle complex nested filters', async () => {
      const mockEntity = {
        id: 'test_uuid',
        definition: 'Test definition',
        nomenclatures: []
      };
      mockedPrismaService.entity.findFirst.mockResolvedValue(mockEntity);

      const testFilter: EntityWhereInput = {
        AND: [
          { definition_contains: 'test' },
          {
            OR: [
              { nomenclature: { name: 'Name 1' } },
              { nomenclature: { name: 'Name 2' } }
            ]
          }
        ]
      };
      await service.getEntity(testFilter);

      expect(mockedPrismaService.entity.findFirst).toHaveBeenCalledWith({
        where: {
          AND: [
            { definition: { contains: 'test', mode: 'insensitive' } },
            {
              OR: [
                { nomenclatures: { some: { name: 'Name 1' } } },
                { nomenclatures: { some: { name: 'Name 2' } } }
              ]
            }
          ]
        },
        include: { nomenclatures: true }
      });
    });
  });
});
