# Expert 开发指南

## 概述

Expert 是一个独立的、专业的 Agent，具有自己的上下文、组件和任务处理能力。本文档介绍如何使用简化的4文件架构创建新的 Expert。

## 快速开始

### 创建新Expert

使用 CLI 工具快速创建新的 Expert 模板：

```bash
# 在 libs/agent-lib 目录下执行
npx tsx src/expert/cli/index.ts new my-expert

# 或者使用简写
npx tsx src/expert/cli/index.ts new my-expert
```

这将创建以下文件结构：

```
libs/agent-lib/src/expert/builtin/my-expert/
├── config.json    # Expert 元数据配置
├── sop.yaml       # 标准操作流程定义
├── Workspace.ts   # 工作空间（组件 + 输入/输出处理）
└── index.ts       # 工厂函数（自动生成）
```

### 测试Expert

```bash
# 运行 Expert demo
npx tsx src/expert/cli/index.ts demo my-expert '{"query": "test query"}'
```

## 文件详解

### 1. config.json - 元数据配置

定义 Expert 的基本信息、组件和导出配置：

```json
{
  "id": "my-expert",
  "displayName": "My Expert",
  "description": "Expert 描述",
  "version": "1.0.0",
  "category": "category-name",
  "tags": ["tag1", "tag2"],
  "triggers": ["trigger1", "trigger2"],
  "whenToUse": "何时使用此 Expert",
  "components": [
    {
      "id": "component-id",
      "displayName": "Component Name",
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

**字段说明：**

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| id | string | ✓ | Expert 唯一标识（kebab-case） |
| displayName | string | ✓ | 显示名称 |
| description | string | | 详细描述 |
| version | string | | 版本号 |
| category | string | | 分类 |
| tags | string[] | | 标签列表 |
| triggers | string[] | | 触发关键词 |
| whenToUse | string | | 使用场景说明 |
| components | array | | 组件定义列表 |
| export | object | | 导出配置 |

### 2. sop.yaml - 标准操作流程

定义 Expert 的行为和 Prompt 生成规则：

```yaml
overview: |-
  Expert 概述和能力描述

responsibilities:
  - 职责1
  - 职责2

constraints:
  - 约束条件1
  - 约束条件2

parameters:
  - name: inputParam
    type: string
    required: true
    description: 参数描述

steps:
  - phase: THINKING
    description: 思考阶段
    details: |-
      1. 分析输入
      2. 规划执行

  - phase: ACTION
    description: 执行阶段
    details: |-
      1. 执行操作
      2. 处理结果

  - phase: OUTPUT
    description: 输出阶段
    details: |-
      1. 格式化输出
      2. 导出结果

examples:
  - input: |-
      {"query": "example"}
    output: |-
      {"result": "processed"}
    description: 示例说明
```

**Prompt 生成规则：**

- `capability` = Overview + Constraints
- `direction` = Steps + Examples

### 3. Workspace.ts - 工作空间模块

统一管理组件、输入处理和输出处理：

```typescript
import { ExpertWorkspaceBase } from '../../ExpertWorkspaceBase.js';
import type { ValidationResult } from '../../types.js';
import { TYPES } from '../../../di/types.js';

export class MyExpertWorkspace extends ExpertWorkspaceBase {
  
  // ==================== 组件定义 ====================
  
  /**
   * 获取组件列表
   */
  static override getComponents() {
    return [
      // 方式1：直接返回组件实例
      // new MyComponent(),
      
      // 方式2：返回 DI Token（推荐）
      // TYPES.MyComponent,
    ];
  }
  
  /**
   * 组件 DI Token 映射
   */
  static override componentTokenMap: Record<string, symbol> = {
    // 'MyComponent': TYPES.MyComponent,
  };
  
  // ==================== 输入处理 ====================
  
  /**
   * 验证输入
   */
  static override validateInput(input: Record<string, any>): ValidationResult {
    const errors: string[] = [];
    
    if (!input['query']) {
      errors.push('Missing required field: query');
    }
    
    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }
  
  /**
   * 转换输入格式
   */
  static override transformInput(input: Record<string, any>): Record<string, any> {
    return {
      ...input,
      timestamp: Date.now(),
    };
  }
  
  /**
   * 加载外部数据（如从 S3）
   */
  static override async loadExternalData(input: Record<string, any>): Promise<Record<string, any>> {
    // if (input.s3Key) {
    //   const vfs = ...;
    //   const data = await vfs.readFile(input.s3Key);
    //   return { ...input, loadedData: data };
    // }
    return input;
  }
  
  // ==================== 输出处理 ====================
  
  /**
   * 格式化输出
   */
  static override formatOutput(workspace: any): Record<string, any> {
    return super.formatOutput(workspace);
  }
  
  /**
   * 导出处理
   */
  static override async exportHandler(workspace: any, config: any): Promise<any> {
    return super.exportHandler(workspace, config);
  }
}
```

### 4. index.ts - 工厂函数

自动加载配置文件，无需手动编写：

```typescript
import { createExpertConfig } from '../../ExpertFactory.js';
import { MyExpertWorkspace } from './Workspace.js';

export default createExpertConfig(import.meta.url, MyExpertWorkspace);
```

## ExpertWorkspaceBase API

### 静态方法

| 方法 | 说明 | 默认行为 |
|------|------|----------|
| `getComponents()` | 获取组件列表 | 返回空数组 |
| `validateInput(input)` | 验证输入 | 返回 `{ valid: true }` |
| `transformInput(input)` | 转换输入 | 返回原输入 |
| `loadExternalData(input)` | 加载外部数据 | 返回原输入 |
| `formatOutput(workspace)` | 格式化输出 | 提取所有组件状态 |
| `exportHandler(workspace, config)` | 导出处理 | JSON 格式导出 |
| `getInputHandler()` | 获取输入处理器 | 组合上述方法 |

### 使用 DI Token

推荐使用 DI Token 注册组件，以支持依赖注入：

```typescript
import { TYPES } from '../../../di/types.js';

export class MyExpertWorkspace extends ExpertWorkspaceBase {
  static override getComponents() {
    return [
      TYPES.BibliographySearchComponent,
      TYPES.VirtualFileSystemComponent,
    ];
  }
  
  static override componentTokenMap = {
    'BibliographySearchComponent': TYPES.BibliographySearchComponent,
    'VirtualFileSystemComponent': TYPES.VirtualFileSystemComponent,
  };
}
```

## CLI 命令

### 创建 Expert

```bash
npx tsx src/expert/cli/index.ts new <expert-name>
```

### 列出所有 Expert

```bash
npx tsx src/expert/cli/index.ts list
```

### 验证 Expert 配置

```bash
# 验证所有 Expert
npx tsx src/expert/cli/index.ts validate

# 验证指定 Expert
npx tsx src/expert/cli/index.ts validate my-expert
```

### 显示 Expert 详情

```bash
npx tsx src/expert/cli/index.ts show my-expert
```

### 运行 Expert Demo

```bash
# JSON 输入
npx tsx src/expert/cli/index.ts demo my-expert '{"query": "test"}'

# 键值对输入
npx tsx src/expert/cli/index.ts demo my-expert "query=test,limit=10"
```

## 最佳实践

### 1. 命名规范

- Expert ID: kebab-case（如 `meta-analysis-article-retrieval`）
- Workspace 类: PascalCase + Workspace（如 `MetaAnalysisArticleRetrievalWorkspace`）
- 组件 ID: kebab-case（如 `bibliography-search`）

### 2. SOP 编写

- Overview 简洁明了，描述 Expert 的核心能力
- Constraints 列出所有限制条件
- Steps 按 THINKING → ACTION → OUTPUT 顺序组织
- Examples 提供典型的输入/输出示例

### 3. 输入验证

始终验证必需字段：

```typescript
static override validateInput(input: Record<string, any>): ValidationResult {
  const errors: string[] = [];
  
  // 验证必需字段
  if (!input['query']) {
    errors.push('Missing required field: query');
  }
  
  // 验证字段类型
  if (input['limit'] && typeof input['limit'] !== 'number') {
    errors.push('Field "limit" must be a number');
  }
  
  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  };
}
```

### 4. 错误处理

在导出处理中捕获异常：

```typescript
static override async exportHandler(workspace: any, config: any): Promise<any> {
  try {
    const output = this.formatOutput(workspace);
    // 导出逻辑...
    return { success: true, filePath: config.path };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    };
  }
}
```

## 示例：完整的 Expert

查看 [`libs/agent-lib/src/expert/templates/my-expert/`](libs/agent-lib/src/expert/templates/my-expert/) 获取完整的模板示例。

## 相关文档

- [[expert-simplified-architecture|Expert 简化架构设计]]
- [[expert-architecture-analysis|Expert 架构分析]]
