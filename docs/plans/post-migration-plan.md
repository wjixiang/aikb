# 后续迁移计划：纯 ESM 架构完善

## 当前状态

完成 medDatabasePortal 迁移后，agent-lib 仍有以下潜在问题：

### 1. 剩余的 CJS 依赖

| 依赖 | 问题 | 影响 |
|------|------|------|
| `@nestjs/common` | CJS 模块 | 装饰器 `@injectable`, `@inject` 等 |
| `inversify` | 支持 ESM | ✅ 无问题 |
| `reflect-metadata` | CJS 模块 | 元数据反射，需要 |

### 2. 装饰器问题

当前 agent-lib 使用以下 TypeScript 实验性装饰器：
- `@injectable()` - 来自 inversify
- `@inject()` - 来自 inversify
- `@optional()` - 来自 inversify
- `@reflect-metadata` - 元数据反射

## 下一步计划

### 阶段 1: 验证纯 ESM 运行

**目标：** 确保迁移后的代码可以在生产环境运行

**步骤：**
1. 构建 agent-lib
2. 构建 agent-lib-test
3. 运行 `node dist/demo-expert.js`
4. 验证所有功能正常

**成功标准：**
- 无 ESM/CJS 互操作错误
- 装饰器正常工作
- 依赖注入正常工作

### 阶段 2: 优化构建配置

**目标：** 统一所有包的构建配置

**步骤：**
1. 创建共享的 tsup 配置
2. 所有包使用相同的 ESM 配置
3. 添加 sourcemap 和类型声明

**文件变更：**
```
libs/
├── tsup.config.base.ts   # 共享配置
├── agent-lib/
│   └── tsup.config.ts     # 继承共享配置
├── bibliography-search/
│   └── tsup.config.ts     # 继承共享配置
└── medDatabasePortal/
    └── tsup.config.ts      # 继承共享配置
```

### 阶段 3: 生产环境部署方案

**目标：** 制定生产环境运行方案

**选项 A：Docker 容器化**
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --prod
COPY . .
RUN pnpm build
CMD ["node", "dist/index.js"]
```

**选项 B：单文件打包**
使用 tsup 的 `--bundle` 选项将所有依赖打包成单文件

**选项 C：保持当前方案**
- 预构建所有依赖
- 使用 pnpm workspace 链接

### 阶段 4: 清理遗留依赖

**目标：** 移除不再需要的依赖

**检查清单：**
- [ ] `@nestjs/common` 是否还需要？
- [ ] `med_database_portal` 是否还有其他地方使用？
- [ ] 未使用的依赖清理

### 阶段 5: 文档更新

**目标：** 更新项目文档

**内容：**
1. 更新 README.md
2. 添加迁移指南
3. 更新贡献指南
4. 添加故障排除文档

## 优先级排序

| 优先级 | 任务 | 原因 |
|--------|------|------|
| P0 | 验证纯 ESM 运行 | 确保迁移成功 |
| P1 | 生产环境部署方案 | 支持生产使用 |
| P2 | 优化构建配置 | 提高开发效率 |
| P3 | 清理遗留依赖 | 减少技术债务 |
| P4 | 文档更新 | 提高可维护性 |

## 风险评估

### 高风险
- 生产环境部署方案选择错误

### 中风险
- 遗留依赖导致运行时错误

### 低风险
- 构建配置优化
- 文档更新

## 建议的执行顺序

1. **立即执行：** 验证纯 ESM 运行
2. **短期执行：** 生产环境部署方案
3. **中期执行：** 优化构建配置
4. **长期执行：** 清理遗留依赖 + 文档更新
