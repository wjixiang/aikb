// Mock for VersionControl-db to avoid Prisma ES module issues
module.exports = {
  VersionControlDBPrismaService: jest.fn().mockImplementation(() => ({
    repository: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    branch: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
    },
    gitObject: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    commit: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
    commitParent: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    change: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    branchCommit: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    treeEntry: {
      findMany: jest.fn(),
    },
    mergeResult: {
      create: jest.fn(),
    },
  }))
};