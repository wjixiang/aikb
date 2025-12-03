import { Test, TestingModule } from '@nestjs/testing';
import { GitVersionControlService } from './version-control.service';
import { NotFoundException, ConflictException } from '@nestjs/common';
import {
  Commit,
  Branch,
  Tree,
  Blob,
  ChangeSet,
  Change,
  MergeResult,
  WorkingTreeStatus,
  CommitDiff,
  AuthorInfo
} from './types';
import { VersionControlDBPrismaService } from 'VersionControl-db';

// Mock the VersionControlDBPrismaService
const mockVersionControlDBPrismaService = {
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
};

describe('GitVersionControlService', () => {
  let service: GitVersionControlService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GitVersionControlService,
        {
          provide: VersionControlDBPrismaService,
          useValue: mockVersionControlDBPrismaService,
        },
      ],
    }).compile();

    service = module.get<GitVersionControlService>(GitVersionControlService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('initRepository', () => {
    it('should create a new repository with main branch', async () => {
      const repositoryId = 'test-repo';
      const mockRepository = { id: 'repo-id', repositoryId, currentBranch: 'main' };
      const mockBranch = { id: 'branch-id', name: 'main' };

      // First call returns null (repository doesn't exist), second call returns the created repository
      mockVersionControlDBPrismaService.repository.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockRepository);
      mockVersionControlDBPrismaService.repository.create.mockResolvedValue(mockRepository);
      mockVersionControlDBPrismaService.branch.findFirst.mockResolvedValue(null);
      mockVersionControlDBPrismaService.branch.create.mockResolvedValue(mockBranch);

      await service.initRepository(repositoryId);

      expect(mockVersionControlDBPrismaService.repository.findUnique).toHaveBeenCalledWith({
        where: { repositoryId }
      });
      expect(mockVersionControlDBPrismaService.repository.create).toHaveBeenCalledWith({
        data: { repositoryId, currentBranch: 'main' }
      });
      expect(mockVersionControlDBPrismaService.branch.create).toHaveBeenCalled();
    });

    it('should throw ConflictException if repository already exists', async () => {
      const repositoryId = 'existing-repo';
      mockVersionControlDBPrismaService.repository.findUnique.mockResolvedValue({ id: 'repo-id' });

      await expect(service.initRepository(repositoryId)).rejects.toThrow(
        new ConflictException(`Repository with ID ${repositoryId} already exists`)
      );
    });
  });

  describe('createBranch', () => {
    it('should create a new branch', async () => {
      const repositoryId = 'test-repo';
      const branchName = 'feature/test';
      const author: AuthorInfo = { name: 'Test User', email: 'test@example.com' };
      const mockRepository = { id: 'repo-id', currentBranch: 'main' };
      const mockBranch = {
        id: 'branch-id',
        branchId: 'branch-object-id',
        name: branchName,
        headCommitId: 'commit-id',
        baseCommitId: 'commit-id',
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: { author: author.name }
      };

      mockVersionControlDBPrismaService.repository.findUnique.mockResolvedValue(mockRepository);
      mockVersionControlDBPrismaService.branch.findFirst.mockResolvedValue(null);
      mockVersionControlDBPrismaService.branch.create.mockResolvedValue(mockBranch);

      const result = await service.createBranch({
        repositoryId,
        branchName,
        author
      });

      expect(result).toBeDefined();
      expect(result.name).toBe(branchName);
      expect(mockVersionControlDBPrismaService.branch.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: branchName,
          repositoryId: mockRepository.id,
          metadata: expect.objectContaining({
            author: author.name
          })
        })
      });
    });

    it('should throw NotFoundException if repository not found', async () => {
      const repositoryId = 'non-existent-repo';
      mockVersionControlDBPrismaService.repository.findUnique.mockResolvedValue(null);

      await expect(service.createBranch({
        repositoryId,
        branchName: 'test',
        author: { name: 'Test', email: 'test@example.com' }
      })).rejects.toThrow(
        new NotFoundException(`Repository with ID ${repositoryId} not found`)
      );
    });
  });

  describe('switchBranch', () => {
    it('should switch to a different branch', async () => {
      const repositoryId = 'test-repo';
      const branchName = 'feature/test';
      const mockRepository = { id: 'repo-id', currentBranch: 'main' };
      const mockBranch = { id: 'branch-id', name: branchName };

      mockVersionControlDBPrismaService.repository.findUnique.mockResolvedValue(mockRepository);
      mockVersionControlDBPrismaService.branch.findFirst.mockResolvedValue(mockBranch);
      mockVersionControlDBPrismaService.repository.update.mockResolvedValue({});
      mockVersionControlDBPrismaService.branch.updateMany.mockResolvedValue({});
      mockVersionControlDBPrismaService.branch.update.mockResolvedValue({});

      await service.switchBranch(repositoryId, branchName);

      expect(mockVersionControlDBPrismaService.repository.update).toHaveBeenCalledWith({
        where: { id: mockRepository.id },
        data: { currentBranch: branchName }
      });
      expect(mockVersionControlDBPrismaService.branch.updateMany).toHaveBeenCalledWith({
        where: { repositoryId: mockRepository.id },
        data: { isActive: false }
      });
      expect(mockVersionControlDBPrismaService.branch.update).toHaveBeenCalledWith({
        where: { id: mockBranch.id },
        data: { isActive: true }
      });
    });
  });

  describe('getBranches', () => {
    it('should return all branches for a repository', async () => {
      const repositoryId = 'test-repo';
      const mockRepository = { id: 'repo-id' };
      const mockBranches = [
        { id: 'branch-1', name: 'main' },
        { id: 'branch-2', name: 'feature/test' }
      ];

      mockVersionControlDBPrismaService.repository.findUnique.mockResolvedValue(mockRepository);
      mockVersionControlDBPrismaService.branch.findMany.mockResolvedValue(mockBranches);

      const result = await service.getBranches(repositoryId);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('main');
      expect(result[1].name).toBe('feature/test');
    });
  });

  describe('getBranch', () => {
    it('should return a specific branch', async () => {
      const repositoryId = 'test-repo';
      const branchName = 'main';
      const mockRepository = { id: 'repo-id' };
      const mockBranch = { id: 'branch-id', name: branchName };

      mockVersionControlDBPrismaService.repository.findUnique.mockResolvedValue(mockRepository);
      mockVersionControlDBPrismaService.branch.findFirst.mockResolvedValue(mockBranch);

      const result = await service.getBranch(repositoryId, branchName);

      expect(result).toBeDefined();
      expect(result?.name).toBe(branchName);
    });

    it('should return null for non-existent branch', async () => {
      const repositoryId = 'test-repo';
      const branchName = 'non-existent';
      const mockRepository = { id: 'repo-id' };

      mockVersionControlDBPrismaService.repository.findUnique.mockResolvedValue(mockRepository);
      mockVersionControlDBPrismaService.branch.findFirst.mockResolvedValue(null);

      const result = await service.getBranch(repositoryId, branchName);

      expect(result).toBeNull();
    });
  });

  describe('deleteBranch', () => {
    it('should delete a branch', async () => {
      const repositoryId = 'test-repo';
      const branchName = 'feature/test';
      const mockRepository = { id: 'repo-id', currentBranch: 'main' };
      const mockBranch = { id: 'branch-id', name: branchName };

      mockVersionControlDBPrismaService.repository.findUnique.mockResolvedValue(mockRepository);
      mockVersionControlDBPrismaService.branch.findFirst.mockResolvedValue(mockBranch);
      mockVersionControlDBPrismaService.branch.delete.mockResolvedValue({});

      const result = await service.deleteBranch(repositoryId, branchName);

      expect(result).toBe(true);
      expect(mockVersionControlDBPrismaService.branch.delete).toHaveBeenCalledWith({
        where: { id: mockBranch.id }
      });
    });

    it('should return false for non-existent branch', async () => {
      const repositoryId = 'test-repo';
      const branchName = 'non-existent';
      const mockRepository = { id: 'repo-id' };

      mockVersionControlDBPrismaService.repository.findUnique.mockResolvedValue(mockRepository);
      mockVersionControlDBPrismaService.branch.findFirst.mockResolvedValue(null);

      const result = await service.deleteBranch(repositoryId, branchName);

      expect(result).toBe(false);
    });

    it('should throw ConflictException when trying to delete current branch', async () => {
      const repositoryId = 'test-repo';
      const branchName = 'main';
      const mockRepository = { id: 'repo-id', currentBranch: 'main' };
      const mockBranch = { id: 'branch-id', name: branchName };

      mockVersionControlDBPrismaService.repository.findUnique.mockResolvedValue(mockRepository);
      mockVersionControlDBPrismaService.branch.findFirst.mockResolvedValue(mockBranch);

      try {
        await service.deleteBranch(repositoryId, branchName);
        fail('Expected ConflictException to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ConflictException);
        const actualMessage = (error as ConflictException).message;
        expect(actualMessage).toContain(`Cannot delete the current branch ${branchName}`);
      }
    });
  });

  describe('getCommit', () => {
    it('should return a specific commit', async () => {
      const repositoryId = 'test-repo';
      const commitId = 'commit-id';
      const mockRepository = { id: 'repo-id' };
      const mockCommit = {
        id: 'commit-db-id',
        objectId: commitId,
        treeId: 'tree-id',
        message: 'Test commit',
        authorName: 'Test User',
        authorEmail: 'test@example.com',
        authorTimestamp: new Date(),
        committerName: 'Test User',
        committerEmail: 'test@example.com',
        committerTimestamp: new Date()
      };
      const mockGitObject = { id: 'git-obj-id', type: 'commit', content: {}, size: 100 };

      mockVersionControlDBPrismaService.repository.findUnique.mockResolvedValue(mockRepository);
      mockVersionControlDBPrismaService.commit.findUnique.mockResolvedValue(mockCommit);
      mockVersionControlDBPrismaService.gitObject.findUnique.mockResolvedValue(mockGitObject);
      mockVersionControlDBPrismaService.commitParent.findMany.mockResolvedValue([]);
      mockVersionControlDBPrismaService.change.findMany.mockResolvedValue([]);

      const result = await service.getCommit(repositoryId, commitId);

      expect(result).toBeDefined();
      expect(result?.objectId).toBe(commitId);
    });

    it('should return null for non-existent commit', async () => {
      const repositoryId = 'test-repo';
      const commitId = 'non-existent';
      const mockRepository = { id: 'repo-id' };

      mockVersionControlDBPrismaService.repository.findUnique.mockResolvedValue(mockRepository);
      mockVersionControlDBPrismaService.commit.findUnique.mockResolvedValue(null);

      const result = await service.getCommit(repositoryId, commitId);

      expect(result).toBeNull();
    });
  });

  describe('getStatus', () => {
    it('should return working tree status', async () => {
      const repositoryId = 'test-repo';
      const mockRepository = { id: 'repo-id', currentBranch: 'main' };
      const mockBranch = { id: 'branch-id', name: 'main' };

      mockVersionControlDBPrismaService.repository.findUnique.mockResolvedValue(mockRepository);
      mockVersionControlDBPrismaService.branch.findFirst.mockResolvedValue(mockBranch);

      const result = await service.getStatus(repositoryId);

      expect(result).toBeDefined();
      expect(result.staged).toEqual([]);
      expect(result.unstaged).toEqual([]);
      expect(result.untracked).toEqual([]);
      expect(result.modified).toEqual([]);
      expect(result.deleted).toEqual([]);
    });
  });

  describe('getTree', () => {
    it('should return a tree object', async () => {
      const treeId = 'tree-id';
      const mockGitObject = {
        id: 'git-obj-id',
        objectId: treeId,
        type: 'tree',
        content: {},
        size: 100
      };
      const mockTreeEntries = [
        {
          mode: '100644',
          name: 'test.txt',
          objectId: 'blob-id',
          type: 'blob'
        }
      ];

      mockVersionControlDBPrismaService.gitObject.findUnique.mockResolvedValue(mockGitObject);
      mockVersionControlDBPrismaService.treeEntry.findMany.mockResolvedValue(mockTreeEntries);

      const result = await service.getTree(treeId);

      expect(result).toBeDefined();
      expect(result?.objectId).toBe(treeId);
      expect(result?.type).toBe('tree');
      expect(result?.content.entries).toHaveLength(1);
      expect(result?.content.entries[0].name).toBe('test.txt');
    });

    it('should return null for non-tree object', async () => {
      const treeId = 'not-tree-id';
      mockVersionControlDBPrismaService.gitObject.findUnique.mockResolvedValue(null);

      const result = await service.getTree(treeId);

      expect(result).toBeNull();
    });
  });

  describe('getBlob', () => {
    it('should return a blob object', async () => {
      const blobId = 'blob-id';
      const mockGitObject = {
        id: 'git-obj-id',
        objectId: blobId,
        type: 'blob',
        content: { data: 'test content' },
        size: 12
      };

      mockVersionControlDBPrismaService.gitObject.findUnique.mockResolvedValue(mockGitObject);

      const result = await service.getBlob(blobId);

      expect(result).toBeDefined();
      expect(result?.objectId).toBe(blobId);
      expect(result?.type).toBe('blob');
      expect(result?.content).toEqual({ data: 'test content' });
    });

    it('should return null for non-blob object', async () => {
      const blobId = 'not-blob-id';
      mockVersionControlDBPrismaService.gitObject.findUnique.mockResolvedValue(null);

      const result = await service.getBlob(blobId);

      expect(result).toBeNull();
    });
  });

  describe('resetToCommit', () => {
    it('should reset branch to specific commit', async () => {
      const repositoryId = 'test-repo';
      const commitId = 'reset-commit-id';
      const mode = 'soft' as const;
      const mockRepository = { id: 'repo-id', currentBranch: 'main' };
      const mockBranch = { id: 'branch-id', name: 'main' };
      const mockCommit = {
        id: 'commit-db-id',
        objectId: commitId,
        treeId: 'tree-id',
        message: 'Reset target commit'
      };

      mockVersionControlDBPrismaService.repository.findUnique.mockResolvedValue(mockRepository);
      mockVersionControlDBPrismaService.commit.findUnique.mockResolvedValue(mockCommit);
      mockVersionControlDBPrismaService.branch.findFirst.mockResolvedValue(mockBranch);
      mockVersionControlDBPrismaService.branch.update.mockResolvedValue({});

      await service.resetToCommit(repositoryId, commitId, mode);

      expect(mockVersionControlDBPrismaService.branch.update).toHaveBeenCalledWith({
        where: { id: mockBranch.id },
        data: { headCommitId: commitId }
      });
    });

    it('should throw NotFoundException for non-existent commit', async () => {
      const repositoryId = 'test-repo';
      const commitId = 'non-existent-commit';
      const mode = 'soft' as const;
      const mockRepository = { id: 'repo-id' };

      mockVersionControlDBPrismaService.repository.findUnique.mockResolvedValue(mockRepository);
      mockVersionControlDBPrismaService.commit.findUnique.mockResolvedValue(null);

      await expect(service.resetToCommit(repositoryId, commitId, mode)).rejects.toThrow(
        new NotFoundException(`Commit ${commitId} not found`)
      );
    });
  });
});