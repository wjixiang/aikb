// Mock for entity-db module to avoid Prisma ECM issues
const mockPrismaService = {
  entity: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  nomenclature: {
    create: jest.fn(),
    findMany: jest.fn(),
    delete: jest.fn(),
  },
  embedding: {
    create: jest.fn(),
    findMany: jest.fn(),
    delete: jest.fn(),
  },
  $executeRaw: jest.fn(),
  $queryRaw: jest.fn(),
  $transaction: jest.fn(),
  $connect: jest.fn(),
  $disconnect: jest.fn(),
};

// Mock PrismaService class
class MockPrismaService {
  constructor() {
    Object.assign(this, mockPrismaService);
  }
}

module.exports = {
  PrismaService: MockPrismaService,
  Prisma: {}, // Empty object for Prisma namespace
};