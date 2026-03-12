/**
 * Expert Types - Multi-Agent Architecture
 *
 * Expert: 独立的专业Agent，拥有自己的上下文、组件和任务处理能力
 * 整合了原 Skill 的功能：prompt、components、lifecycle hooks
 */

import type { ToolComponent } from '../statefulContext/toolComponent.js';

/**
 * Component definition - 从原 Skill 迁移
 * 支持三种模式：
 * 1. 直接实例: ToolComponent
 * 2. 工厂函数: () => ToolComponent | Promise<ToolComponent>
 * 3. DI Token: Symbol (推荐)
 */
export interface ExpertComponentDefinition {
    /** 唯一标识 */
    componentId: string;
    /** 显示名称 */
    displayName: string;
    /** 描述 */
    description: string;
    /** 实例、工厂函数或 DI Token */
    instance: ToolComponent | (() => ToolComponent) | (() => Promise<ToolComponent>) | symbol;
    /** 是否为共享组件（跨 Expert 保留状态） */
    shared?: boolean;
}

/**
 * Expert 配置 - 整合了原 Skill 的所有功能
 */
export interface ExpertConfig {
    /** Expert 唯一标识 (原 Skill name) */
    expertId: string;
    /** Expert 显示名称 (原 Skill displayName) */
    displayName: string;
    /** Expert 描述 (原 Skill description) */
    description: string;
    /** 何时使用此 Expert (原 Skill whenToUse) */
    whenToUse?: string;
    /** 触发关键词 (原 Skill triggers) */
    triggers?: string[];

    /** 职责说明 - Controller 何时应该委托此 Expert */
    responsibilities: string;

    /** 能力说明 */
    capabilities: string[];

    /** 组件定义 (原 Skill components) */
    components: ExpertComponentDefinition[];

    /** Prompt 增强 (原 Skill prompt) */
    prompt: {
        /** 能力描述 */
        capability: string;
        /** 方向指引 */
        direction: string;
    };

    /** 额外的系统提示 */
    systemPrompt?: string;

    /** 是否自动激活 */
    autoActivate?: boolean;

    /** 生命周期钩子 (原 Skill onActivate/onDeactivate) */
    onActivate?: () => Promise<void>;
    onDeactivate?: () => Promise<void>;
    onComponentActivate?: (component: ToolComponent) => Promise<void>;
    onComponentDeactivate?: (component: ToolComponent) => Promise<void>;
}

/**
 * Expert Summary - 用于展示和选择
 */
export interface ExpertSummary {
    expertId: string;
    displayName: string;
    description: string;
    whenToUse?: string;
    triggers?: string[];
    capabilities: string[];
}

/**
 * Expert 状态
 */
export type ExpertStatus = 'idle' | 'ready' | 'running' | 'completed' | 'failed' | 'suspended';

/**
 * Expert 执行结果
 */
export interface ExpertResult {
    expertId: string;
    success: boolean;
    output: any;
    summary: string;
    artifacts?: ExpertArtifact[];
    errors?: string[];
    duration: number;
}

/**
 * Expert 产物（可传递给其他 Expert）
 */
export interface ExpertArtifact {
    /** 产物类型 */
    type: 'data' | 'document' | 'model-output' | 'state';
    /** 产物名称 */
    name: string;
    /** 产物内容 */
    content: any;
    /** 元数据 */
    metadata?: Record<string, any>;
    /** 是否可共享给其他 Expert */
    shareable: boolean;
}

/**
 * Expert 任务
 */
export interface ExpertTask {
    /** 任务 ID */
    taskId: string;
    /** 任务描述 */
    description: string;
    /** 任务输入 */
    input?: any;
    /** 依赖的其他 Expert 任务 */
    dependencies?: string[];
    /** 期望的产物类型 */
    expectedOutputs?: string[];
}

/**
 * Expert 执行请求
 */
export interface ExpertExecuteRequest {
    /** Expert ID 或名称 */
    expertId: string;
    /** 执行的任务 */
    task: ExpertTask;
    /** 上下文（来自 Controller 或其他 Expert） */
    context?: Record<string, any>;
    /** 超时时间（毫秒） */
    timeout?: number;
}

/**
 * Expert 生命周期事件
 */
export interface ExpertLifecycleEvent {
    type: 'created' | 'activated' | 'suspended' | 'resumed' | 'completed' | 'failed' | 'error';
    expertId: string;
    timestamp: number;
    data?: any;
}

/**
 * Expert 注册表 - 用于管理所有 Expert
 */
export interface IExpertRegistry {
    /** 注册 Expert */
    register(expert: ExpertConfig): void;
    /** 获取 Expert */
    get(expertId: string): ExpertConfig | undefined;
    /** 获取所有 Expert */
    getAll(): ExpertConfig[];
    /** 根据能力查找 Expert */
    findByCapability(capability: string): ExpertConfig[];
    /** 根据触发词查找 Expert */
    findByTrigger(trigger: string): ExpertConfig[];
    /** 列出所有可用的 Expert */
    listExperts(): ExpertSummary[];
}

/**
 * Expert 执行器 - 负责创建和管理 Expert 实例
 */
export interface IExpertExecutor {
    /** 注册 Expert */
    registerExpert(config: ExpertConfig): void;
    /** 创建 Expert 实例 */
    createExpert(expertId: string): Promise<IExpertInstance>;
    /** 获取 Expert 实例 */
    getExpert(expertId: string): IExpertInstance | undefined;
    /** 释放 Expert 实例 */
    releaseExpert(expertId: string): void;
    /** 执行 Expert 任务 */
    execute(request: ExpertExecuteRequest): Promise<ExpertResult>;
}

/**
 * Expert 实例 - 运行中的 Expert
 */
export interface IExpertInstance {
    /** Expert ID */
    expertId: string;
    /** 状态 */
    status: ExpertStatus;
    /** 激活 Expert */
    activate(): Promise<void>;
    /** 暂停 Expert */
    suspend(): Promise<void>;
    /** 恢复 Expert */
    resume(): Promise<void>;
    /** 执行任务 */
    execute(task: ExpertTask, context?: Record<string, any>): Promise<ExpertResult>;
    /** 获取当前状态摘要 */
    getStateSummary(): Promise<string>;
    /** 获取产物 */
    getArtifacts(): ExpertArtifact[];
    /** 清理资源 */
    dispose(): Promise<void>;
}

/**
 * Expert 调度策略
 */
export type ExpertSchedulingStrategy = 'sequential' | 'parallel' | 'dependency-ordered' | 'conditional';

/**
 * Expert 编排请求
 */
export interface ExpertOrchestrationRequest {
    /** 主任务描述 */
    task: string;
    /** 任务分解策略 */
    strategy: ExpertSchedulingStrategy;
    /** Expert 任务列表 */
    expertTasks: {
        expertId: string;
        task: ExpertTask;
        conditional?: boolean;
    }[];
    /** 全局上下文 */
    globalContext?: Record<string, any>;
    /** 超时时间 */
    timeout?: number;
}

/**
 * Expert 编排结果
 */
export interface ExpertOrchestrationResult {
    success: boolean;
    overallSummary: string;
    expertResults: Map<string, ExpertResult>;
    finalOutput: any;
    artifacts: ExpertArtifact[];
    totalDuration: number;
    errors?: string[];
}
