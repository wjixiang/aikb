# Expert Hygen Template Migration Plan

## Overview

将 Expert 生成系统从**程序化生成**迁移到 **hygen 模板系统**。

## Current State

当前使用 [`src/expert/cli/create.ts`](../libs/agent-lib/src/expert/cli/create.ts) 中的程序化生成：

```typescript
function generateConfigJson(config: ExpertTemplateConfig): string { ... }
function generateSopYaml(config: ExpertTemplateConfig): string { ... }
function generateWorkspaceTs(config: ExpertTemplateConfig, isExternal: boolean): string { ... }
function generateIndexTs(config: ExpertTemplateConfig, isExternal: boolean): string { ... }
```

## Target State

使用 hygen 模板系统生成 Expert 文件。

## Architecture

### Template Structure

```
libs/agent-lib/_templates/
├── expert/
│   ├── new/
│   │   ├── config.json.ejs.t      # Config template
│   │   ├── sop.yaml.ejs.t         # SOP template
│   │   ├── index.ts.ejs.t         # Factory template
│   │   └── Workspace.ts.ejs.t     # Workspace template
│   └── prompt.ejs.t               # Interactive prompts
```

### Generated Expert Structure

```
experts/<name>/
├── config.json       # Expert configuration
├── sop.yaml          # Standard Operating Procedure
├── index.ts          # Factory function using createExpertConfig()
└── Workspace.ts      # Workspace class extending ExpertWorkspaceBase
```

## Implementation Steps

### Step 1: Add hygen Dependency

```bash
pnpm add -D hygen
```

### Step 2: Create Template Files

#### `_templates/expert/new/config.json.ejs.t`

```yaml
---
to: experts/<%= name %>/config.json
---
{
  "id": "<%= name %>",
  "displayName": "<%= displayName %>",
  "description": "<%= description %>",
  "version": "1.0.0",
  "category": "<%= category %>",
  "tags": <%- JSON.stringify(tags) %>,
  "triggers": <%- JSON.stringify(triggers) %>,
  "whenToUse": "<%= whenToUse %>",
  "components": [],
  "export": {
    "autoExport": false,
    "bucket": "agentfs",
    "defaultPath": "{expertId}/{timestamp}.json"
  }
}
```

#### `_templates/expert/new/sop.yaml.ejs.t`

```yaml
---
to: experts/<%= name %>/sop.yaml
---
# Expert Standard Operating Procedure (SOP)
# This file defines the Expert's behavior and prompts

overview: |-
  <%= description %>

responsibilities:
  - Process user input
  - Execute tasks
  - Generate output

constraints:
  - Always validate input before processing
  - Handle errors gracefully

parameters:
  - name: input
    type: string
    required: true
    description: The input to process

steps:
  - phase: THINKING
    description: Analyze the input and plan the execution
    details: |-
      1. Parse and validate the input
      2. Identify the required actions
      3. Plan the execution sequence

  - phase: ACTION
    description: Execute the planned actions
    details: |-
      1. Execute the planned actions
      2. Monitor progress
      3. Handle any errors

  - phase: OUTPUT
    description: Generate and format the output
    details: |-
      1. Collect results
      2. Format output
      3. Export if configured

examples:
  - input: |-
      {"query": "example query"}
    output: |-
      {"status": "success", "result": "processed"}
    description: Basic example showing input/output format
```

#### `_templates/expert/new/index.ts.ejs.t`

```yaml
---
to: experts/<%= name %>/index.ts
---
/**
 * <%= displayName %> - Factory Function
 * 
 * 使用ExpertFactory自动加载配置，无需样板代码
 */

import { createExpertConfig } from '<%= importPath %>';
import { <%= className %> } from './Workspace.js';

/**
 * 创建Expert配置
 * 
 * 工厂函数会自动：
 * 1. 加载config.json
 * 2. 加载sop.yaml
 * 3. 构建prompt（capability + direction）
 * 4. 从Workspace获取输入/输出处理器
 */
export default createExpertConfig(import.meta.url, <%= className %>);
```

#### `_templates/expert/new/Workspace.ts.ejs.t`

```yaml
---
to: experts/<%= name %>/Workspace.ts
---
/**
 * <%= displayName %> Workspace Module
 *
 * 职责：
 * 1. 导入和注册组件
 * 2. 输入验证和转换
 * 3. 输出格式化和导出
 */

import { ExpertWorkspaceBase } from '<%= importPath %>';
import type { ValidationResult } from '<%= importPath %>';

/**
 * <%= className %>
 * 
 * 继承ExpertWorkspaceBase获得通用功能
 * 重写需要自定义的方法
 */
export class <%= className %> extends ExpertWorkspaceBase {
  
  // ==================== 组件定义 ====================
  
  /**
   * 获取组件列表
   * 返回组件实例或DI Token
   */
  static override getComponents() {
    return [
      // 添加组件实例或DI Token
      // new MyComponent(),
      // TYPES.MyOtherComponent,
    ];
  }
  
  /**
   * 组件DI Token映射
   * 用于从config.json的diToken字符串解析为实际的Symbol
   */
  static override componentTokenMap: Record<string, symbol> = {
    // 'MyComponent': TYPES.MyComponent,
  };
  
  // ==================== 输入处理 ====================
  
  /**
   * 验证输入
   * 重写以实现自定义验证逻辑
   */
  static override validateInput(input: Record<string, any>): ValidationResult {
    const errors: string[] = [];
    
    // 示例验证：检查必需字段
    if (!input['query'] && !input['input']) {
      errors.push('Missing required field: query or input');
    }
    
    // 注意：使用 exactOptionalPropertyTypes 时，不要显式设置 undefined
    // 而是使用条件展开来省略空数组
    return {
      valid: errors.length === 0,
      ...(errors.length > 0 && { errors }),
    };
  }
  
  /**
   * 转换输入格式
   * 重写以实现输入转换（如添加默认值、格式转换等）
   */
  static override transformInput(input: Record<string, any>): Record<string, any> {
    return {
      ...input,
      timestamp: Date.now(),
    };
  }
  
  // ==================== 输出处理 ====================
  
  /**
   * 格式化输出
   * 重写以实现自定义输出格式
   */
  static override formatOutput(workspace: any): Record<string, any> {
    return super.formatOutput(workspace);
  }
}
```

#### `_templates/expert/prompt.ejs.t` (Interactive Prompts)

```yaml
---
to: _templates/expert/prompt.js
---
// see https://.hygen.io/configuration for prompt configuration
module.exports = {
  prompt: ({ inquirer }) => {
    const questions = [
      {
        type: 'input',
        name: 'name',
        message: 'Expert name (kebab-case, e.g., my-expert):',
        validate: (value) => {
          if (!value) return 'Name is required';
          if (!/^[a-z][a-z0-9-]*$/.test(value)) {
            return 'Name must start with lowercase letter and contain only lowercase letters, numbers, and hyphens';
          }
          return true;
        },
      },
      {
        type: 'input',
        name: 'displayName',
        message: 'Display name (e.g., My Expert):',
        default: ({ name }) => name
          .split('-')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' '),
      },
      {
        type: 'input',
        name: 'description',
        message: 'Description:',
        default: ({ displayName }) => `A new Expert for ${displayName.toLowerCase()}`,
      },
      {
        type: 'input',
        name: 'category',
        message: 'Category:',
        default: 'general',
      },
      {
        type: 'confirm',
        name: 'isExternal',
        message: 'Is this an external project (not agent-lib builtin)?',
        default: true,
      },
    ];
    return inquirer.prompt(questions).then(answers => {
      // Compute derived values
      const { name, displayName, isExternal } = answers;
      answers.className = name
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join('') + 'Workspace';
      answers.tags = name.split('-');
      answers.triggers = [name];
      answers.whenToUse = `Use this Expert when you need to ${answers.description.toLowerCase()}`;
      answers.importPath = isExternal ? 'agent-lib' : '../../index.js';
      answers.outputDir = isExternal ? 'experts' : 'src/expert/builtin';
      return answers;
    });
  },
};
```

### Step 3: Update package.json Scripts

```json
{
  "scripts": {
    "expert:new": "hygen expert new",
    "expert:new:quick": "hygen expert new --name"
  }
}
```

### Step 4: Update CLI (Optional)

Keep the existing CLI but delegate to hygen:

```typescript
// src/expert/cli/create.ts
import { execSync } from 'child_process';

export async function createExpert(expertName: string, outputDir?: string): Promise<void> {
  const cmd = outputDir 
    ? `npx hygen expert new --name ${expertName} --outputDir ${outputDir}`
    : `npx hygen expert new --name ${expertName}`;
  
  execSync(cmd, { stdio: 'inherit' });
}
```

## Usage

### Interactive Mode

```bash
pnpm expert:new
```

### Quick Mode (with name)

```bash
pnpm expert:new:quick my-expert
```

### With Options

```bash
npx hygen expert new --name my-expert --displayName "My Expert" --description "A custom expert"
```

## Benefits

1. **Template-based**: Easier to customize templates
2. **Interactive prompts**: Better developer experience
3. **Community standard**: hygen is widely used
4. **Extensible**: Easy to add new templates
5. **Less code**: Remove programmatic generation code

## Migration Checklist

- [ ] Add hygen dependency to package.json
- [ ] Create `_templates/expert/new/` directory
- [ ] Create template files (config.json.ejs.t, sop.yaml.ejs.t, index.ts.ejs.t, Workspace.ts.ejs.t)
- [ ] Create prompt.js for interactive mode
- [ ] Update package.json scripts
- [ ] Update or replace existing CLI
- [ ] Test the new template system
- [ ] Update documentation

## File Changes Summary

| Action | File |
|--------|------|
| Create | `_templates/expert/new/config.json.ejs.t` |
| Create | `_templates/expert/new/sop.yaml.ejs.t` |
| Create | `_templates/expert/new/index.ts.ejs.t` |
| Create | `_templates/expert/new/Workspace.ts.ejs.t` |
| Create | `_templates/expert/prompt.js` |
| Modify | `package.json` (add hygen dependency and scripts) |
| Modify/Remove | `src/expert/cli/create.ts` |
