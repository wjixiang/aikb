# Case Hub 架构文档

本文档描述 Case Hub 病历管理系统的整体架构设计。

## 目录

- [系统概述](#系统概述)
- [架构设计](#架构设计)
- [模块说明](#模块说明)
- [数据流](#数据流)
- [数据库设计](#数据库设计)
- [部署架构](#部署架构)
- [安全设计](#安全设计)

## 系统概述

Case Hub 是一个基于 NestJS 的病历管理系统，采用分层架构设计，支持病历的生成、存储、查询和管理。

### 核心功能

1. **病历生成**：基于 LLM 自动生成符合医疗规范的病历
2. **病历存储**：使用 PostgreSQL 存储结构化病历数据
3. **病历查询**：支持多维度筛选和全文搜索
4. **批量生成**：支持异步批量生成任务

### 技术选型

| 组件 | 技术 | 说明 |
|------|------|------|
| 框架 | NestJS 11 | Node.js 企业级框架 |
| 数据库 | PostgreSQL 16 | 关系型数据库 |
| ORM | Prisma 6 | 现代数据库工具包 |
| 文档 | Swagger/OpenAPI | API 文档自动生成 |
| 容器 | Docker | 容器化部署 |
| 测试 | Jest | 单元测试和 E2E 测试 |

## 架构设计

### 整体架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                          Client Layer                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   Web App   │  │  Mobile App │  │      API Consumer       │  │
│  └──────┬──────┘  └──────┬──────┘  └───────────┬─────────────┘  │
└─────────┼────────────────┼─────────────────────┼────────────────┘
          │                │                     │
          └────────────────┴─────────────────────┘
                           │
                    HTTP/REST
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                      API Gateway Layer                           │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  • 路由转发  • 限流控制  • 认证授权  • 日志记录          │  │
│  └──────────────────────────────────────────────────────────┘  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                    Application Layer                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   Cases      │  │   Generator  │  │      Storage         │  │
│  │   Module     │  │   Module     │  │      Module          │  │
│  │              │  │              │  │                      │  │
│  │ • Controller │  │ • Controller │  │ • Prisma Service     │  │
│  │ • Service    │  │ • Service    │  │ • Storage Service    │  │
│  │ • DTO        │  │ • DTO        │  │ • Repository         │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    Common Layer                          │  │
│  │  • Exception Filters  • Interceptors  • Pipes            │  │
│  │  • Guards             • Decorators    • Utils            │  │
│  └──────────────────────────────────────────────────────────┘  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                      Domain Layer                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │    Case      │  │   Template   │  │    GenerationJob     │  │
│  │   Entity     │  │   Entity     │  │       Entity         │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                   Infrastructure Layer                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  PostgreSQL  │  │    LLM       │  │   File Storage       │  │
│  │              │  │   APIs       │  │   (Local/S3)         │  │
│  │ • Case       │  │              │  │                      │  │
│  │ • Template   │  │ • Minimax    │  │ • Case files         │  │
│  │ • Job        │  │ • OpenAI     │  │ • Generated docs     │  │
│  │              │  │ • GLM        │  │                      │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 分层架构说明

#### 1. Client Layer（客户端层）

- Web 应用程序
- 移动应用程序
- 第三方 API 消费者

#### 2. API Gateway Layer（网关层）

- 路由转发
- 限流控制（Rate Limiting）
- 认证授权
- 请求日志记录
- CORS 处理

#### 3. Application Layer（应用层）

核心业务逻辑所在层，包含：

- **Cases Module**: 病历管理模块
- **Generator Module**: 病历生成模块
- **Storage Module**: 存储管理模块
- **Common Layer**: 通用组件（过滤器、拦截器、管道等）

#### 4. Domain Layer（领域层）

定义核心业务实体：

- Case（病历）
- CaseTemplate（病历模板）
- GenerationJob（生成任务）

#### 5. Infrastructure Layer（基础设施层）

外部依赖：

- PostgreSQL 数据库
- LLM API（Minimax、OpenAI、GLM）
- 文件存储（本地或 S3）

## 模块说明

### Cases Module（病历管理模块）

负责病历的 CRUD 操作和查询。

```
src/cases/
├── cases.controller.ts      # REST API 控制器
├── cases.service.ts         # 业务逻辑服务
├── cases.module.ts          # 模块定义
├── dto/
│   ├── create-case.dto.ts   # 创建病历 DTO
│   ├── update-case.dto.ts   # 更新病历 DTO
│   ├── query-case.dto.ts    # 查询病历 DTO
│   └── case-response.dto.ts # 响应 DTO
├── entities/
│   └── case.entity.ts       # 病历实体
└── interfaces/
    └── case.interface.ts    # 类型接口
```

**核心功能**：

- 创建病历
- 查询病历（支持分页、筛选、排序）
- 更新病历
- 删除病历（软删除）
- 获取科室/疾病列表

### Generator Module（病历生成模块）

负责基于 LLM 生成病历。

```
src/generator/
├── generator.controller.ts      # REST API 控制器
├── generator.service.ts         # 业务逻辑服务
├── generator.module.ts          # 模块定义
├── dto/
│   ├── generate-case.dto.ts     # 生成病历 DTO
│   ├── batch-generate.dto.ts    # 批量生成 DTO
│   └── generation-response.dto.ts # 响应 DTO
└── interfaces/
    └── generator.interface.ts   # 类型接口
```

**核心功能**：

- 单个病历生成
- 批量病历生成（异步）
- 长病历生成（~3000字）
- 任务状态查询
- 模板管理

**生成流程**：

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Request   │────▶│   Validate  │────▶│   Select    │
│   Params    │     │   Params    │     │   Template  │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
┌─────────────┐     ┌─────────────┐     ┌──────▼──────┐
│   Return    │────▶│   Parse     │────▶│   Call      │
│   Result    │     │   Response  │     │   LLM API   │
└─────────────┘     └─────────────┘     └─────────────┘
```

### Storage Module（存储模块）

负责数据库访问和文件存储。

```
src/storage/
├── storage.service.ts         # 存储服务
├── prisma.service.ts          # Prisma 客户端
├── storage.module.ts          # 模块定义
├── case-repository.service.ts # 病历仓库
├── dto/                       # DTO
├── entities/                  # 实体
└── interfaces/                # 接口
```

**核心功能**：

- Prisma Client 管理
- 数据库连接池管理
- 文件存储（本地/S3）
- 数据访问抽象

## 数据流

### 病历创建流程

```
┌─────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────┐
│ Client  │──▶│ Controller  │──▶│   Service   │──▶│ Repository  │──▶│   DB    │
└─────────┘   └─────────────┘   └─────────────┘   └─────────────┘   └─────────┘
                   │                  │                  │
                   ▼                  ▼                  ▼
            ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
            │  Validate   │   │  Business   │   │  Prisma     │
            │    DTO      │   │   Logic     │   │  Client     │
            └─────────────┘   └─────────────┘   └─────────────┘
```

### 病历生成流程

```
┌─────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│ Client  │──▶│ Controller  │──▶│   Service   │──▶│   Select    │
└─────────┘   └─────────────┘   └─────────────┘   │  Template   │
                                                  └──────┬──────┘
                                                         │
    ┌────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│   Parse     │◀──│   Receive   │◀──│   Call      │◀──│   Build     │
│   Response  │   │   Response  │   │   LLM API   │   │   Prompt    │
└──────┬──────┘   └─────────────┘   └─────────────┘   └─────────────┘
       │
       ▼
┌─────────────┐   ┌─────────────┐
│   Return    │──▶│   Client    │
│   Result    │   │             │
└─────────────┘   └─────────────┘
```

### 批量生成任务流程

```
┌─────────┐     ┌─────────────┐     ┌─────────────┐
│ Client  │────▶│   Submit    │────▶│  Create Job │
│         │     │   Request   │     │  (pending)  │
└─────────┘     └─────────────┘     └──────┬──────┘
                                           │
                                           ▼
┌─────────┐     ┌─────────────┐     ┌─────────────┐
│ Client  │◀────│   Return    │◀────│   Process   │
│         │     │   Job ID    │     │   Async     │
└────┬────┘     └─────────────┘     └──────┬──────┘
     │                                      │
     │ Poll Status                          ▼
     │                              ┌─────────────┐
     └─────────────────────────────▶│   Update    │
                                    │   Status    │
                                    └─────────────┘
```

## 数据库设计

### ER 图

```
┌─────────────────────────────────────────────────────────────────┐
│                              Case                                │
├─────────────────────────────────────────────────────────────────┤
│ PK  id: String @id @default(cuid())                             │
│     caseNumber: String @unique                                  │
│     patientName: String?                                        │
│     gender: String?                                             │
│     age: Int?                                                   │
│     department: String                                          │
│     disease: String                                             │
│     content: Json                                               │
│     caseType: String                                            │
│     metadata: Json?                                             │
│     status: String @default("active")                           │
│     createdAt: DateTime @default(now())                         │
│     updatedAt: DateTime @updatedAt                              │
│     createdBy: String?                                          │
│     updatedBy: String?                                          │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                          CaseTemplate                            │
├─────────────────────────────────────────────────────────────────┤
│ PK  id: String @id @default(cuid())                             │
│     name: String                                                │
│     department: String                                          │
│     disease: String?                                            │
│     template: String @db.Text                                   │
│     description: String?                                        │
│     createdAt: DateTime @default(now())                         │
│     updatedAt: DateTime @updatedAt                              │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                          GenerationJob                           │
├─────────────────────────────────────────────────────────────────┤
│ PK  id: String @id @default(cuid())                             │
│     status: String                                              │
│     params: Json                                                │
│     result: String? @db.Text                                    │
│     error: String?                                              │
│     createdAt: DateTime @default(now())                         │
│     completedAt: DateTime?                                      │
└─────────────────────────────────────────────────────────────────┘
```

### 索引设计

**Case 表索引**：

```sql
-- 主键查询
CREATE INDEX idx_case_caseNumber ON "Case"(caseNumber);

-- 常用筛选条件
CREATE INDEX idx_case_department ON "Case"(department);
CREATE INDEX idx_case_disease ON "Case"(disease);
CREATE INDEX idx_case_caseType ON "Case"(caseType);
CREATE INDEX idx_case_status ON "Case"(status);

-- 时间范围查询
CREATE INDEX idx_case_createdAt ON "Case"(createdAt);

-- 组合索引
CREATE INDEX idx_case_department_disease ON "Case"(department, disease);
```

**CaseTemplate 表索引**：

```sql
CREATE INDEX idx_template_department ON "CaseTemplate"(department);
CREATE INDEX idx_template_disease ON "CaseTemplate"(disease);
CREATE INDEX idx_template_department_disease ON "CaseTemplate"(department, disease);
```

**GenerationJob 表索引**：

```sql
CREATE INDEX idx_job_status ON "GenerationJob"(status);
CREATE INDEX idx_job_createdAt ON "GenerationJob"(createdAt);
CREATE INDEX idx_job_status_createdAt ON "GenerationJob"(status, createdAt);
```

## 部署架构

### Docker Compose 部署

```
┌─────────────────────────────────────────────────────────────────┐
│                        Docker Network                            │
│                    (case-hub-network)                            │
│                                                                  │
│  ┌─────────────────────┐      ┌─────────────────────┐          │
│  │    case-hub         │      │    postgres         │          │
│  │    (NestJS App)     │◀────▶│    (PostgreSQL 16)  │          │
│  │                     │      │                     │          │
│  │  Port: 3002         │      │  Port: 5432         │          │
│  │  Volume: storage    │      │  Volume: data       │          │
│  └─────────────────────┘      └─────────────────────┘          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 生产环境部署

```
┌─────────────────────────────────────────────────────────────────┐
│                        Load Balancer                             │
│                      (Nginx/ALB)                                 │
└──────────────────────────┬──────────────────────────────────────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
    ┌──────▼──────┐ ┌──────▼──────┐ ┌──────▼──────┐
    │  case-hub   │ │  case-hub   │ │  case-hub   │
    │   Instance  │ │   Instance  │ │   Instance  │
    │      1      │ │      2      │ │      N      │
    └──────┬──────┘ └──────┬──────┘ └──────┬──────┘
           │               │               │
           └───────────────┼───────────────┘
                           │
                  ┌────────▼────────┐
                  │   PostgreSQL    │
                  │    Cluster      │
                  │  (Primary +     │
                  │   Replicas)     │
                  └─────────────────┘
```

## 安全设计

### 1. 输入验证

- 使用 DTO 和 class-validator 进行参数验证
- 全局 ValidationPipe 自动验证所有输入
- 自定义验证规则防止注入攻击

### 2. 输出过滤

- 全局 TransformInterceptor 统一响应格式
- 异常过滤器统一错误处理
- 敏感信息脱敏

### 3. 安全中间件

- **Helmet**: HTTP 安全头
- **CORS**: 跨域控制
- **Compression**: 响应压缩
- **Rate Limiting**: 请求限流

### 4. 数据安全

- 数据库连接使用 SSL/TLS
- 敏感配置使用环境变量
- 数据库密码加密存储

### 5. 日志安全

- 不记录敏感信息（密码、密钥等）
- 日志分级管理
- 审计日志记录关键操作

## 扩展性设计

### 1. 模块化架构

- 每个模块独立开发、测试、部署
- 模块间通过接口通信
- 支持按需加载模块

### 2. 水平扩展

- 无状态服务设计
- 支持多实例部署
- 负载均衡分发请求

### 3. 数据库扩展

- 读写分离支持
- 分库分表预留
- 缓存层支持

### 4. 功能扩展

- 插件化 LLM 提供商
- 可配置存储后端
- 自定义病历模板

## 监控与日志

### 日志级别

- `error`: 错误日志
- `warn`: 警告日志
- `info`: 信息日志
- `debug`: 调试日志

### 健康检查

- `/api/health`: 基础健康检查
- Docker 健康检查每 30 秒执行
- 数据库连接状态监控

### 性能指标

- 请求响应时间
- 数据库查询时间
- LLM API 调用时间
- 内存和 CPU 使用率
