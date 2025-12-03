import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
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
import { VersionControlDBPrismaService } from 'VersionControl-db'
import type { GitObjectModel, CommitModel, BranchModel, ChangeModel } from 'VersionControl-db/models';
import { createHash } from 'crypto';

/**
 */
@Injectable()
export class GitVersionControlService implements IGitVersionControl {
  constructor(private versionControlDbService: VersionControlDBPrismaService) {}

  /**
   * Generate SHA-1 hash for git objects
   */
  private generateObjectId(content: string | object): string {
    const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
    return createHash('sha1').update(contentStr).digest('hex');
  }

  /**
   * Convert database GitObject to domain GitObject
   */
  private dbGitObjectToDomain(dbGitObject: GitObjectModel): GitObject {
    return {
      objectId: dbGitObject.objectId,
      type: dbGitObject.type as 'commit' | 'tree' | 'blob',
      content: dbGitObject.content,
      size: dbGitObject.size
    };
  }

  /**
   * Convert database Commit to domain Commit
   */
  private async dbCommitToDomain(dbCommit: CommitModel): Promise<Commit> {
    const gitObject = await this.versionControlDbService.gitObject.findUnique({
      where: { objectId: dbCommit.objectId }
    });

    if (!gitObject) {
      throw new NotFoundException(`GitObject not found for commit ${dbCommit.id}`);
    }

    // Get parent commits
    const parentCommits = await this.versionControlDbService.commitParent.findMany({
      where: { commitId: dbCommit.id },
      include: { parent: true }
    });

    // Get changes
    const changes = await this.versionControlDbService.change.findMany({
      where: { commitId: dbCommit.id }
    });

    const changeSet: ChangeSet = {
      added: changes.filter(c => c.changeType === 'add').map(c => ({
        path: c.path,
        objectId: c.objectId,
        type: c.type as 'entity' | 'vertex' | 'property' | 'edge',
        diff: c.diff ? c.diff as unknown as Diff : undefined
      })),
      modified: changes.filter(c => c.changeType === 'modify').map(c => ({
        path: c.path,
        objectId: c.objectId,
        type: c.type as 'entity' | 'vertex' | 'property' | 'edge',
        diff: c.diff ? c.diff as unknown as Diff : undefined
      })),
      deleted: changes.filter(c => c.changeType === 'delete').map(c => ({
        path: c.path,
        objectId: c.objectId,
        type: c.type as 'entity' | 'vertex' | 'property' | 'edge',
        diff: c.diff ? c.diff as unknown as Diff : undefined
      }))
    };

    return {
      objectId: dbCommit.objectId,
      type: 'commit',
      content: {
        tree: dbCommit.treeId,
        parents: parentCommits.map(pc => pc.parent.objectId),
        author: {
          name: dbCommit.authorName,
          email: dbCommit.authorEmail,
          timestamp: dbCommit.authorTimestamp
        },
        committer: {
          name: dbCommit.committerName,
          email: dbCommit.committerEmail,
          timestamp: dbCommit.committerTimestamp
        },
        message: dbCommit.message,
        changes: changeSet
      },
      size: gitObject.size
    };
  }

  /**
   * Convert database Branch to domain Branch
   */
  private dbBranchToDomain(dbBranch: BranchModel): Branch {
    return {
      branchId: dbBranch.branchId,
      name: dbBranch.name,
      headCommitId: dbBranch.headCommitId,
      baseCommitId: dbBranch.baseCommitId,
      createdAt: dbBranch.createdAt,
      updatedAt: dbBranch.updatedAt,
      isActive: dbBranch.isActive,
      metadata: dbBranch.metadata as any
    };
  }
  async initRepository(repositoryId: string): Promise<void> {
    // Check if repository already exists
    const existingRepo = await this.versionControlDbService.repository.findUnique({
      where: { repositoryId }
    });

    if (existingRepo) {
      throw new ConflictException(`Repository with ID ${repositoryId} already exists`);
    }

    // Create new repository
    await this.versionControlDbService.repository.create({
      data: {
        repositoryId,
        currentBranch: 'main'
      }
    });

    // Create default main branch
    await this.createBranch({
      repositoryId,
      branchName: 'main',
      author: {
        name: 'System',
        email: 'system@example.com'
      }
    });
  }
  async createCommit(options: { repositoryId: string; branchName: string; message: string; author: { name: string; email: string; }; changes: ChangeSet; parentCommitIds?: string[]; }): Promise<Commit> {
    const { repositoryId, branchName, message, author, changes, parentCommitIds } = options;

    // Check if repository exists
    const repository = await this.versionControlDbService.repository.findUnique({
      where: { repositoryId }
    });

    if (!repository) {
      throw new NotFoundException(`Repository with ID ${repositoryId} not found`);
    }

    // Get branch
    const branch = await this.versionControlDbService.branch.findFirst({
      where: {
        name: branchName,
        repositoryId: repository.id
      }
    });

    if (!branch) {
      throw new NotFoundException(`Branch ${branchName} not found in repository ${repositoryId}`);
    }

    // Create tree object for the commit
    const treeContent = {
      entries: [
        ...changes.added.map(c => ({ mode: '100644', name: c.path, objectId: c.objectId, type: 'blob' as const })),
        ...changes.modified.map(c => ({ mode: '100644', name: c.path, objectId: c.objectId, type: 'blob' as const }))
      ]
    };

    const treeObjectId = this.generateObjectId(treeContent);
    const treeSize = JSON.stringify(treeContent).length;

    // Create tree object in database
    const treeGitObject = await this.versionControlDbService.gitObject.create({
      data: {
        objectId: treeObjectId,
        type: 'tree',
        content: treeContent,
        size: treeSize
      }
    });

    // Create commit content
    const commitContent = {
      tree: treeObjectId,
      parents: parentCommitIds || [branch.headCommitId].filter(id => id),
      author: {
        name: author.name,
        email: author.email,
        timestamp: new Date()
      },
      committer: {
        name: author.name,
        email: author.email,
        timestamp: new Date()
      },
      message,
      changes: changes as ChangeSet // Convert to ChangeSet for JSON compatibility
    };

    const commitObjectId = this.generateObjectId(commitContent);
    const commitSize = JSON.stringify(commitContent).length;

    // Create commit git object
    const commitGitObject = await this.versionControlDbService.gitObject.create({
      data: {
        objectId: commitObjectId,
        type: 'commit',
        content: commitContent as any, // Convert to any for JSON compatibility
        size: commitSize
      }
    });

    // Create commit record
    const dbCommit = await this.versionControlDbService.commit.create({
      data: {
        objectId: commitObjectId,
        treeId: treeObjectId,
        message,
        authorName: author.name,
        authorEmail: author.email,
        authorTimestamp: new Date(),
        committerName: author.name,
        committerEmail: author.email,
        committerTimestamp: new Date()
      }
    });

    // Create parent commit relationships
    if (parentCommitIds && parentCommitIds.length > 0) {
      for (const parentId of parentCommitIds) {
        const parentCommit = await this.versionControlDbService.commit.findUnique({
          where: { objectId: parentId }
        });

        if (parentCommit) {
          await this.versionControlDbService.commitParent.create({
            data: {
              commitId: dbCommit.id,
              parentId: parentCommit.id
            }
          });
        }
      }
    } else if (branch.headCommitId) {
      const parentCommit = await this.versionControlDbService.commit.findUnique({
        where: { objectId: branch.headCommitId }
      });

      if (parentCommit) {
        await this.versionControlDbService.commitParent.create({
          data: {
            commitId: dbCommit.id,
            parentId: parentCommit.id
          }
        });
      }
    }

    // Create change records
    const allChanges = [
      ...changes.added.map(c => ({ ...c, changeType: 'add' as const })),
      ...changes.modified.map(c => ({ ...c, changeType: 'modify' as const })),
      ...changes.deleted.map(c => ({ ...c, changeType: 'delete' as const }))
    ];

    for (const change of allChanges) {
      await this.versionControlDbService.change.create({
        data: {
          path: change.path,
          objectId: change.objectId,
          type: change.type,
          changeType: change.changeType,
          diff: change.diff as any,
          commitId: dbCommit.id
        }
      });
    }

    // Update branch head commit
    await this.versionControlDbService.branch.update({
      where: { id: branch.id },
      data: { headCommitId: commitObjectId }
    });

    // Create branch-commit association
    await this.versionControlDbService.branchCommit.create({
      data: {
        branchId: branch.id,
        commitId: dbCommit.id
      }
    });

    return this.dbCommitToDomain(dbCommit);
  }
  async createBranch(options: { repositoryId: string; branchName: string; baseCommitId?: string; author: { name: string; email: string; }; }): Promise<Branch> {
    const { repositoryId, branchName, baseCommitId, author } = options;

    // Check if repository exists
    const repository = await this.versionControlDbService.repository.findUnique({
      where: { repositoryId }
    });

    if (!repository) {
      throw new NotFoundException(`Repository with ID ${repositoryId} not found`);
    }

    // Check if branch already exists
    const existingBranch = await this.versionControlDbService.branch.findFirst({
      where: {
        name: branchName,
        repositoryId: repository.id
      }
    });

    if (existingBranch) {
      throw new ConflictException(`Branch ${branchName} already exists in repository ${repositoryId}`);
    }

    // Determine base commit ID
    let headCommitId = baseCommitId;
    if (!headCommitId) {
      // If no base commit specified, use the current branch's head commit
      const currentBranch = await this.versionControlDbService.branch.findFirst({
        where: {
          name: repository.currentBranch,
          repositoryId: repository.id
        }
      });
      headCommitId = currentBranch?.headCommitId || '';
    }

    // Create new branch
    const newBranch = await this.versionControlDbService.branch.create({
      data: {
        branchId: this.generateObjectId({ repositoryId, branchName, timestamp: new Date() }),
        name: branchName,
        headCommitId,
        baseCommitId: headCommitId,
        isActive: false,
        repositoryId: repository.id,
        metadata: {
          author: author.name,
          description: `Branch ${branchName} created by ${author.name}`
        }
      }
    });

    return this.dbBranchToDomain(newBranch);
  }
  async switchBranch(repositoryId: string, branchName: string): Promise<void> {
    // Check if repository exists
    const repository = await this.versionControlDbService.repository.findUnique({
      where: { repositoryId }
    });

    if (!repository) {
      throw new NotFoundException(`Repository with ID ${repositoryId} not found`);
    }

    // Check if branch exists
    const branch = await this.versionControlDbService.branch.findFirst({
      where: {
        name: branchName,
        repositoryId: repository.id
      }
    });

    if (!branch) {
      throw new NotFoundException(`Branch ${branchName} not found in repository ${repositoryId}`);
    }

    // Update repository's current branch
    await this.versionControlDbService.repository.update({
      where: { id: repository.id },
      data: { currentBranch: branchName }
    });

    // Set all branches to inactive, then activate the target branch
    await this.versionControlDbService.branch.updateMany({
      where: { repositoryId: repository.id },
      data: { isActive: false }
    });

    await this.versionControlDbService.branch.update({
      where: { id: branch.id },
      data: { isActive: true }
    });
  }
  async mergeBranch(options: { repositoryId: string; sourceBranch: string; targetBranch: string; author: { name: string; email: string; }; message?: string; }): Promise<MergeResult> {
    const { repositoryId, sourceBranch, targetBranch, author, message } = options;

    // Check if repository exists
    const repository = await this.versionControlDbService.repository.findUnique({
      where: { repositoryId }
    });

    if (!repository) {
      throw new NotFoundException(`Repository with ID ${repositoryId} not found`);
    }

    // Get both branches
    const source = await this.versionControlDbService.branch.findFirst({
      where: {
        name: sourceBranch,
        repositoryId: repository.id
      }
    });

    const target = await this.versionControlDbService.branch.findFirst({
      where: {
        name: targetBranch,
        repositoryId: repository.id
      }
    });

    if (!source) {
      throw new NotFoundException(`Source branch ${sourceBranch} not found in repository ${repositoryId}`);
    }

    if (!target) {
      throw new NotFoundException(`Target branch ${targetBranch} not found in repository ${repositoryId}`);
    }

    // Get commits from both branches
    const sourceCommits = await this.versionControlDbService.branchCommit.findMany({
      where: { branchId: source.id },
      include: { commit: true }
    });

    const targetCommits = await this.versionControlDbService.branchCommit.findMany({
      where: { branchId: target.id },
      include: { commit: true }
    });

    // Find common ancestor (simplified - just use target's head commit as base)
    const baseCommitId = target.headCommitId;

    // Check for conflicts (simplified - no conflict detection in this implementation)
    const conflicts: MergeConflict[] = [];

    if (conflicts.length > 0) {
      // Record failed merge
      await this.versionControlDbService.mergeResult.create({
        data: {
          sourceBranch,
          targetBranch,
          repositoryId,
          success: false,
          message: `Merge failed due to ${conflicts.length} conflicts`,
          conflicts: conflicts as any
        }
      });

      return {
        success: false,
        conflicts,
        message: `Merge failed due to ${conflicts.length} conflicts`
      };
    }

    // Create merge commit
    const mergeMessage = message || `Merge branch ${sourceBranch} into ${targetBranch}`;
    
    // Get changes from source branch commits that aren't in target
    const sourceCommitIds = sourceCommits.map(sc => sc.commitId);
    const targetCommitIds = targetCommits.map(tc => tc.commitId);
    const newCommitIds = sourceCommitIds.filter(id => !targetCommitIds.includes(id));

    const newCommits = await this.versionControlDbService.commit.findMany({
      where: { id: { in: newCommitIds } },
      include: { changes: true }
    });

    // Aggregate all changes from new commits
    const allChanges: Change[] = [];
    for (const commit of newCommits) {
      for (const change of commit.changes) {
        allChanges.push({
          path: change.path,
          objectId: change.objectId,
          type: change.type as 'entity' | 'vertex' | 'property' | 'edge',
          diff: change.diff as any
        });
      }
    }

    const changeSet: ChangeSet = {
      added: allChanges.filter(c => c.diff && typeof c.diff === 'object' && 'changeType' in c.diff ? (c.diff as Diff).changeType === 'add' : false),
      modified: allChanges.filter(c => c.diff && typeof c.diff === 'object' && 'changeType' in c.diff ? (c.diff as Diff).changeType === 'modify' : false),
      deleted: allChanges.filter(c => c.diff && typeof c.diff === 'object' && 'changeType' in c.diff ? (c.diff as Diff).changeType === 'delete' : false)
    };

    // Create merge commit
    const mergeCommit = await this.createCommit({
      repositoryId,
      branchName: targetBranch,
      message: mergeMessage,
      author,
      changes: changeSet,
      parentCommitIds: [target.headCommitId, source.headCommitId].filter(id => id)
    });

    // Record successful merge
    await this.versionControlDbService.mergeResult.create({
      data: {
        sourceBranch,
        targetBranch,
        repositoryId,
        success: true,
        mergeCommitId: mergeCommit.objectId,
        message: mergeMessage
      }
    });

    return {
      success: true,
      mergeCommitId: mergeCommit.objectId,
      message: mergeMessage
    };
  }
  async getCommitHistory(options: { repositoryId: string; branchName?: string; limit?: number; offset?: number; since?: Date; until?: Date; }): Promise<Commit[]> {
    const { repositoryId, branchName, limit = 50, offset = 0, since, until } = options;

    // Check if repository exists
    const repository = await this.versionControlDbService.repository.findUnique({
      where: { repositoryId }
    });

    if (!repository) {
      throw new NotFoundException(`Repository with ID ${repositoryId} not found`);
    }

    // Determine which branch to get history from
    const targetBranchName = branchName || repository.currentBranch;
    
    // Get branch
    const branch = await this.versionControlDbService.branch.findFirst({
      where: {
        name: targetBranchName,
        repositoryId: repository.id
      }
    });

    if (!branch) {
      throw new NotFoundException(`Branch ${targetBranchName} not found in repository ${repositoryId}`);
    }

    // Get branch commits with pagination and date filtering
    const branchCommits = await this.versionControlDbService.branchCommit.findMany({
      where: {
        branchId: branch.id
      },
      orderBy: { id: 'desc' },
      skip: offset,
      take: limit
    });

    // Get the actual commits
    const commitIds = branchCommits.map(bc => bc.commitId);
    const commits = await this.versionControlDbService.commit.findMany({
      where: {
        id: { in: commitIds },
        ...(since && { authorTimestamp: { gte: since } }),
        ...(until && { authorTimestamp: { lte: until } })
      },
      orderBy: { authorTimestamp: 'desc' }
    });

    // Convert to domain commits
    const domainCommits: Commit[] = [];
    for (const commit of commits) {
      domainCommits.push(await this.dbCommitToDomain(commit));
    }

    return domainCommits;
  }
  async compareCommits(repositoryId: string, commitId1: string, commitId2: string): Promise<CommitDiff> {
    // Check if repository exists
    const repository = await this.versionControlDbService.repository.findUnique({
      where: { repositoryId }
    });

    if (!repository) {
      throw new NotFoundException(`Repository with ID ${repositoryId} not found`);
    }

    // Get both commits
    const commit1 = await this.versionControlDbService.commit.findUnique({
      where: { objectId: commitId1 }
    });

    const commit2 = await this.versionControlDbService.commit.findUnique({
      where: { objectId: commitId2 }
    });

    if (!commit1) {
      throw new NotFoundException(`Commit ${commitId1} not found`);
    }

    if (!commit2) {
      throw new NotFoundException(`Commit ${commitId2} not found`);
    }

    // Get changes for both commits
    const changes1 = await this.versionControlDbService.change.findMany({
      where: { commitId: commit1.id }
    });

    const changes2 = await this.versionControlDbService.change.findMany({
      where: { commitId: commit2.id }
    });

    // Convert to domain commits
    const domainCommit1 = await this.dbCommitToDomain(commit1);
    const domainCommit2 = await this.dbCommitToDomain(commit2);

    // Calculate diff changes
    const diffChanges: DiffChange[] = [];
    let filesChanged = 0;
    let insertions = 0;
    let deletions = 0;

    // Process changes from commit1
    for (const change of changes1) {
      const diffChange: DiffChange = {
        path: change.path,
        type: change.type as 'entity' | 'vertex' | 'property' | 'edge',
        changeType: change.changeType as 'add' | 'modify' | 'delete',
        oldContent: change.changeType === 'delete' && change.diff && typeof change.diff === 'object' && 'old' in (change.diff as any) ? (change.diff as any).old : undefined,
        newContent: change.changeType === 'add' && change.diff && typeof change.diff === 'object' && 'new' in (change.diff as any) ? (change.diff as any).new : undefined,
        diff: change.diff as string | undefined
      };
      
      diffChanges.push(diffChange);
      filesChanged++;
      
      if (change.changeType === 'add') insertions++;
      if (change.changeType === 'delete') deletions++;
    }

    // Process changes from commit2 that aren't in commit1
    for (const change of changes2) {
      const existsInCommit1 = changes1.some(c1 => c1.path === change.path && c1.type === change.type);
      
      if (!existsInCommit1) {
        const diffChange: DiffChange = {
          path: change.path,
          type: change.type as 'entity' | 'vertex' | 'property' | 'edge',
          changeType: change.changeType as 'add' | 'modify' | 'delete',
          oldContent: change.changeType === 'delete' ? (change.diff as any)?.old : undefined,
          newContent: change.changeType === 'add' ? (change.diff as any)?.new : undefined,
          diff: change.diff as string | undefined
        };
        
        diffChanges.push(diffChange);
        filesChanged++;
        
        if (change.changeType === 'add') insertions++;
        if (change.changeType === 'delete') deletions++;
      }
    }

    return {
      commit1: domainCommit1,
      commit2: domainCommit2,
      changes: diffChanges,
      summary: {
        filesChanged,
        insertions,
        deletions
      }
    };
  }
  async resetToCommit(repositoryId: string, commitId: string, mode: 'soft' | 'mixed' | 'hard'): Promise<void> {
    // Check if repository exists
    const repository = await this.versionControlDbService.repository.findUnique({
      where: { repositoryId }
    });

    if (!repository) {
      throw new NotFoundException(`Repository with ID ${repositoryId} not found`);
    }

    // Check if commit exists
    const commit = await this.versionControlDbService.commit.findUnique({
      where: { objectId: commitId }
    });

    if (!commit) {
      throw new NotFoundException(`Commit ${commitId} not found`);
    }

    // Get current branch
    const currentBranch = await this.versionControlDbService.branch.findFirst({
      where: {
        name: repository.currentBranch,
        repositoryId: repository.id
      }
    });

    if (!currentBranch) {
      throw new NotFoundException(`Current branch ${repository.currentBranch} not found in repository ${repositoryId}`);
    }

    switch (mode) {
      case 'soft':
        // Soft reset: only move branch pointer, keep changes staged
        await this.versionControlDbService.branch.update({
          where: { id: currentBranch.id },
          data: { headCommitId: commitId }
        });
        break;

      case 'mixed':
        // Mixed reset: move branch pointer and unstage changes
        await this.versionControlDbService.branch.update({
          where: { id: currentBranch.id },
          data: { headCommitId: commitId }
        });
        // In a real implementation, this would also clear the staging area
        break;

      case 'hard':
        // Hard reset: move branch pointer and discard all changes
        await this.versionControlDbService.branch.update({
          where: { id: currentBranch.id },
          data: { headCommitId: commitId }
        });
        // In a real implementation, this would also discard working tree changes
        break;

      default:
        throw new Error(`Invalid reset mode: ${mode}`);
    }
  }
  async getBranches(repositoryId: string): Promise<Branch[]> {
    // Check if repository exists
    const repository = await this.versionControlDbService.repository.findUnique({
      where: { repositoryId }
    });

    if (!repository) {
      throw new NotFoundException(`Repository with ID ${repositoryId} not found`);
    }

    const branches = await this.versionControlDbService.branch.findMany({
      where: { repositoryId: repository.id },
      orderBy: { createdAt: 'asc' }
    });

    return branches.map(branch => this.dbBranchToDomain(branch));
  }
  async getStatus(repositoryId: string): Promise<WorkingTreeStatus> {
    // Check if repository exists
    const repository = await this.versionControlDbService.repository.findUnique({
      where: { repositoryId }
    });

    if (!repository) {
      throw new NotFoundException(`Repository with ID ${repositoryId} not found`);
    }

    // Get current branch
    const currentBranch = await this.versionControlDbService.branch.findFirst({
      where: {
        name: repository.currentBranch,
        repositoryId: repository.id
      }
    });

    if (!currentBranch) {
      throw new NotFoundException(`Current branch ${repository.currentBranch} not found in repository ${repositoryId}`);
    }

    // For this implementation, we'll return a basic status
    // In a real implementation, this would check for uncommitted changes
    // by comparing the working tree with the latest commit
    
    return {
      staged: [], // No staged changes in this basic implementation
      unstaged: [], // No unstaged changes in this basic implementation
      untracked: [], // No untracked files in this basic implementation
      modified: [], // No modified files in this basic implementation
      deleted: [] // No deleted files in this basic implementation
    };
  }
  async getCommit(repositoryId: string, commitId: string): Promise<Commit | null> {
    // Check if repository exists
    const repository = await this.versionControlDbService.repository.findUnique({
      where: { repositoryId }
    });

    if (!repository) {
      throw new NotFoundException(`Repository with ID ${repositoryId} not found`);
    }

    const commit = await this.versionControlDbService.commit.findUnique({
      where: { objectId: commitId }
    });

    return commit ? this.dbCommitToDomain(commit) : null;
  }
  async getBranch(repositoryId: string, branchName: string): Promise<Branch | null> {
    // Check if repository exists
    const repository = await this.versionControlDbService.repository.findUnique({
      where: { repositoryId }
    });

    if (!repository) {
      throw new NotFoundException(`Repository with ID ${repositoryId} not found`);
    }

    const branch = await this.versionControlDbService.branch.findFirst({
      where: {
        name: branchName,
        repositoryId: repository.id
      }
    });

    return branch ? this.dbBranchToDomain(branch) : null;
  }
  async deleteBranch(repositoryId: string, branchName: string): Promise<boolean> {
    // Check if repository exists
    const repository = await this.versionControlDbService.repository.findUnique({
      where: { repositoryId }
    });

    if (!repository) {
      throw new NotFoundException(`Repository with ID ${repositoryId} not found`);
    }

    // Check if branch exists
    const branch = await this.versionControlDbService.branch.findFirst({
      where: {
        name: branchName,
        repositoryId: repository.id
      }
    });

    if (!branch) {
      return false;
    }

    // Don't allow deleting the current branch
    if (repository.currentBranch === branchName) {
      throw new ConflictException(`Cannot delete the current branch ${branchName}`);
    }

    // Delete the branch (cascade will handle related records)
    await this.versionControlDbService.branch.delete({
      where: { id: branch.id }
    });

    return true;
  }
  async getTree(treeId: string): Promise<Tree | null> {
    const gitObject = await this.versionControlDbService.gitObject.findUnique({
      where: { objectId: treeId }
    });

    if (!gitObject || gitObject.type !== 'tree') {
      return null;
    }

    // Get tree entries
    const treeEntries = await this.versionControlDbService.treeEntry.findMany({
      where: { treeId: gitObject.id }
    });

    const entries: TreeEntry[] = treeEntries.map(entry => ({
      mode: entry.mode,
      name: entry.name,
      objectId: entry.objectId,
      type: entry.type as 'blob' | 'tree'
    }));

    return {
      objectId: gitObject.objectId,
      type: 'tree',
      content: { entries },
      size: gitObject.size
    };
  }
  async getBlob(blobId: string): Promise<Blob | null> {
    const gitObject = await this.versionControlDbService.gitObject.findUnique({
      where: { objectId: blobId }
    });

    if (!gitObject || gitObject.type !== 'blob') {
      return null;
    }

    return {
      objectId: gitObject.objectId,
      type: 'blob',
      content: gitObject.content,
      size: gitObject.size
    };
  }
 
}
