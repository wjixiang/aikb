# Case Hub

病历管理 NestJS 服务 - 提供病历生成、存储、查询和管理功能。

## 项目介绍

Case Hub 是一个基于 NestJS 的病历管理系统，专为医疗场景设计。系统提供以下核心功能：

- **病历生成**：基于 LLM 自动生成符合医疗规范的病历文档
- **病历存储**：使用 PostgreSQL 数据库存储结构化病历数据
- **病历查询**：支持多维度筛选、分页和全文搜索
- **病历管理**：完整的 CRUD 操作，支持软删除
- **批量生成**：支持异步批量生成病历任务

### 技术栈

- **框架**: [NestJS](https://nestjs.com/) 11.x
- **数据库**: PostgreSQL 16 + Prisma ORM 6.x
- **API 文档**: Swagger/OpenAPI
- **容器化**: Docker + Docker Compose
- **测试**: Jest
- **语言**: TypeScript 5.x

## 安装说明

### 环境要求

- Node.js 22+
- pnpm 10.7.0+
- PostgreSQL 16+
- Docker (可选，用于容器化部署)

### 本地开发安装

1. **克隆仓库并进入项目目录**

```bash
cd apps/case-hub
```

2. **安装依赖**

```bash
pnpm install
```

3. **配置环境变量**

```bash
cp .env.example .env
# 编辑 .env 文件，配置数据库连接和其他参数
```

4. **初始化数据库**

```bash
# 生成 Prisma Client
pnpm prisma:generate

# 推送数据库 schema
pnpm prisma:push

# 可选：运行种子数据
pnpm db:seed
```

5. **启动开发服务器**

```bash
pnpm start:dev
```

服务将启动在 `http://localhost:3000/api`，Swagger 文档地址：`http://localhost:3000/api/docs`

## 环境变量配置

### 核心配置

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `NODE_ENV` | 运行环境 (development/production/test) | `development` |
| `PORT` | 服务端口 | `3000` |
| `HOST` | 服务主机 | `0.0.0.0` |

### 数据库配置

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `DATABASE_URL` | PostgreSQL 连接字符串 | `postgresql://user:pass@localhost:5432/case_hub?schema=public` |
| `DATABASE_POOL_SIZE` | 连接池大小 | `10` |
| `DATABASE_TIMEOUT` | 连接超时 (毫秒) | `30000` |

### 日志配置

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `LOG_LEVEL` | 日志级别 (debug/info/warn/error) | `info` |
| `LOG_FORMAT` | 日志格式 (json/pretty) | `pretty` |

### 存储配置

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `STORAGE_TYPE` | 存储类型 (local/s3/garage) | `local` |
| `STORAGE_PATH` | 本地存储路径 | `./storage/cases` |
| `STORAGE_MAX_SIZE` | 最大文件大小 (字节) | `10485760` (10MB) |

### API 配置

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `API_PREFIX` | API 前缀 | `api` |
| `API_VERSION` | API 版本 | `v1` |

### 限流配置

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `RATE_LIMIT_ENABLED` | 是否启用限流 | `true` |
| `RATE_LIMIT_WINDOW_MS` | 限流时间窗口 (毫秒) | `60000` |
| `RATE_LIMIT_MAX` | 最大请求数 | `100` |

### LLM API 配置

| 变量名 | 说明 |
|--------|------|
| `MINIMAX_API_KEY` | Minimax API 密钥 |
| `OPENAI_API_KEY` | OpenAI API 密钥 (可选) |
| `GLM_API_KEY` | GLM API 密钥 (可选) |

## API 端点文档

### 基础信息

- **基础 URL**: `http://localhost:3000/api`
- **Swagger UI**: `http://localhost:3000/api/docs`
- **健康检查**: `GET /api/health`

### 病历管理 (Cases)

| 方法 | 端点 | 说明 |
|------|------|------|
| `POST` | `/api/cases` | 创建病历 |
| `GET` | `/api/cases` | 查询病历列表 |
| `GET` | `/api/cases/:id` | 获取单个病历 |
| `PATCH` | `/api/cases/:id` | 更新病历 |
| `DELETE` | `/api/cases/:id` | 删除病历 |
| `GET` | `/api/cases/departments/list` | 获取科室列表 |
| `GET` | `/api/cases/diseases/list` | 获取疾病列表 |

#### 查询参数

- `keyword`: 关键词搜索（姓名、病历号、疾病）
- `department`: 科室筛选
- `disease`: 疾病筛选
- `gender`: 性别筛选 (男/女/其他)
- `minAge`/`maxAge`: 年龄范围
- `status`: 状态筛选 (active/archived/deleted)
- `caseType`: 病例分型 (A型/B型/C型/D型)
- `page`: 页码
- `pageSize`: 每页数量

### 病历生成 (Generator)

| 方法 | 端点 | 说明 |
|------|------|------|
| `POST` | `/api/generator/case` | 生成单个病历 |
| `POST` | `/api/generator/batch` | 批量生成病历 |
| `POST` | `/api/generator/long-case` | 生成长病历 (~3000字) |
| `GET` | `/api/generator/jobs` | 获取所有生成任务 |
| `GET` | `/api/generator/jobs/:id` | 查询任务状态 |
| `GET` | `/api/generator/templates` | 获取可用模板列表 |

#### 生成病历请求示例

```json
{
  "department": "呼吸内科",
  "disease": "肺炎",
  "patientName": "张三",
  "ageRange": { "min": 30, "max": 50 },
  "gender": "男",
  "caseType": "A型",
  "anonymize": false
}
```

## 开发指南

### 项目结构

```
case-hub/
├── src/
│   ├── cases/              # 病历管理模块
│   │   ├── cases.controller.ts
│   │   ├── cases.service.ts
│   │   ├── dto/            # 数据传输对象
│   │   └── interfaces/     # 类型定义
│   ├── generator/          # 病历生成模块
│   │   ├── generator.controller.ts
│   │   ├── generator.service.ts
│   │   └── dto/
│   ├── storage/            # 存储模块
│   │   ├── storage.service.ts
│   │   └── prisma.service.ts
│   ├── config/             # 配置文件
│   ├── common/             # 通用组件
│   │   ├── filters/        # 异常过滤器
│   │   ├── interceptors/   # 拦截器
│   │   └── pipes/          # 管道
│   ├── types/              # 类型定义
│   └── main.ts             # 入口文件
├── prisma/
│   ├── schema.prisma       # 数据库模型
│   └── seed.ts             # 种子数据
├── test/                   # 测试文件
├── docs/                   # 文档
├── Dockerfile
├── docker-compose.yml
└── package.json
```

### 常用命令

```bash
# 开发模式启动
pnpm start:dev

# 构建
pnpm build

# 生产模式启动
pnpm start:prod

# 运行测试
pnpm test

# 运行测试并生成覆盖率报告
pnpm test:cov

# 运行 E2E 测试
pnpm test:e2e

# Prisma 操作
pnpm prisma:generate    # 生成 Prisma Client
pnpm prisma:migrate     # 运行迁移
pnpm prisma:push        # 推送 schema 到数据库
pnpm prisma:studio      # 打开 Prisma Studio
```

### 添加新模块

1. 使用 NestJS CLI 生成模块

```bash
npx nest g module new-module
npx nest g controller new-module
npx nest g service new-module
```

2. 在 `app.module.ts` 中导入新模块

3. 添加对应的 DTO 和接口定义

### 数据库变更

1. 修改 `prisma/schema.prisma`
2. 运行 `pnpm prisma:push` 更新数据库
3. 运行 `pnpm prisma:generate` 重新生成客户端

## 部署说明

### Docker 部署

1. **构建并启动服务**

```bash
docker-compose up -d
```

2. **查看日志**

```bash
docker-compose logs -f case-hub
```

3. **停止服务**

```bash
docker-compose down
```

4. **数据库迁移**

```bash
docker-compose --profile migrate up db-migrate
```

### 生产环境部署

1. **准备环境变量**

```bash
# 复制并编辑生产环境配置
cp .env.example .env.production
# 修改数据库连接、API 密钥等配置
```

2. **构建生产镜像**

```bash
docker build --target production -t case-hub:latest .
```

3. **运行容器**

```bash
docker run -d \
  --name case-hub \
  --env-file .env.production \
  -p 3000:3000 \
  -v case-hub-storage:/app/storage/cases \
  case-hub:latest
```

### 健康检查

服务提供以下健康检查端点：

- `GET /api/health` - 基础健康检查
- Docker 健康检查每 30 秒执行一次

### 监控指标

- 服务运行在端口 `3000`
- 日志输出到 `/app/logs` (容器内)
- 文件存储在 `/app/storage/cases` (容器内)

## 许可证

ISC

## 相关文档

- [API 详细文档](./docs/api.md)
- [架构文档](./docs/architecture.md)
