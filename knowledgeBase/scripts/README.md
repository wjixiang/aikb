# Elasticsearch 清空脚本

这个目录包含用于清空Elasticsearch数据库的测试辅助脚本。

## clear-elasticsearch.ts

这是一个用于清空Elasticsearch数据库中特定索引的测试辅助脚本。

### 功能

- 清空项目中的Elasticsearch索引：
  - `entities` - 实体内容存储
  - `knowledge_vectors` - 知识向量存储
  - `entity_vectors` - 实体向量存储
- 显示每个索引的文档数量
- 提供确认提示以防止意外删除
- 支持跳过确认提示（用于自动化脚本）

### 使用方法

#### 通过npm脚本运行（推荐）

```bash
# 交互式运行（需要确认）
pnpm run clear:elasticsearch

# 跳过确认提示（用于自动化）
SKIP_CONFIRMATION=true pnpm run clear:elasticsearch
```

#### 直接运行

```bash
# 交互式运行（需要确认）
npx tsx knowledgeBase/scripts/clear-elasticsearch.ts

# 跳过确认提示（用于自动化）
SKIP_CONFIRMATION=true npx tsx knowledgeBase/scripts/clear-elasticsearch.ts
```

## clear-elasticsearch-advanced.ts

这是一个高级版本的Elasticsearch清空脚本，提供更多选项和灵活性。

### 功能

- 清空所有索引或根据模式匹配清空索引
- 支持指定要排除的索引
- 预览模式（不实际删除）
- 默认排除系统索引
- 显示每个索引的文档数量
- 提供确认提示以防止意外删除
- 支持跳过确认提示（用于自动化脚本）

### 使用方法

#### 通过npm脚本运行（推荐）

```bash
# 清空默认索引
pnpm run clear:elasticsearch:advanced

# 清空所有索引
pnpm run clear:elasticsearch:advanced --all

# 清空匹配模式的索引
pnpm run clear:elasticsearch:advanced --pattern "test_*"

# 清空指定索引
pnpm run clear:elasticsearch:advanced --indices "index1,index2"

# 清空所有索引但排除系统索引
pnpm run clear:elasticsearch:advanced --all --exclude ".kibana,.security"

# 预览将要删除的索引
pnpm run clear:elasticsearch:advanced --dry-run
```

#### 直接运行

```bash
# 显示帮助信息
npx tsx knowledgeBase/scripts/clear-elasticsearch-advanced.ts --help

# 清空默认索引
npx tsx knowledgeBase/scripts/clear-elasticsearch-advanced.ts

# 清空所有索引
npx tsx knowledgeBase/scripts/clear-elasticsearch-advanced.ts --all

# 清空匹配模式的索引
npx tsx knowledgeBase/scripts/clear-elasticsearch-advanced.ts --pattern "test_*"

# 清空指定索引
npx tsx knowledgeBase/scripts/clear-elasticsearch-advanced.ts --indices "index1,index2"

# 清空所有索引但排除系统索引
npx tsx knowledgeBase/scripts/clear-elasticsearch-advanced.ts --all --exclude ".kibana,.security"

# 预览将要删除的索引
npx tsx knowledgeBase/scripts/clear-elasticsearch-advanced.ts --dry-run
```

### 环境变量

| 变量名 | 描述 | 默认值 | 必需 |
|--------|------|--------|------|
| `ELASTICSEARCH_URL` | Elasticsearch服务器地址 | `http://elasticsearch:9200` | 否 |
| `ELASTICSEARCH_URL_API_KEY` | Elasticsearch API密钥 | 空 | 否 |
| `SKIP_CONFIRMATION` | 跳过确认提示 | `false` | 否 |

### 示例输出

```
[2023-10-08T10:00:00.000Z] [ClearElasticsearch] INFO: 连接到Elasticsearch: http://elasticsearch:9200
[2023-10-08T10:00:00.100Z] [ClearElasticsearch] INFO: 成功连接到Elasticsearch服务器
[2023-10-08T10:00:00.200Z] [ClearElasticsearch] INFO: 现有索引: entities, knowledge_vectors, entity_vectors
[2023-10-08T10:00:00.300Z] [ClearElasticsearch] INFO: 发现索引: entities (包含 150 个文档)
[2023-10-08T10:00:00.400Z] [ClearElasticsearch] INFO: 发现索引: knowledge_vectors (包含 300 个文档)
[2023-10-08T10:00:00.500Z] [ClearElasticsearch] INFO: 发现索引: entity_vectors (包含 75 个文档)
[2023-10-08T10:00:00.600Z] [ClearElasticsearch] WARN: 以下索引将被清空:
[2023-10-08T10:00:00.700Z] [ClearElasticsearch] WARN:   - entities (150 个文档)
[2023-10-08T10:00:00.800Z] [ClearElasticsearch] WARN:   - knowledge_vectors (300 个文档)
[2023-10-08T10:00:00.900Z] [ClearElasticsearch] WARN:   - entity_vectors (75 个文档)
确定要清空这些索引吗？此操作不可撤销！ (y/N): y
[2023-10-08T10:00:01.000Z] [ClearElasticsearch] INFO: 正在清空索引: entities
[2023-10-08T10:00:01.100Z] [ClearElasticsearch] INFO: 已删除索引: entities (150 个文档)
[2023-10-08T10:00:01.200Z] [ClearElasticsearch] INFO: 正在清空索引: knowledge_vectors
[2023-10-08T10:00:01.300Z] [ClearElasticsearch] INFO: 已删除索引: knowledge_vectors (300 个文档)
[2023-10-08T10:00:01.400Z] [ClearElasticsearch] INFO: 正在清空索引: entity_vectors
[2023-10-08T10:00:01.500Z] [ClearElasticsearch] INFO: 已删除索引: entity_vectors (75 个文档)
[2023-10-08T10:00:01.600Z] [ClearElasticsearch] INFO: Elasticsearch数据库清空完成
[2023-10-08T10:00:01.700Z] [ClearElasticsearch] INFO: 脚本执行完成
```

## clear-library.ts

这是一个专门用于清空文献存储记录的脚本，支持MongoDB和Elasticsearch两种存储方式。

### 功能

- 清空MongoDB中的文献数据集合
- 清空Elasticsearch中的文献数据索引
- 支持仅清空MongoDB或仅清空Elasticsearch
- 显示每个集合/索引的文档数量
- 提供确认提示以防止意外删除
- 支持预览模式（不实际删除）
- 支持跳过确认提示（用于自动化脚本）

### 使用方法

#### 通过npm脚本运行（推荐）

```bash
# 清空所有文献数据（MongoDB和Elasticsearch）
pnpm run clear:library

# 仅清空Elasticsearch中的文献数据
pnpm run clear:library --elasticsearch-only

# 仅清空MongoDB中的文献数据
pnpm run clear:library --mongodb-only

# 预览将要删除的数据
pnpm run clear:library --dry-run
```

#### 直接运行

```bash
# 显示帮助信息
npx tsx knowledgeBase/scripts/clear-library.ts --help

# 清空所有文献数据
npx tsx knowledgeBase/scripts/clear-library.ts

# 仅清空Elasticsearch中的文献数据
npx tsx knowledgeBase/scripts/clear-library.ts --elasticsearch-only

# 仅清空MongoDB中的文献数据
npx tsx knowledgeBase/scripts/clear-library.ts --mongodb-only

# 预览将要删除的数据
npx tsx knowledgeBase/scripts/clear-library.ts --dry-run
```

### 清空的数据

#### MongoDB集合
- `library_pdfs` - PDF文件信息
- `library_metadata` - 文献元数据
- `library_collections` - 文献集合
- `library_citations` - 文献引用

#### Elasticsearch索引
- `library_metadata` - 文献元数据
- `library_collections` - 文献集合
- `library_citations` - 文献引用

## test-clear-elasticsearch.ts

这是一个测试脚本，用于创建测试索引并验证清空脚本功能。

### 功能

- 创建测试索引和测试文档
- 提供交互式测试流程
- 验证清空脚本是否正常工作

### 使用方法

#### 通过npm脚本运行（推荐）

```bash
pnpm run test:clear:elasticsearch
```

#### 直接运行

```bash
npx tsx knowledgeBase/scripts/test-clear-elasticsearch.ts
```

### 测试流程

1. 创建测试索引（test_entities, test_knowledge_vectors, test_entity_vectors, test_other_index）
2. 提示用户运行清空脚本
3. 验证清空结果

## 使用示例

### 基本使用

```bash
# 清空默认Elasticsearch索引
pnpm run clear:elasticsearch

# 使用高级脚本清空默认索引
pnpm run clear:elasticsearch:advanced

# 清空所有Elasticsearch索引
pnpm run clear:elasticsearch:advanced --all

# 清空匹配模式的索引
pnpm run clear:elasticsearch:advanced --pattern "test_*"

# 清空指定索引
pnpm run clear:elasticsearch:advanced --indices "index1,index2"

# 清空所有索引但排除系统索引
pnpm run clear:elasticsearch:advanced --all --exclude ".kibana,.security"

# 预览将要删除的索引
pnpm run clear:elasticsearch:advanced --dry-run

# 清空所有文献数据（MongoDB和Elasticsearch）
pnpm run clear:library

# 仅清空Elasticsearch中的文献数据
pnpm run clear:library --elasticsearch-only

# 仅清空MongoDB中的文献数据
pnpm run clear:library --mongodb-only

# 预览将要删除的文献数据
pnpm run clear:library --dry-run

# 测试清空脚本
pnpm run test:clear:elasticsearch
```

### 自动化使用

```bash
# 跳过确认提示
SKIP_CONFIRMATION=true pnpm run clear:elasticsearch

# 使用自定义Elasticsearch地址
ELASTICSEARCH_URL=http://elasticsearch:9200 pnpm run clear:elasticsearch

# 使用API密钥
ELASTICSEARCH_URL_API_KEY="your-api-key" pnpm run clear:elasticsearch

# 自动清空文献数据
SKIP_CONFIRMATION=true pnpm run clear:library
```

### 注意事项

1. 此脚本仅用于测试环境，不要在生产环境中使用
2. 删除操作不可撤销，请确保已备份重要数据
3. 在运行脚本前，请确保Elasticsearch服务器正在运行且可访问
4. 如果使用Docker运行Elasticsearch，请确保容器正在运行
5. 脚本已添加File polyfill以解决Node.js兼容性问题，可以在Node.js环境中正常运行

### 故障排除

#### 连接错误

如果遇到连接错误，请检查：
1. Elasticsearch服务器是否正在运行
2. `ELASTICSEARCH_URL` 环境变量是否正确设置
3. 网络连接是否正常

#### 认证错误

如果Elasticsearch启用了安全功能，请设置正确的API密钥：
```bash
export ELASTICSEARCH_URL_API_KEY="your-api-key"
```

#### 权限错误

确保运行脚本的用户有删除Elasticsearch索引的权限。