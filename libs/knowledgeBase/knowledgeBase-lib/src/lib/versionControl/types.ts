// Git对象基础接口
export interface GitObject {
    objectId: string;          // SHA-1哈希
    type: 'commit' | 'tree' | 'blob';
    content: any;
    size: number;
}

// 提交记录（类似Git commit）
export interface Commit extends GitObject {
    type: 'commit';
    content: {
        tree: string;          // 根树对象ID
        parents: string[];     // 父提交ID
        author: {
            name: string;
            email: string;
            timestamp: Date;
        };
        committer: {
            name: string;
            email: string;
            timestamp: Date;
        };
        message: string;
        changes: ChangeSet;
    };
}

// 树对象（类似Git tree）
export interface Tree extends GitObject {
    type: 'tree';
    content: {
        entries: TreeEntry[];
    };
}

export interface TreeEntry {
    mode: string;              // 文件模式
    name: string;              // 条目名称
    objectId: string;          // 指向的对象ID
    type: 'blob' | 'tree';
}

// 数据对象（类似Git blob）
export interface Blob extends GitObject {
    type: 'blob';
    content: any;             // 实际数据：EntityData | VertexData | PropertyData | EdgeData
    size: number;             // 内容大小
}

// 变更集
export interface ChangeSet {
    added: Change[];
    modified: Change[];
    deleted: Change[];
}

export interface Change {
    path: string;              // 数据路径，如 "entities/123"
    objectId: string;          // 对象ID
    type: 'entity' | 'vertex' | 'property' | 'edge';
    diff?: Diff;
}

// 分支管理系统
export interface Branch {
    branchId: string;
    name: string;
    headCommitId: string;
    baseCommitId: string;
    createdAt: Date;
    updatedAt: Date;
    isActive: boolean;
    metadata?: {
        description?: string;
        tags?: string[];
        author?: string;
    };
}

// 引用（类似Git ref）
export interface Reference {
    refId: string;
    name: string;              // 如 "refs/heads/main", "refs/tags/v1.0"
    objectId: string;          // 指向的提交ID
    type: 'branch' | 'tag' | 'stash';
    createdAt: Date;
}

// 合并结果
export interface MergeResult {
    success: boolean;
    mergeCommitId?: string;
    conflicts?: MergeConflict[];
    message: string;
}

export interface MergeConflict {
    path: string;
    type: 'entity' | 'vertex' | 'property' | 'edge';
    ourChange: Change;
    theirChange: Change;
    baseChange?: Change;
}

// 工作区状态
export interface WorkingTreeStatus {
    staged: Change[];
    unstaged: Change[];
    untracked: string[];
    modified: string[];
    deleted: string[];
}

// 差异对比
export interface Diff {
    old: any;
    new: any;
    changeType: 'add' | 'modify' | 'delete';
}

// 版本控制服务接口
export interface IGitVersionControl {
    /**
     * 初始化仓库
     */
    initRepository(repositoryId: string): Promise<void>;
    
    /**
     * 创建提交
     */
    createCommit(options: {
        repositoryId: string;
        branchName: string;
        message: string;
        author: { name: string; email: string };
        changes: ChangeSet;
        parentCommitIds?: string[];
    }): Promise<Commit>;
    
    /**
     * 创建分支
     */
    createBranch(options: {
        repositoryId: string;
        branchName: string;
        baseCommitId?: string;
        author: { name: string; email: string };
    }): Promise<Branch>;
    
    /**
     * 切换分支
     */
    switchBranch(repositoryId: string, branchName: string): Promise<void>;
    
    /**
     * 合并分支
     */
    mergeBranch(options: {
        repositoryId: string;
        sourceBranch: string;
        targetBranch: string;
        author: { name: string; email: string };
        message?: string;
    }): Promise<MergeResult>;
    
    /**
     * 获取提交历史
     */
    getCommitHistory(options: {
        repositoryId: string;
        branchName?: string;
        limit?: number;
        offset?: number;
        since?: Date;
        until?: Date;
    }): Promise<Commit[]>;
    
    /**
     * 比较两个提交
     */
    compareCommits(repositoryId: string, commitId1: string, commitId2: string): Promise<CommitDiff>;
    
    /**
     * 回滚到指定提交
     */
    resetToCommit(repositoryId: string, commitId: string, mode: 'soft' | 'mixed' | 'hard'): Promise<void>;
    
    /**
     * 获取所有分支
     */
    getBranches(repositoryId: string): Promise<Branch[]>;
    
    /**
     * 获取工作区状态
     */
    getStatus(repositoryId: string): Promise<WorkingTreeStatus>;
    
    /**
     * 获取指定提交
     */
    getCommit(repositoryId: string, commitId: string): Promise<Commit | null>;
    
    /**
     * 获取指定分支
     */
    getBranch(repositoryId: string, branchName: string): Promise<Branch | null>;
    
    /**
     * 删除分支
     */
    deleteBranch(repositoryId: string, branchName: string): Promise<boolean>;
    
    /**
     * 获取树对象
     */
    getTree(treeId: string): Promise<Tree | null>;
    
    /**
     * 获取数据对象
     */
    getBlob(blobId: string): Promise<Blob | null>;
}

// 提交差异
export interface CommitDiff {
    commit1: Commit;
    commit2: Commit;
    changes: DiffChange[];
    summary: {
        filesChanged: number;
        insertions: number;
        deletions: number;
    };
}

export interface DiffChange {
    path: string;
    type: 'entity' | 'vertex' | 'property' | 'edge';
    changeType: 'add' | 'modify' | 'delete';
    oldContent?: any;
    newContent?: any;
    diff?: string;
}

// 创建提交选项
export interface CreateCommitOptions {
    repositoryId: string;
    branchName: string;
    message: string;
    author: AuthorInfo;
    changes: ChangeSet;
    parentCommitIds?: string[];
}

export interface AuthorInfo {
    name: string;
    email: string;
}

// 创建分支选项
export interface CreateBranchOptions {
    repositoryId: string;
    branchName: string;
    baseCommitId?: string;
    author: AuthorInfo;
}

// 合并分支选项
export interface MergeBranchOptions {
    repositoryId: string;
    sourceBranch: string;
    targetBranch: string;
    author: AuthorInfo;
    message?: string;
}

// 获取提交历史选项
export interface GetCommitHistoryOptions {
    repositoryId: string;
    branchName?: string;
    limit?: number;
    offset?: number;
    since?: Date;
    until?: Date;
}
