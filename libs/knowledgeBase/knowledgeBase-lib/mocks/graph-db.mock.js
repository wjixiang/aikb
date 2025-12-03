// Mock for graph-db to avoid Prisma ES module issues
module.exports = {
  GraphDBPrismaService: jest.fn().mockImplementation(() => ({
    vertex: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    edge: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  }))
};