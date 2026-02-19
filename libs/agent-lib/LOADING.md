# Skill 加载指南

## 概述

Skill 系统支持两种格式：
- **Markdown** (`.md`) - 遗留格式，仍然支持
- **TypeScript** (`.ts`) - 推荐格式，提供类型安全

## 加载方式

### 1. 自动加载（VirtualWorkspace）- 推荐

`VirtualWorkspace` 会在初始化时自动注册所有内置 skills：

```typescript
import { VirtualWorkspace } from './statefulContext/virtualWorkspace.js';

// 创建 workspace，自动注册内置 skills
const workspace = new VirtualWorkspace(config);
// ✅ 内置 skills 会自动注册（无需扫描文件系统）
```

**工作原理**:
- 直接导入 `repository/builtin/index.ts`
- 主动注册预定义的 skills
- 无需扫描文件系统，更快更可靠

### 2. 手动注册 - 直接导入（推荐）

#### 方式 A: 注册所有内置 Skills

```typescript
import { SkillRegistry, getBuiltinSkills } from './skills/index.js';

const registry = new SkillRegistry();

// 直接注册所有内置 skills
const builtinSkills = getBuiltinSkills();
registry.registerSkills(builtinSkills);

console.log(`Registered ${builtinSkills.length} skills`);
```

#### 方式 B: 注册单个 Skill

```typescript
import { SkillRegistry } from './skills/index.js';
import paperAnalysisSkill from './repository/builtin/paper-analysis.skill.js';

const registry = new SkillRegistry();

// 注册单个 skill
registry.registerSkill(paperAnalysisSkill);
```

#### 方式 C: 选择性注册

```typescript
import { SkillRegistry, getBuiltinSkill } from './skills/index.js';

const registry = new SkillRegistry();

// 只注册需要的 skills
const paperSkill = getBuiltinSkill('paper-analysis');
if (paperSkill) {
    registry.registerSkill(paperSkill);
}
```

### 3. 文件系统加载（自定义 Skills）

对于自定义 skills，仍然可以使用文件系统扫描：

```typescript
const registry = new SkillRegistry();

// 加载自定义 skills 目录
await registry.loadFromDirectory('./custom-skills');

// 加载单个文件
await registry.loadFromTypeScriptFile('./my-skill.skill.ts');
```

### 3. 注册到 Workspace

```typescript
import { VirtualWorkspace } from './statefulContext/virtualWorkspace.js';
import { SkillRegistry } from './skills/SkillRegistry.js';

const workspace = new VirtualWorkspace(config);

// 加载自定义 skills
const registry = new SkillRegistry('./custom-skills', true);
const skills = registry.getAll();

// 注册到 workspace
workspace.registerSkills(skills);

// 或注册单个 skill
workspace.registerSkill(mySkill);
```

### 4. 激活 Skill

```typescript
// 通过 SkillManager
const result = await workspace.activateSkill('skill-name');

// 或通过 get_skill 工具（LLM 调用）
const toolCall = {
    name: 'get_skill',
    arguments: JSON.stringify({ skill_name: 'paper-analysis' })
};
```

## 完整示例

### 示例 1: 使用默认自动注册（最简单）

```typescript
import { VirtualWorkspace } from './statefulContext/virtualWorkspace.js';
import { Agent } from './agent/agent.js';

// 1. 创建 workspace（自动注册内置 skills）
const workspace = new VirtualWorkspace({
    name: 'my-workspace',
    description: 'My workspace'
});

// 2. 创建 agent
const agent = new Agent(config, workspace, prompt, apiClient);

// 3. 激活 skill
await workspace.activateSkill('paper-analysis');

// 4. 使用 agent
await agent.start('Analyze this paper...');
```

### 示例 2: 手动注册内置 Skills

```typescript
import { VirtualWorkspace } from './statefulContext/virtualWorkspace.js';
import { getBuiltinSkills } from './skills/builtin/index.js';

// 1. 创建 workspace（不自动加载）
const workspace = new VirtualWorkspace(config);

// 2. 手动注册内置 skills
const builtinSkills = getBuiltinSkills();
workspace.registerSkills(builtinSkills);

// 3. 激活并使用
await workspace.activateSkill('paper-analysis');
```

### 示例 3: 混合使用内置和自定义 Skills

```typescript
import { VirtualWorkspace } from './statefulContext/virtualWorkspace.js';
import { SkillRegistry, getBuiltinSkills } from './skills/index.js';

// 1. 创建 workspace
const workspace = new VirtualWorkspace(config);

// 2. 注册内置 skills
const builtinSkills = getBuiltinSkills();
workspace.registerSkills(builtinSkills);

// 3. 加载自定义 skills
const customRegistry = new SkillRegistry();
await customRegistry.loadFromDirectory('./custom-skills');
const customSkills = customRegistry.getAll();

// 4. 注册自定义 skills
workspace.registerSkills(customSkills);

// 5. 使用
await workspace.activateSkill('my-custom-skill');
```

### 示例 4: 选择性注册 Skills

```typescript
import { VirtualWorkspace } from './statefulContext/virtualWorkspace.js';
import { getBuiltinSkill } from './skills/builtin/index.js';

const workspace = new VirtualWorkspace(config);

// 只注册需要的 skills
const paperSkill = getBuiltinSkill('paper-analysis');
const codeSkill = getBuiltinSkill('code-review');

if (paperSkill) workspace.registerSkill(paperSkill);
if (codeSkill) workspace.registerSkill(codeSkill);
```

## 添加新的内置 Skill

### 步骤 1: 创建 Skill 文件

在 `src/skills/builtin/` 目录下创建新的 skill 文件：

```typescript
// src/skills/builtin/my-new-skill.skill.ts
import { defineSkill, createTool } from '../SkillDefinition.js';
import { z } from 'zod';

export default defineSkill({
    name: 'my-new-skill',
    displayName: 'My New Skill',
    description: 'Description of my new skill',
    version: '1.0.0',
    capabilities: ['Capability 1', 'Capability 2'],
    workDirection: 'Instructions...',
    tools: [
        createTool('tool_name', 'Tool description', z.object({
            param: z.string()
        }))
    ]
});
```

### 步骤 2: 注册到 builtin/index.ts

```typescript
// src/skills/builtin/index.ts
import paperAnalysisSkill from './paper-analysis.skill.js';
import codeReviewSkill from './code-review.skill.js';
import myNewSkill from './my-new-skill.skill.js';  // 添加导入

export const builtinSkills: Skill[] = [
    paperAnalysisSkill,
    codeReviewSkill,
    myNewSkill,  // 添加到数组
];
```

### 步骤 3: 使用新 Skill

```typescript
// 自动可用（通过 VirtualWorkspace）
const workspace = new VirtualWorkspace(config);
await workspace.activateSkill('my-new-skill');

// 或手动获取
import { getBuiltinSkill } from './skills/builtin/index.js';
const skill = getBuiltinSkill('my-new-skill');
```

完成！新 skill 会自动在所有使用 VirtualWorkspace 的地方可用。

## API 参考

### SkillRegistry

```typescript
class SkillRegistry {
    constructor(repositoryPath?: string, autoLoad?: boolean)

    // 加载方法
    loadFromDirectory(path: string): Promise<Skill[]>
    loadFromTypeScriptFile(path: string): Promise<Skill>
    loadFromContent(content: string): Skill
    loadFromDefinition(definition: SkillDefinition): Skill

    // 查询方法
    get(name: string): Skill | undefined
    getAll(): Skill[]
    getByCategory(category: string): Skill[]
    getByTag(tag: string): Skill[]
    search(query: string): Skill[]

    // 管理方法
    has(name: string): boolean
    unload(name: string): boolean
    clear(): void

    // 统计
    getStats(): { totalSkills, byType, categories, tags }
}
```

### VirtualWorkspace

```typescript
class VirtualWorkspace {
    // Skill 注册
    registerSkill(skill: Skill): void
    registerSkills(skills: Skill[]): void

    // Skill 激活
    activateSkill(skillName: string): Promise<SkillActivationResult>
    deactivateSkill(): Promise<{ success: boolean; message: string }>

    // Skill 查询
    getActiveSkill(): Skill | null
    getAvailableSkills(): SkillSummary[]
}
```

## 配置选项

### SkillRegistry 构造函数

```typescript
new SkillRegistry(
    repositoryPath?: string,  // 默认: __dirname/../../repository
    autoLoad?: boolean        // 默认: false
)
```

**参数说明**:
- `repositoryPath`: Skill 仓库路径，可选
- `autoLoad`: 是否自动加载，默认 `false`

**示例**:
```typescript
// 使用默认路径，不自动加载
const registry = new SkillRegistry();

// 使用默认路径，自动加载
const registry = new SkillRegistry(undefined, true);

// 使用自定义路径，自动加载
const registry = new SkillRegistry('./my-skills', true);

// 使用自定义路径，不自动加载
const registry = new SkillRegistry('./my-skills', false);
```

## 最佳实践

1. **使用 VirtualWorkspace 的自动加载**
   - 最简单的方式
   - 适合大多数场景

2. **自定义 Skills 使用独立 Registry**
   - 保持内置和自定义 skills 分离
   - 便于管理和更新

3. **TypeScript Skills 优先**
   - 类型安全
   - 更好的 IDE 支持
   - 易于测试

4. **按需激活 Skills**
   - 不要一次激活所有 skills
   - 根据任务激活相应的 skill
   - 完成后停用以释放资源

## 故障排查

### Skills 没有加载

**问题**: `registry.getAll()` 返回空数组

**解决**:
```typescript
// 确保使用 autoLoad 或手动调用 loadFromDirectory
const registry = new SkillRegistry(undefined, true);
// 或
const registry = new SkillRegistry();
await registry.loadFromDirectory('./repository');
```

### TypeScript Skill 加载失败

**问题**: `loadFromTypeScriptFile()` 报错

**检查**:
1. 文件是否以 `.skill.ts` 结尾
2. 是否有 default export 或 named `skill` export
3. 是否有语法错误
4. 导入路径是否正确

### Skill 激活失败

**问题**: `activateSkill()` 返回失败

**检查**:
1. Skill 是否已注册: `workspace.getAvailableSkills()`
2. Skill 名称是否正确
3. 是否有其他 skill 已激活（一次只能激活一个）

## 相关文档

- [Skill 创建指南](./README.md)
- [TypeScript Skill 快速参考](./QUICKREF.md)
- [迁移指南](./MIGRATION.md)
