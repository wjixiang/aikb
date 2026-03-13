# Expert简化架构指南

## 概述

本文档介绍简化的Expert开发架构，将文件结构从5+个文件简化为4个核心文件。

## 文件结构

```
libs/agent-lib/src/expert/builtin/my-expert/
├── config.json      # 配置文件（元数据 + 组件定义）
├── sop.yaml         # 标准操作流程（Prompt生成）
├── Workspace.ts     # 工作空间（组件 + 输入/输出处理）
└── index.ts         # 工厂函数（导出ExpertConfig）
```

## 文件职责

### 1. config.json - 配置文件

合并原有的`config.json`和组件配置：

```json
{
  "id": "my-expert",
  "displayName": "My Expert",
  "description": "Expert描述",
  "version": "1.0.0",
  "category": "category-name",
  "tags": ["tag1", "tag2"],
  "triggers": ["trigger1", "trigger2"],
  "whenToUse": "何时使用此Expert",
  
  "components": [
    {
      "id": "component-1",
      "displayName": "Component 1",
      "description": "组件描述",
      "diToken": "MyComponent",
      "shared": false
    }
  ],
  
  "export": {
    "autoExport": true,
    "bucket": "agentfs",
    "defaultPath": "{expertId}/{timestamp}.json"
  }
}
```

### 2. sop.yaml - 标准操作流程

定义Expert的Prompt和行为指导：

```yaml
overview: |-
  Expert概述和能力描述

responsibilities:
  - 职责1
  - 职责2

constraints:
  - 约束条件1

parameters:
  - name: inputParam
    type: string
    required: true
    description: 参数描述

steps:
  - phase: THINKING
    description: 思考阶段
    details: |-
      详细说明...

  - phase: ACTION
    description: 执行阶段
    details: |-
      详细说明...

examples:
  - input: |-
      {"query": "example query"}
    output: |-
      {"results": [...]}
    description: 示例描述
```

### 3. Workspace.ts - 工作空间模块

统一管理组件、输入处理和输出处理：

```typescript
// Workspace.ts
import { ToolComponent } from '../../statefulContext/toolComponent.js';
import { BibliographySearchComponent } from '../../components/bibliographySearch/index.js';
import type { ExportResult, ExportConfig } from '../types.js';
import type { IVirtualWorkspace } from '../../statefulContext/types.js';

/**
 * Expert Workspace Module
 * 
 * 职责：
 * 1. 导入和注册组件
 * 2. 输入验证和转换
 * 3. 输出格式化和导出
 */
export class MyExpertWorkspace {
  
  // ==================== 组件定义 ====================
  
  /**
   * 获取组件列表
   * 返回组件实例或DI Token
   */
  static getComponents(): (ToolComponent | symbol)[] {
    return [
      // 方式1：直接返回组件实例
      new BibliographySearchComponent(),
      
      // 方式2：返回DI Token（推荐，支持依赖注入）
      // Symbol.for('MyComponent'),
    ];
  }
  
  /**
   * 组件DI Token映射
   * 用于从容器中解析组件
   */
  static componentTokenMap: Record<string, symbol> = {
    'MyComponent': Symbol.for('MyComponent'),
  };
  
  // ==================== 输入处理 ====================
  
  /**
   * 验证输入
   */
  static validateInput(input: Record<string, any>): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];
    
    if (!input.query) {
      errors.push('Missing required field: query');
    }
    
    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }
  
  /**
   * 转换输入格式
   */
  static transformInput(input: Record<string, any>): Record<string, any> {
    return {
      ...input,
      // 添加默认值或转换格式
      timestamp: Date.now(),
    };
  }
  
  /**
   * 加载外部数据
   * 用于从S3等外部存储加载数据
   */
  static async loadExternalData(input: Record<string, any>): Promise<Record<string, any>> {
    // 如果有S3 key，加载数据
    if (input.s3Key) {
      // const data = await loadFromS3(input.s3Key);
      // return { ...input, loadedData: data };
    }
    
    return input;
  }
  
  // ==================== 输出处理 ====================
  
  /**
   * 格式化输出
   */
  static formatOutput(workspace: IVirtualWorkspace): any {
    const componentKeys = workspace.getComponentKeys();
    const outputs: Record<string, any> = {};
    
    for (const key of componentKeys) {
      const component = workspace.getComponent(key);
      if (component) {
        outputs[key] = component.getState();
      }
    }
    
    return outputs;
  }
  
  /**
   * 导出处理
   */
  static async exportHandler(
    workspace: IVirtualWorkspace,
    config: ExportConfig
  ): Promise<ExportResult> {
    const output = this.formatOutput(workspace);
    
    // 格式化为目标格式（JSON/CSV/etc）
    const content = JSON.stringify(output, null, 2);
    
    // 使用VirtualFileSystemComponent导出
    const vfsComponent = this.getVFSComponent(workspace);
    if (!vfsComponent) {
      return { success: false, error: 'VirtualFileSystemComponent not found' };
    }
    
    return vfsComponent.exportContent(config.bucket, config.path, content, 'application/json');
  }
  
  private static getVFSComponent(workspace: IVirtualWorkspace): any {
    const componentKeys = workspace.getComponentKeys();
    for (const key of componentKeys) {
      const component = workspace.getComponent(key);
      if (component?.constructor?.name === 'VirtualFileSystemComponent') {
        return component;
      }
    }
    return null;
  }
}
```

### 4. index.ts - 工厂函数

简化的工厂函数，自动加载配置和SOP：

```typescript
// index.ts
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import YAML from 'yaml';
import type { ExpertConfig, ExpertComponentDefinition } from '../../types.js';
import { MyExpertWorkspace } from './Workspace.js';

// 自动获取当前目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * 加载JSON配置
 */
function loadConfig() {
  const configPath = join(__dirname, 'config.json');
  return JSON.parse(readFileSync(configPath, 'utf-8'));
}

/**
 * 加载SOP YAML
 */
function loadSOP() {
  const sopPath = join(__dirname, 'sop.yaml');
  return YAML.parse(readFileSync(sopPath, 'utf-8'));
}

/**
 * 构建组件定义
 */
function buildComponents(config: any): ExpertComponentDefinition[] {
  return (config.components || []).map((comp: any) => ({
    componentId: comp.id,
    displayName: comp.displayName,
    description: comp.description,
    instance: MyExpertWorkspace.componentTokenMap[comp.diToken] || comp.diToken,
    shared: comp.shared,
  }));
}

/**
 * 构建Capability Prompt
 */
function buildCapability(sop: any): string {
  const parts: string[] = [];
  
  parts.push('## Overview\n' + sop.overview);
  
  if (sop.constraints?.length) {
    parts.push('## Constraints\n' + sop.constraints.map((c: string) => `- ${c}`).join('\n'));
  }
  
  return parts.join('\n\n');
}

/**
 * 构建Direction Prompt
 */
function buildDirection(sop: any): string {
  const parts: string[] = [];
  
  // Steps
  if (sop.steps?.length) {
    parts.push('## Steps\n');
    for (const step of sop.steps) {
      parts.push(`### ${step.phase}\n${step.description}`);
      if (step.details) {
        parts.push(`\n${step.details}`);
      }
    }
  }
  
  // Examples
  if (sop.examples?.length) {
    parts.push('\n## Examples\n');
    for (const example of sop.examples) {
      parts.push(`**Input:**\n\`\`\`\n${example.input}\n\`\`\``);
      parts.push(`**Output:**\n\`\`\`\n${example.output}\n\`\`\``);
      if (example.description) {
        parts.push(example.description);
      }
    }
  }
  
  return parts.join('\n');
}

/**
 * 创建Expert配置
 * 
 * 这是唯一的导出函数，框架通过调用它获取ExpertConfig
 */
export default function createExpert(): ExpertConfig {
  const config = loadConfig();
  const sop = loadSOP();
  
  return {
    // 基本信息
    expertId: config.id,
    displayName: config.displayName,
    description: config.description || '',
    whenToUse: config.whenToUse,
    triggers: config.triggers,
    
    // Prompt（从SOP自动构建）
    prompt: {
      capability: buildCapability(sop),
      direction: buildDirection(sop),
    },
    
    // 职责和能力
    responsibilities: sop.responsibilities?.join('; ') || '',
    capabilities: config.tags || [],
    
    // 组件
    components: buildComponents(config),
    
    // 输入处理（从Workspace获取）
    input: {
      validate: MyExpertWorkspace.validateInput,
      transform: MyExpertWorkspace.transformInput,
      loadExternalData: MyExpertWorkspace.loadExternalData,
    },
    
    // 导出配置（从Workspace获取）
    exportConfig: config.export ? {
      autoExport: config.export.autoExport,
      bucket: config.export.bucket,
      defaultPath: config.export.defaultPath,
      exportHandler: MyExpertWorkspace.exportHandler,
    } : undefined,
  };
}
```

## 架构对比

### 简化前（5+文件）

```
my-expert/
├── config.json        # 元数据
├── sop.yaml           # SOP
├── expert.ts          # 工厂函数（大量样板代码）
├── input.ts           # 输入处理器
└── exportHandler.ts   # 导出处理器
```

### 简化后（4文件）

```
my-expert/
├── config.json        # 元数据 + 组件配置 + 导出配置
├── sop.yaml           # SOP（不变）
├── Workspace.ts       # 组件 + 输入/输出处理（合并）
└── index.ts           # 工厂函数（简化，自动加载）
```

## 优势

1. **减少样板代码**：工厂函数自动加载配置和SOP
2. **职责清晰**：Workspace统一管理所有运行时逻辑
3. **易于维护**：相关功能集中在一个文件
4. **类型安全**：Workspace类提供完整的类型检查

## 实现计划

1. 创建基类 `ExpertWorkspaceBase` 提供通用功能
2. 修改 `ExpertInstance` 支持新的加载模式
3. 更新CLI工具支持新的文件结构
4. 迁移现有Expert到新架构

## 基类设计

```typescript
// ExpertWorkspaceBase.ts
import type { IVirtualWorkspace, ExportResult, ExportConfig } from '../types.js';

/**
 * Expert Workspace 基类
 * 提供通用的输入/输出处理功能
 */
export abstract class ExpertWorkspaceBase {
  
  // 子类必须实现
  abstract getComponents(): (ToolComponent | symbol)[];
  abstract componentTokenMap: Record<string, symbol>;
  
  // 可选重写
  validateInput(input: Record<string, any>): { valid: boolean; errors?: string[] } {
    return { valid: true };
  }
  
  transformInput(input: Record<string, any>): Record<string, any> {
    return input;
  }
  
  async loadExternalData(input: Record<string, any>): Promise<Record<string, any>> {
    return input;
  }
  
  formatOutput(workspace: IVirtualWorkspace): any {
    const outputs: Record<string, any> = {};
    for (const key of workspace.getComponentKeys()) {
      const component = workspace.getComponent(key);
      if (component) {
        outputs[key] = component.getState();
      }
    }
    return outputs;
  }
  
  async exportHandler(workspace: IVirtualWorkspace, config: ExportConfig): Promise<ExportResult> {
    const content = JSON.stringify(this.formatOutput(workspace), null, 2);
    // ... 导出逻辑
  }
}
```
