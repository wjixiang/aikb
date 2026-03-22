# medDatabasePortal 依赖移除计划

## 问题分析

### 当前依赖关系
```
medDatabasePortal (CJS + @nestjs/common)
    ↓
agent-lib (ESM)
    ↓
agent-lib-test (ESM)
```

### 问题根源
1. `medDatabasePortal` 依赖 `@nestjs/common`（CJS 模块）
2. `PubmedService` 使用 `@Injectable()` 装饰器
3. ESM/CJS 互操作问题导致运行时错误

### agent-lib 中使用 medDatabasePortal 的组件
- `BibliographySearchComponent` - 使用 `PubmedService`

## 解决方案

### 新的包结构
```
libs/
├── agent-lib/          # 核心库（纯 ESM）
├── bibliography-search/  # 新包：PubMed 搜索功能（纯 ESM）
└── medDatabasePortal/  # 保留但不再被 agent-lib 依赖
```

## 实施步骤

### 阶段 1: 创建 bibliography-search 包

**1.1 创建包目录结构**
```
libs/bibliography-search/
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── src/
│   ├── index.ts
│   ├── pubmed/
│   │   ├── pubmed.service.ts    # 从 medDatabasePortal 迁移，移除 @Injectable
│   │   ├── pubmed.types.ts     # 提取类型定义
│   │   └── pubmed.utils.ts     # 提取工具函数
│   └── component/
│       ├── BibliographySearchComponent.ts  # 从 agent-lib 迁移
│       ├── bibliographySearchSchemas.ts
│       └── bibliographySearchTools.ts
```

**1.2 package.json 配置（纯 ESM）**
```json
{
  "name": "bibliography-search",
  "version": "0.0.1",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsup src/index.ts",
    "dev": "tsup src/index.ts --watch"
  },
  "dependencies": {
    "axios": "^1.12.2",
    "cheerio": "^1.0.0",
    "zod": "^3.0.0"
  },
  "devDependencies": {
    "tsup": "^8.5.1",
    "typescript": "^5.9.3"
  },
  "peerDependencies": {
    "agent-lib": "workspace:*"
  }
}
```

**1.3 tsconfig.json 配置**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "declaration": true,
    "outDir": "./dist",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"]
}
```

**1.4 tsup.config.ts 配置（纯 ESM）**
```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
});
```

### 阶段 2: 迁移 PubmedService

**2.1 移除 @Injectable 装饰器**
```typescript
// 修改前
@Injectable()
export class PubmedService { ... }

// 修改后
export class PubmedService { ... }
```

**2.2 提取类型定义到独立文件**
- `PubmedSearchParams`
- `ArticleProfile`
- `ArticleDetail`
- `Author`, `Keyword`, `FullTextSource` 等
- `RetrivalStrategy`, `FieldConstraint`

### 阶段 3: 迁移 BibliographySearchComponent

**3.1 从 agent-lib 迁移文件**
- `libs/agent-lib/src/components/bibliographySearch/bibliographySearchComponent.ts`
- `libs/agent-lib/src/components/bibliographySearch/bibliographySearchSchemas.ts`
- `libs/agent-lib/src/components/bibliographySearch/bibliographySearchTools.ts`

**3.2 更新导入路径**
```typescript
// 修改前
import { PubmedService, ... } from 'med_database_portal'

// 修改后
import { PubmedService, ... } from '../pubmed/index.js'
```

### 阶段 4: 更新 agent-lib

**4.1 从 package.json 移除 medDatabasePortal 依赖**

**4.2 从 DI 容器移除 BibliographySearchComponent 注册**
- 更新 `libs/agent-lib/src/di/container.ts`

**4.3 从 components/index.ts 移除导出**

### 阶段 5: 更新依赖关系

**5.1 agent-lib package.json**
```json
{
  "dependencies": {
    // 移除 "med_database_portal": "workspace:*"
  }
}
```

**5.2 agent-lib-test package.json**
```json
{
  "dependencies": {
    "agent-lib": "workspace:*",
    "bibliography-search": "workspace:*"  // 如果需要使用 BibliographySearchComponent
  }
}
```

### 阶段 6: 测试

**6.1 单元测试**
- 测试 PubmedService 的搜索功能
- 测试 BibliographySearchComponent

**6.2 集成测试**
- 测试 agent-lib 不依赖 medDatabasePortal
- 测试 bibliography-search 包独立运行

## 文件变更清单

### 新建文件
- `libs/bibliography-search/package.json`
- `libs/bibliography-search/tsconfig.json`
- `libs/bibliography-search/tsup.config.ts`
- `libs/bibliography-search/src/index.ts`
- `libs/bibliography-search/src/pubmed/pubmed.service.ts`
- `libs/bibliography-search/src/pubmed/pubmed.types.ts`
- `libs/bibliography-search/src/pubmed/pubmed.utils.ts`
- `libs/bibliography-search/src/component/BibliographySearchComponent.ts`
- `libs/bibliography-search/src/component/bibliographySearchSchemas.ts`
- `libs/bibliography-search/src/component/bibliographySearchTools.ts`

### 修改文件
- `libs/agent-lib/package.json` - 移除 medDatabasePortal 依赖
- `libs/agent-lib/src/di/container.ts` - 移除 BibliographySearchComponent 注册
- `libs/agent-lib/src/components/index.ts` - 移除导出
- `pnpm-workspace.yaml` - 添加 bibliography-search 包

### 删除文件
- `libs/agent-lib/src/components/bibliographySearch/` - 整个目录迁移

## 风险评估

### 低风险
- 创建新包
- 迁移类型定义

### 中风险
- 移除 @Injectable 装饰器（可能影响其他使用 medDatabasePortal 的代码）

### 需要验证
- 确认没有其他代码依赖 medDatabasePortal 的 @Injectable 装饰器
- 确认 BibliographySearchComponent 的所有功能正常

## 时间线

1. **阶段 1**: 创建 bibliography-search 包结构
2. **阶段 2**: 迁移 PubmedService（移除装饰器）
3. **阶段 3**: 迁移 BibliographySearchComponent
4. **阶段 4**: 更新 agent-lib 依赖
5. **阶段 5**: 测试验证
6. **阶段 6**: 清理和文档
