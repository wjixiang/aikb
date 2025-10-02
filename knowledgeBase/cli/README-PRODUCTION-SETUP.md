# CLI生产环境设置指南

## 概述

本文档描述了如何将知识库CLI从演示模式切换到生产模式，实现与真实MongoDB数据库的连接和数据持久化。

## 完成的修改

### 1. 数据库连接配置

- **环境变量配置**: 创建了`.env`文件，配置了MongoDB连接参数
  ```
  MONGODB_URI=mongodb://mongodb:27017
  DB_NAME=aikb
  ```

- **存储初始化工具**: 更新了[`knowledgeBase/cli/utils/storage.ts`](knowledgeBase/cli/utils/storage.ts:1)
  - 添加了详细的日志记录
  - 改进了错误处理和用户反馈
  - 添加了数据库连接状态检查功能
  - 增加了`displayDatabaseStatus()`函数

### 2. CLI主入口更新

- **主入口文件**: 更新了[`knowledgeBase/cli/index.ts`](knowledgeBase/cli/index.ts:1)
  - 添加了状态命令
  - 改进了数据库连接检查逻辑
  - 增强了错误处理和用户反馈

### 3. CLI命令更新

- **创建实体命令**: 更新了[`knowledgeBase/cli/commands/create-entity.ts`](knowledgeBase/cli/commands/create-entity.ts:1)
  - 添加了详细的日志记录
  - 改进了错误处理和用户提示
  - 确保使用真实的存储实现

- **创建知识命令**: 更新了[`knowledgeBase/cli/commands/create-knowledge.ts`](knowledgeBase/cli/commands/create-knowledge.ts:1)
  - 添加了详细的日志记录
  - 改进了错误处理和用户提示
  - 确保使用真实的存储实现

- **渲染Markdown命令**: 更新了[`knowledgeBase/cli/commands/render-markdown.ts`](knowledgeBase/cli/commands/render-markdown.ts:1)
  - 添加了详细的日志记录
  - 改进了错误处理和用户提示
  - 确保从真实数据库查询数据

### 4. 生产CLI工具

创建了简化的生产CLI工具[`knowledgeBase/cli/simple-production-cli.js`](knowledgeBase/cli/simple-production-cli.js:1)，包含以下功能：

- **状态命令**: 显示数据库连接状态和统计信息
- **创建实体命令**: 创建新实体并保存到数据库
- **创建知识命令**: 创建新知识并关联到实体
- **查询实体命令**: 列出数据库中的实体
- **查询知识命令**: 列出数据库中的知识

## 测试结果

### 数据库连接测试

✅ **成功**: MongoDB连接正常
- 连接地址: `mongodb://mongodb:27017`
- 数据库名称: `aikb`
- 发现集合数量: 5个

### 数据持久化测试

✅ **成功**: 实体创建功能正常
- 成功创建测试实体
- 实体ID: `68de4b5c04c9eef755b28f62`
- 数据正确保存到数据库

✅ **成功**: 知识创建功能正常
- 成功创建测试知识
- 知识ID: `68de4bbef08ba69829406aaa`
- 正确关联到实体
- 数据正确保存到数据库

### 数据查询测试

✅ **成功**: 实体查询功能正常
- 成功查询数据库中的实体
- 实体数量: 1336个
- 数据正确显示

✅ **成功**: 知识查询功能正常
- 成功查询数据库中的知识
- 知识数量: 1个
- 正确显示实体关联关系

## 使用方法

### 1. 检查数据库状态

```bash
node knowledgeBase/cli/simple-production-cli.js status
```

### 2. 创建实体

```bash
node knowledgeBase/cli/simple-production-cli.js create-entity \
  --name "实体名称" \
  --definition "实体定义" \
  --tags "标签1,标签2"
```

### 3. 创建知识

```bash
node knowledgeBase/cli/simple-production-cli.js create-knowledge \
  --entity-id "实体ID" \
  --scope "知识范围" \
  --content "知识内容"
```

### 4. 查询实体

```bash
node knowledgeBase/cli/simple-production-cli.js list-entities --limit 10
```

### 5. 查询知识

```bash
node knowledgeBase/cli/simple-production-cli.js list-knowledge
```

## 错误处理

CLI工具包含了完善的错误处理机制：

- **数据库连接失败**: 提供详细的错误信息和解决建议
- **无效ID格式**: 检查并提示正确的ObjectId格式
- **数据验证失败**: 提供清晰的验证错误信息
- **权限问题**: 提供文件访问权限相关的错误提示

## 注意事项

1. **环境变量**: 确保`.env`文件中的数据库连接参数正确
2. **MongoDB服务**: 确保MongoDB服务正在运行并可访问
3. **权限**: 确保应用有足够的权限访问数据库
4. **数据备份**: 建议定期备份重要数据

## 下一步改进

1. 添加交互式模式，提供更友好的用户体验
2. 实现批量操作功能
3. 添加数据导入导出功能
4. 实现更多查询和过滤选项
5. 添加数据验证和清理功能