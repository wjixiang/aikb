import { Test, TestingModule } from '@nestjs/testing';
import { GitVersionControlService } from './version-control.service';
import {
  IGitVersionControl,
  GitObject,
  Commit,
  Tree,
  TreeEntry,
  Blob,
  ChangeSet,
  Change,
  Branch,
  Reference,
  MergeResult,
  MergeConflict,
  WorkingTreeStatus,
  Diff,
  CommitDiff,
  DiffChange,
  CreateCommitOptions,
  CreateBranchOptions,
  MergeBranchOptions,
  GetCommitHistoryOptions,
  AuthorInfo,
} from './types';
import { EntityData, VertexData, PropertyData, EdgeData } from '../types';

describe('GitVersionControlService', () => {
  let service: GitVersionControlService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GitVersionControlService],
    }).compile();

    service = module.get<GitVersionControlService>(GitVersionControlService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Repository Management', () => {
    it('should initialize a new repository', async () => {
      await service.initRepository('test-repo');

      const branches = await service.getBranches('test-repo');
      expect(branches).toHaveLength(1);
      expect(branches[0].name).toBe('main');
      expect(branches[0].isActive).toBe(true);
    });

    it('should throw error when initializing existing repository', async () => {
      await service.initRepository('test-repo');

      await expect(service.initRepository('test-repo')).rejects.toThrow(
        'Repository test-repo already exists',
      );
    });

    it('should create a new branch', async () => {
      await service.initRepository('test-repo');

      const branch = await service.createBranch({
        repositoryId: 'test-repo',
        branchName: 'feature/test',
        author: { name: 'Test User', email: 'test@example.com' },
      });

      expect(branch.name).toBe('feature/test');
      expect(branch.isActive).toBe(false);
      expect(branch.metadata?.author).toBe('Test User');
    });

    it('should throw error when creating existing branch', async () => {
      await service.initRepository('test-repo');
      await service.createBranch({
        repositoryId: 'test-repo',
        branchName: 'feature/test',
        author: { name: 'Test User', email: 'test@example.com' },
      });

      await expect(
        service.createBranch({
          repositoryId: 'test-repo',
          branchName: 'feature/test',
          author: { name: 'Test User', email: 'test@example.com' },
        }),
      ).rejects.toThrow('Branch feature/test already exists');
    });

    it('should switch branches', async () => {
      await service.initRepository('test-repo');
      await service.createBranch({
        repositoryId: 'test-repo',
        branchName: 'feature/test',
        author: { name: 'Test User', email: 'test@example.com' },
      });

      await service.switchBranch('test-repo', 'feature/test');

      const branches = await service.getBranches('test-repo');
      const mainBranch = branches.find((b) => b.name === 'main');
      const featureBranch = branches.find((b) => b.name === 'feature/test');

      expect(mainBranch?.isActive).toBe(false);
      expect(featureBranch?.isActive).toBe(true);
    });

    it('should delete branches', async () => {
      await service.initRepository('test-repo');
      await service.createBranch({
        repositoryId: 'test-repo',
        branchName: 'feature/test',
        author: { name: 'Test User', email: 'test@example.com' },
      });

      const deleted = await service.deleteBranch('test-repo', 'feature/test');
      expect(deleted).toBe(true);

      const branches = await service.getBranches('test-repo');
      expect(branches.find((b) => b.name === 'feature/test')).toBeUndefined();
    });

    it('should get all branches', async () => {
      await service.initRepository('test-repo');
      await service.createBranch({
        repositoryId: 'test-repo',
        branchName: 'feature/test',
        author: { name: 'Test User', email: 'test@example.com' },
      });

      const branches = await service.getBranches('test-repo');
      expect(branches).toHaveLength(2);
      expect(branches.map((b) => b.name)).toContain('main');
      expect(branches.map((b) => b.name)).toContain('feature/test');
    });
  });

  describe('Commit Management', () => {
    it('should create a commit', async () => {
      await service.initRepository('test-repo');

      const changes: ChangeSet = {
        added: [
          {
            path: 'entities/test-entity',
            objectId: 'entity-1',
            type: 'entity',
          },
        ],
        modified: [],
        deleted: [],
      };

      const commit = await service.createCommit({
        repositoryId: 'test-repo',
        branchName: 'main',
        message: 'Initial commit',
        author: { name: 'Test User', email: 'test@example.com' },
        changes,
      });

      expect(commit.objectId).toBeDefined();
      expect(commit.content.message).toBe('Initial commit');
      expect(commit.content.author.name).toBe('Test User');
      expect(commit.content.changes.added).toHaveLength(1);
    });

    it('should create commit with parents', async () => {
      await service.initRepository('test-repo');

      // Create initial commit
      const initialCommit = await service.createCommit({
        repositoryId: 'test-repo',
        branchName: 'main',
        message: 'Initial commit',
        author: { name: 'Test User', email: 'test@example.com' },
        changes: {
          added: [
            {
              path: 'entities/test-entity',
              objectId: 'entity-1',
              type: 'entity',
            },
          ],
          modified: [],
          deleted: [],
        },
      });

      // Create second commit with parent
      const secondCommit = await service.createCommit({
        repositoryId: 'test-repo',
        branchName: 'main',
        message: 'Second commit',
        author: { name: 'Test User', email: 'test@example.com' },
        changes: {
          added: [
            {
              path: 'entities/test-entity-2',
              objectId: 'entity-2',
              type: 'entity',
            },
          ],
          modified: [],
          deleted: [],
        },
        parentCommitIds: [initialCommit.objectId],
      });

      expect(secondCommit.content.parents).toContain(initialCommit.objectId);
    });

    it('should get commit history', async () => {
      await service.initRepository('test-repo');

      // Create multiple commits
      const commit1 = await service.createCommit({
        repositoryId: 'test-repo',
        branchName: 'main',
        message: 'First commit',
        author: { name: 'Test User', email: 'test@example.com' },
        changes: {
          added: [
            {
              path: 'entities/test-entity-1',
              objectId: 'entity-1',
              type: 'entity',
            },
          ],
          modified: [],
          deleted: [],
        },
      });

      const commit2 = await service.createCommit({
        repositoryId: 'test-repo',
        branchName: 'main',
        message: 'Second commit',
        author: { name: 'Test User', email: 'test@example.com' },
        changes: {
          added: [
            {
              path: 'entities/test-entity-2',
              objectId: 'entity-2',
              type: 'entity',
            },
          ],
          modified: [],
          deleted: [],
        },
        parentCommitIds: [commit1.objectId],
      });

      const history = await service.getCommitHistory({
        repositoryId: 'test-repo',
        limit: 10,
      });

      expect(history).toHaveLength(2);
      expect(history[0].content.message).toBe('Second commit');
      expect(history[1].content.message).toBe('First commit');
    });

    it('should get specific commit', async () => {
      await service.initRepository('test-repo');

      const commit = await service.createCommit({
        repositoryId: 'test-repo',
        branchName: 'main',
        message: 'Test commit',
        author: { name: 'Test User', email: 'test@example.com' },
        changes: {
          added: [
            {
              path: 'entities/test-entity',
              objectId: 'entity-1',
              type: 'entity',
            },
          ],
          modified: [],
          deleted: [],
        },
      });

      const retrieved = await service.getCommit('test-repo', commit.objectId);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.objectId).toBe(commit.objectId);
    });

    it('should compare commits', async () => {
      await service.initRepository('test-repo');

      const commit1 = await service.createCommit({
        repositoryId: 'test-repo',
        branchName: 'main',
        message: 'First commit',
        author: { name: 'Test User', email: 'test@example.com' },
        changes: {
          added: [
            {
              path: 'entities/test-entity-1',
              objectId: 'entity-1',
              type: 'entity',
            },
          ],
          modified: [],
          deleted: [],
        },
      });

      const commit2 = await service.createCommit({
        repositoryId: 'test-repo',
        branchName: 'main',
        message: 'Second commit',
        author: { name: 'Test User', email: 'test@example.com' },
        changes: {
          added: [
            {
              path: 'entities/test-entity-2',
              objectId: 'entity-2',
              type: 'entity',
            },
          ],
          modified: [],
          deleted: [],
        },
        parentCommitIds: [commit1.objectId],
      });

      const diff = await service.compareCommits(
        'test-repo',
        commit1.objectId,
        commit2.objectId,
      );
      expect(diff.commit1).not.toBeNull();
      expect(diff.commit2).not.toBeNull();
      expect(diff.changes).toBeDefined();
    });

    it('should reset to commit', async () => {
      await service.initRepository('test-repo');

      const commit1 = await service.createCommit({
        repositoryId: 'test-repo',
        branchName: 'main',
        message: 'First commit',
        author: { name: 'Test User', email: 'test@example.com' },
        changes: {
          added: [
            {
              path: 'entities/test-entity-1',
              objectId: 'entity-1',
              type: 'entity',
            },
          ],
          modified: [],
          deleted: [],
        },
      });

      const commit2 = await service.createCommit({
        repositoryId: 'test-repo',
        branchName: 'main',
        message: 'Second commit',
        author: { name: 'Test User', email: 'test@example.com' },
        changes: {
          added: [
            {
              path: 'entities/test-entity-2',
              objectId: 'entity-2',
              type: 'entity',
            },
          ],
          modified: [],
          deleted: [],
        },
        parentCommitIds: [commit1.objectId],
      });

      await service.resetToCommit('test-repo', commit1.objectId, 'hard');

      const currentBranch = await service.getBranch('test-repo', 'main');
      expect(currentBranch?.headCommitId).toBe(commit1.objectId);
    });
  });

  describe('Merge Operations', () => {
    it('should merge branches', async () => {
      await service.initRepository('test-repo');

      // Create main branch with initial commit
      const mainCommit = await service.createCommit({
        repositoryId: 'test-repo',
        branchName: 'main',
        message: 'Initial commit',
        author: { name: 'Test User', email: 'test@example.com' },
        changes: {
          added: [
            {
              path: 'entities/test-entity',
              objectId: 'entity-1',
              type: 'entity',
            },
          ],
          modified: [],
          deleted: [],
        },
      });

      // Create feature branch
      await service.createBranch({
        repositoryId: 'test-repo',
        branchName: 'feature/test',
        baseCommitId: mainCommit.objectId,
        author: { name: 'Test User', email: 'test@example.com' },
      });

      // Add commit to feature branch
      const featureCommit = await service.createCommit({
        repositoryId: 'test-repo',
        branchName: 'feature/test',
        message: 'Feature commit',
        author: { name: 'Test User', email: 'test@example.com' },
        changes: {
          added: [
            {
              path: 'entities/test-entity-2',
              objectId: 'entity-2',
              type: 'entity',
            },
          ],
          modified: [],
          deleted: [],
        },
      });

      // Merge feature into main
      const mergeResult = await service.mergeBranch({
        repositoryId: 'test-repo',
        sourceBranch: 'feature/test',
        targetBranch: 'main',
        author: { name: 'Test User', email: 'test@example.com' },
        message: 'Merge feature branch',
      });

      expect(mergeResult.success).toBe(true);
      expect(mergeResult.mergeCommitId).toBeDefined();

      const mainBranch = await service.getBranch('test-repo', 'main');
      expect(mainBranch?.headCommitId).toBe(mergeResult.mergeCommitId);
    });
  });

  describe('Object Storage', () => {
    it('should store and retrieve tree objects', async () => {
      await service.initRepository('test-repo');

      const changes: ChangeSet = {
        added: [
          {
            path: 'entities/test-entity',
            objectId: 'entity-1',
            type: 'entity',
          },
        ],
        modified: [],
        deleted: [],
      };

      const commit = await service.createCommit({
        repositoryId: 'test-repo',
        branchName: 'main',
        message: 'Test commit',
        author: { name: 'Test User', email: 'test@example.com' },
        changes,
      });

      const tree = await service.getTree(commit.content.tree);
      expect(tree).not.toBeNull();
      expect(tree?.type).toBe('tree');
      expect(tree?.content.entries).toHaveLength(1);
    });

    it('should store and retrieve blob objects', async () => {
      await service.initRepository('test-repo');

      const entityData: EntityData = {
        id: 'entity-1',
        nomanclature: [
          {
            name: 'Test Entity',
            acronym: 'TE',
            language: 'en',
          },
        ],
        abstract: {
          description: 'Test description',
          embedding: {
            config: { model: 'test', dimensions: 128 } as any,
            vector: new Array(128).fill(0.1),
          },
        },
      };

      const changes: ChangeSet = {
        added: [
          {
            path: 'entities/test-entity',
            objectId: 'entity-1',
            type: 'entity',
          },
        ],
        modified: [],
        deleted: [],
      };

      const commit = await service.createCommit({
        repositoryId: 'test-repo',
        branchName: 'main',
        message: 'Test commit',
        author: { name: 'Test User', email: 'test@example.com' },
        changes,
      });

      const blob = await service.getBlob('entity-1');
      expect(blob).not.toBeNull();
      expect(blob?.type).toBe('blob');
      expect(blob?.content).toEqual(entityData);
    });
  });

  describe('Working Tree Status', () => {
    it('should return working tree status', async () => {
      await service.initRepository('test-repo');

      const status = await service.getStatus('test-repo');
      expect(status.staged).toEqual([]);
      expect(status.unstaged).toEqual([]);
      expect(status.untracked).toEqual([]);
      expect(status.modified).toEqual([]);
      expect(status.deleted).toEqual([]);
    });
  });

  describe('Error Handling', () => {
    it('should throw error for non-existent repository', async () => {
      await expect(service.getBranches('non-existent-repo')).rejects.toThrow(
        'Repository non-existent-repo not found',
      );
    });

    it('should throw error for non-existent branch', async () => {
      await service.initRepository('test-repo');

      await expect(
        service.getBranch('test-repo', 'non-existent-branch'),
      ).rejects.toThrow('Branch non-existent-branch not found');
    });

    it('should throw error for non-existent commit', async () => {
      await service.initRepository('test-repo');

      const result = await service.getCommit(
        'test-repo',
        'non-existent-commit',
      );
      expect(result).toBeNull();
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle multiple repositories', async () => {
      await service.initRepository('repo-1');
      await service.initRepository('repo-2');

      const repo1Branches = await service.getBranches('repo-1');
      const repo2Branches = await service.getBranches('repo-2');

      expect(repo1Branches).toHaveLength(1);
      expect(repo2Branches).toHaveLength(1);
      expect(repo1Branches[0].name).toBe('main');
      expect(repo2Branches[0].name).toBe('main');
    });

    it('should handle complex commit history with pagination', async () => {
      await service.initRepository('test-repo');

      // Create multiple commits
      for (let i = 0; i < 15; i++) {
        await service.createCommit({
          repositoryId: 'test-repo',
          branchName: 'main',
          message: `Commit ${i + 1}`,
          author: { name: 'Test User', email: 'test@example.com' },
          changes: {
            added: [
              {
                path: `entities/test-entity-${i}`,
                objectId: `entity-${i}`,
                type: 'entity',
              },
            ],
            modified: [],
            deleted: [],
          },
        });
      }

      // Test pagination
      const firstPage = await service.getCommitHistory({
        repositoryId: 'test-repo',
        limit: 5,
        offset: 0,
      });

      const secondPage = await service.getCommitHistory({
        repositoryId: 'test-repo',
        limit: 5,
        offset: 5,
      });

      expect(firstPage).toHaveLength(5);
      expect(secondPage).toHaveLength(5);
      expect(firstPage[0].content.message).toBe('Commit 15');
      expect(secondPage[0].content.message).toBe('Commit 10');
    });
  });
});
