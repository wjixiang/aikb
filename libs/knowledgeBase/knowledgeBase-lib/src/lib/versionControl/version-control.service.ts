import { Injectable } from '@nestjs/common';
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
    AuthorInfo
} from './types';
import { EntityData, VertexData, PropertyData, EdgeData } from '../types';

/**
 * Git风格版本控制服务的内存实现
 * 用于验证版本控制功能，不依赖外部数据库
 */
@Injectable()
export class GitVersionControlService implements IGitVersionControl {
    // 内存存储
    private repositories: Map<string, Repository> = new Map();
    private objects: Map<string, GitObject> = new Map();
    private references: Map<string, Reference> = new Map();

    /**
     * 初始化仓库
     */
    async initRepository(repositoryId: string): Promise<void> {
        if (this.repositories.has(repositoryId)) {
            throw new Error(`Repository ${repositoryId} already exists`);
        }

        const repository: Repository = {
            repositoryId,
            branches: new Map(),
            currentBranch: 'main',
            createdAt: new Date()
        };

        // 创建默认main分支
        const mainBranch: Branch = {
            branchId: this.generateId(),
            name: 'main',
            headCommitId: '',
            baseCommitId: '',
            createdAt: new Date(),
            updatedAt: new Date(),
            isActive: true
        };

        repository.branches.set('main', mainBranch);
        this.repositories.set(repositoryId, repository);
    }

    /**
     * 创建提交
     */
    async createCommit(options: CreateCommitOptions): Promise<Commit> {
        const { repositoryId, branchName, message, author, changes, parentCommitIds } = options;
        
        const repository = this.repositories.get(repositoryId);
        if (!repository) {
            throw new Error(`Repository ${repositoryId} not found`);
        }

        const branch = repository.branches.get(branchName);
        if (!branch) {
            throw new Error(`Branch ${branchName} not found`);
        }

        // 1. 创建树对象
        const tree = await this.createTree(changes);
        
        // 2. 创建提交对象
        const commit: Commit = {
            objectId: this.generateObjectId(),
            type: 'commit',
            content: {
                tree: tree.objectId,
                parents: parentCommitIds || [branch.headCommitId],
                author: {
                    ...author,
                    timestamp: new Date()
                },
                committer: {
                    ...author,
                    timestamp: new Date()
                },
                message,
                changes
            },
            size: JSON.stringify(tree).length
        };

        // 3. 保存对象
        this.objects.set(commit.objectId, commit);
        this.objects.set(tree.objectId, tree);

        // 4. 保存blob对象
        for (const change of [...changes.added, ...changes.modified]) {
            const content = await this.getBlobContent(change);
            const blob: Blob = {
                objectId: change.objectId,
                type: 'blob',
                content,
                size: JSON.stringify(content).length
            };
            this.objects.set(change.objectId, blob);
        }

        // 5. 更新分支头指针
        branch.headCommitId = commit.objectId;
        branch.updatedAt = new Date();

        return commit;
    }

    /**
     * 创建分支
     */
    async createBranch(options: CreateBranchOptions): Promise<Branch> {
        const { repositoryId, branchName, baseCommitId, author } = options;
        
        const repository = this.repositories.get(repositoryId);
        if (!repository) {
            throw new Error(`Repository ${repositoryId} not found`);
        }

        // 检查分支是否已存在
        if (repository.branches.has(branchName)) {
            throw new Error(`Branch ${branchName} already exists`);
        }

        const branch: Branch = {
            branchId: this.generateId(),
            name: branchName,
            headCommitId: baseCommitId || '',
            baseCommitId: baseCommitId || '',
            createdAt: new Date(),
            updatedAt: new Date(),
            isActive: false,
            metadata: {
                author: author.name
            }
        };

        repository.branches.set(branchName, branch);
        return branch;
    }

    /**
     * 切换分支
     */
    async switchBranch(repositoryId: string, branchName: string): Promise<void> {
        const repository = this.repositories.get(repositoryId);
        if (!repository) {
            throw new Error(`Repository ${repositoryId} not found`);
        }

        const branch = repository.branches.get(branchName);
        if (!branch) {
            throw new Error(`Branch ${branchName} not found`);
        }

        // 设置所有分支为非活跃
        for (const [name, b] of repository.branches) {
            b.isActive = false;
        }

        // 激活目标分支
        branch.isActive = true;
        repository.currentBranch = branchName;
    }

    /**
     * 合并分支
     */
    async mergeBranch(options: MergeBranchOptions): Promise<MergeResult> {
        const { repositoryId, sourceBranch, targetBranch, author, message } = options;
        
        const repository = this.repositories.get(repositoryId);
        if (!repository) {
            throw new Error(`Repository ${repositoryId} not found`);
        }

        const source = repository.branches.get(sourceBranch);
        const target = repository.branches.get(targetBranch);
        
        if (!source || !target) {
            throw new Error('Source or target branch not found');
        }

        // 简单的快进合并（无冲突）
        const mergeCommit: Commit = {
            objectId: this.generateObjectId(),
            type: 'commit',
            content: {
                tree: target.headCommitId, // 使用目标分支的树
                parents: [target.headCommitId, source.headCommitId],
                author: {
                    ...author,
                    timestamp: new Date()
                },
                committer: {
                    ...author,
                    timestamp: new Date()
                },
                message: message || `Merge ${sourceBranch} into ${targetBranch}`,
                changes: {
                    added: [],
                    modified: [],
                    deleted: []
                }
            },
            size: 0
        };

        // 保存合并提交
        this.objects.set(mergeCommit.objectId, mergeCommit);
        
        // 更新目标分支
        target.headCommitId = mergeCommit.objectId;
        target.updatedAt = new Date();

        return {
            success: true,
            mergeCommitId: mergeCommit.objectId,
            message: `Successfully merged ${sourceBranch} into ${targetBranch}`
        };
    }

    /**
     * 获取提交历史
     */
    async getCommitHistory(options: GetCommitHistoryOptions): Promise<Commit[]> {
        const { repositoryId, branchName, limit = 10, offset = 0 } = options;
        
        const repository = this.repositories.get(repositoryId);
        if (!repository) {
            throw new Error(`Repository ${repositoryId} not found`);
        }

        const branch = repository.branches.get(branchName || repository.currentBranch);
        if (!branch) {
            return [];
        }

        // 简单实现：返回从当前HEAD开始的提交历史
        const commits: Commit[] = [];
        let currentCommitId = branch.headCommitId;
        let skipped = 0;
        
        while (currentCommitId && commits.length < limit) {
            const commit = this.objects.get(currentCommitId) as Commit;
            if (commit && commit.type === 'commit') {
                if (skipped >= offset) {
                    commits.push(commit);
                } else {
                    skipped++;
                }
                currentCommitId = commit.content.parents[0]; // 移动到第一个父提交
            } else {
                break;
            }
        }

        return commits;
    }

    /**
     * 比较两个提交
     */
    async compareCommits(repositoryId: string, commitId1: string, commitId2: string): Promise<CommitDiff> {
        const commit1 = this.objects.get(commitId1) as Commit;
        const commit2 = this.objects.get(commitId2) as Commit;
        
        if (!commit1 || !commit2) {
            throw new Error('One or both commits not found');
        }

        // 简单的差异比较
        const changes: DiffChange[] = [];
        let filesChanged = 0;
        let insertions = 0;
        let deletions = 0;

        // 比较树内容（简化实现）
        if (commit1.content.tree !== commit2.content.tree) {
            changes.push({
                path: 'tree',
                type: 'entity',
                changeType: 'modify',
                oldContent: commit1.content.tree,
                newContent: commit2.content.tree,
                diff: `Tree changed from ${commit1.content.tree} to ${commit2.content.tree}`
            });
            filesChanged++;
        }

        return {
            commit1,
            commit2,
            changes,
            summary: {
                filesChanged,
                insertions,
                deletions
            }
        };
    }

    /**
     * 回滚到指定提交
     */
    async resetToCommit(repositoryId: string, commitId: string, mode: 'soft' | 'mixed' | 'hard'): Promise<void> {
        const repository = this.repositories.get(repositoryId);
        if (!repository) {
            throw new Error(`Repository ${repositoryId} not found`);
        }

        const commit = this.objects.get(commitId) as Commit;
        if (!commit) {
            throw new Error(`Commit ${commitId} not found`);
        }

        const currentBranch = repository.branches.get(repository.currentBranch);
        if (!currentBranch) {
            throw new Error(`Current branch ${repository.currentBranch} not found`);
        }

        // 简单实现：更新分支头指针
        currentBranch.headCommitId = commitId;
        currentBranch.updatedAt = new Date();
    }

    /**
     * 获取所有分支
     */
    async getBranches(repositoryId: string): Promise<Branch[]> {
        const repository = this.repositories.get(repositoryId);
        if (!repository) {
            throw new Error(`Repository ${repositoryId} not found`);
        }

        return Array.from(repository.branches.values());
    }

    /**
     * 获取工作区状态
     */
    async getStatus(repositoryId: string): Promise<WorkingTreeStatus> {
        const repository = this.repositories.get(repositoryId);
        if (!repository) {
            throw new Error(`Repository ${repositoryId} not found`);
        }

        // 简单实现：返回空状态
        return {
            staged: [],
            unstaged: [],
            untracked: [],
            modified: [],
            deleted: []
        };
    }

    /**
     * 获取指定提交
     */
    async getCommit(repositoryId: string, commitId: string): Promise<Commit | null> {
        const commit = this.objects.get(commitId);
        return commit && commit.type === 'commit' ? commit as Commit : null;
    }

    /**
     * 获取指定分支
     */
    async getBranch(repositoryId: string, branchName: string): Promise<Branch | null> {
        const repository = this.repositories.get(repositoryId);
        if (!repository) {
            throw new Error(`Repository ${repositoryId} not found`);
        }

        const branch = repository.branches.get(branchName);
        if (!branch) {
            throw new Error(`Branch ${branchName} not found`);
        }

        return branch;
    }

    /**
     * 删除分支
     */
    async deleteBranch(repositoryId: string, branchName: string): Promise<boolean> {
        const repository = this.repositories.get(repositoryId);
        if (!repository) {
            throw new Error(`Repository ${repositoryId} not found`);
        }

        const deleted = repository.branches.delete(branchName);
        
        // 如果删除的是当前分支，切换到main
        if (deleted && repository.currentBranch === branchName) {
            repository.currentBranch = 'main';
        }

        return deleted;
    }

    /**
     * 获取树对象
     */
    async getTree(treeId: string): Promise<Tree | null> {
        const tree = this.objects.get(treeId);
        return tree && tree.type === 'tree' ? tree as Tree : null;
    }

    /**
     * 获取数据对象
     */
    async getBlob(blobId: string): Promise<Blob | null> {
        const blob = this.objects.get(blobId);
        return blob && blob.type === 'blob' ? blob as Blob : null;
    }

    // 私有辅助方法

    /**
     * 创建树对象
     */
    private async createTree(changes: ChangeSet): Promise<Tree> {
        const entries: TreeEntry[] = [];
        
        // 处理新增和修改的对象
        for (const change of [...changes.added, ...changes.modified]) {
            entries.push({
                mode: '100644', // 普通文件模式
                name: change.path,
                objectId: change.objectId,
                type: 'blob'
            });
        }
        
        const tree: Tree = {
            objectId: this.generateObjectId(),
            type: 'tree',
            content: { entries },
            size: JSON.stringify(entries).length
        };
        
        return tree;
    }

    /**
     * 获取blob内容
     */
    private async getBlobContent(change: Change): Promise<any> {
        // 这里应该从实际的存储中获取数据
        // 对于测试，我们需要返回实际的数据内容
        // 根据change.path和change.type返回相应的模拟数据
        if (change.type === 'entity') {
            return {
                id: change.objectId,
                nomanclature: [{
                    name: 'Test Entity',
                    acronym: 'TE',
                    language: 'en' as const
                }],
                abstract: {
                    description: 'Test description',
                    embedding: {
                        config: {
                            model: 'test',
                            dimensions: 128
                        },
                        vector: new Array(128).fill(0.1)
                    }
                }
            };
        }
        // 对于其他类型，返回路径作为默认内容
        return change.path;
    }

    /**
     * 生成对象ID
     */
    private generateObjectId(): string {
        // 使用时间戳和随机数生成ID
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    /**
     * 生成ID
     */
    private generateId(): string {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
}

// 仓库内部数据结构
interface Repository {
    repositoryId: string;
    branches: Map<string, Branch>;
    currentBranch: string;
    createdAt: Date;
}
