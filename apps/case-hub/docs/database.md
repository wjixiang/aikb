# Case Hub 数据库设计文档

## 概述

Case Hub 使用 PostgreSQL 作为数据库，通过 Prisma ORM 进行数据管理。本文档详细描述了数据库架构、模型定义和使用方法。

## 技术栈

- **数据库**: PostgreSQL 14+
- **ORM**: Prisma 6.5+
- **客户端生成**: `@prisma/client`

## 数据库模型

### 1. Case（病历）

存储病历的核心信息。

```prisma
model Case {
  id          String   @id @default(cuid())
  caseNumber  String   @unique // 病历编号
  patientName String?  // 患者姓名
  gender      String?  // 性别: male, female, other
  age         Int?     // 年龄
  department  String   // 科室
  disease     String   // 疾病名称
  content     String   @db.Text // 病历内容（JSON 序列化）
  caseType    String   // 病历类型: A型, B型, C型, D型
  metadata    Json?    // 额外元数据
  status      String   @default("active") // active, archived, deleted

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([caseNumber])
  @@index([department])
  @@index([disease])
  @@index([caseType])
  @@index([status])
  @@index([createdAt])
  @@index([department, disease])
}
```

#### 字段说明

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | String | PK, CUID | 唯一标识符 |
| `caseNumber` | String | Unique | 病历编号，业务唯一 |
| `patientName` | String | Nullable | 患者姓名 |
| `gender` | String | Nullable | 性别：男/女/其他 |
| `age` | Int | Nullable | 年龄（0-150） |
| `department` | String | Required | 科室名称 |
| `disease` | String | Required | 疾病名称 |
| `content` | String | Text | 病历内容（JSON 字符串） |
| `caseType` | String | Required | 病历类型：A型/B型/C型/D型 |
| `metadata` | Json | Nullable | 扩展元数据 |
| `status` | String | Default: active | 状态：active/archived/deleted |
| `createdAt` | DateTime | Auto | 创建时间 |
| `updatedAt` | DateTime | Auto | 更新时间 |

#### 索引设计

| 索引字段 | 类型 | 用途 |
|----------|------|------|
| `caseNumber` | Unique | 快速查找病历编号 |
| `department` | B-tree | 科室筛选 |
| `disease` | B-tree | 疾病筛选 |
| `caseType` | B-tree | 类型筛选 |
| `status` | B-tree | 状态筛选 |
| `createdAt` | B-tree | 时间排序 |
| `department + disease` | Composite | 组合查询优化 |

---

### 2. CaseTemplate（病历模板）

存储病历生成模板。

```prisma
model CaseTemplate {
  id          String  @id @default(cuid())
  name        String  // 模板名称
  department  String  // 适用科室
  disease     String? // 适用疾病
  template    String  @db.Text // 模板内容
  description String? // 模板描述

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([department])
  @@index([disease])
  @@index([department, disease])
}
```

#### 字段说明

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | String | PK, CUID | 唯一标识符 |
| `name` | String | Required | 模板名称 |
| `department` | String | Required | 适用科室 |
| `disease` | String | Nullable | 适用疾病 |
| `template` | String | Text | 模板内容（JSON） |
| `description` | String | Nullable | 模板描述 |
| `createdAt` | DateTime | Auto | 创建时间 |
| `updatedAt` | DateTime | Auto | 更新时间 |

---

### 3. GenerationJob（生成任务）

存储 AI 病历生成任务的状态和结果。

```prisma
model GenerationJob {
  id          String    @id @default(cuid())
  status      String    // pending, processing, completed, failed
  params      Json      // 生成参数
  result      String?   @db.Text // 生成结果
  error       String?   // 错误信息
  createdAt   DateTime  @default(now())
  completedAt DateTime? // 完成时间

  @@index([status])
  @@index([createdAt])
  @@index([completedAt])
  @@index([status, createdAt])
}
```

#### 字段说明

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | String | PK, CUID | 唯一标识符 |
| `status` | String | Required | 任务状态 |
| `params` | Json | Required | 生成参数 |
| `result` | String | Nullable, Text | 生成结果 |
| `error` | String | Nullable | 错误信息 |
| `createdAt` | DateTime | Auto | 创建时间 |
| `completedAt` | DateTime | Nullable | 完成时间 |

#### 任务状态

| 状态 | 说明 |
|------|------|
| `pending` | 等待执行 |
| `processing` | 执行中 |
| `completed` | 已完成 |
| `failed` | 失败 |

---

## Prisma 配置

### schema.prisma 完整配置

```prisma
// Case Hub Database Schema
// Medical case management and generation system

generator client {
  provider = "prisma-client-js"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============ Case (病历) ============
model Case {
  id          String   @id @default(cuid())
  caseNumber  String   @unique
  patientName String?
  gender      String?
  age         Int?
  department  String
  disease     String
  content     String   @db.Text
  caseType    String
  metadata    Json?
  status      String   @default("active")

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([caseNumber])
  @@index([department])
  @@index([disease])
  @@index([caseType])
  @@index([status])
  @@index([createdAt])
  @@index([department, disease])
}

// ============ CaseTemplate (病历模板) ============
model CaseTemplate {
  id          String  @id @default(cuid())
  name        String
  department  String
  disease     String?
  template    String  @db.Text
  description String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([department])
  @@index([disease])
  @@index([department, disease])
}

// ============ GenerationJob (生成任务) ============
model GenerationJob {
  id          String    @id @default(cuid())
  status      String
  params      Json
  result      String?   @db.Text
  error       String?
  createdAt   DateTime  @default(now())
  completedAt DateTime?

  @@index([status])
  @@index([createdAt])
  @@index([completedAt])
  @@index([status, createdAt])
}
```

---

## Prisma 使用指南

### 安装和初始化

```bash
# 安装 Prisma CLI
pnpm add -D prisma

# 初始化 Prisma
pnpm prisma init
```

### 常用命令

```bash
# 生成 Prisma 客户端
pnpm prisma:generate

# 创建数据库迁移
pnpm prisma:migrate

# 推送架构到数据库（开发环境）
pnpm prisma:push

# 打开 Prisma Studio（可视化数据库管理）
pnpm prisma:studio

# 拉取数据库架构
pnpm prisma db pull

# 执行种子脚本
pnpm db:seed
```

### 在代码中使用 Prisma

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 创建病历
const newCase = await prisma.case.create({
  data: {
    caseNumber: 'CASE202403170001',
    patientName: '张三',
    gender: '男',
    age: 45,
    department: '普外科',
    disease: '急性阑尾炎',
    content: JSON.stringify({
      chiefComplaint: '腹痛3天',
      presentIllness: '...',
    }),
    caseType: 'A型',
    status: 'active',
  },
});

// 查询病历列表
const cases = await prisma.case.findMany({
  where: {
    department: '普外科',
    status: { not: 'deleted' },
  },
  orderBy: { createdAt: 'desc' },
  skip: 0,
  take: 10,
});

// 更新病历
const updatedCase = await prisma.case.update({
  where: { id: 'case-id' },
  data: {
    patientName: '李四',
    updatedAt: new Date(),
  },
});

// 软删除病历
await prisma.case.update({
  where: { id: 'case-id' },
  data: {
    status: 'deleted',
    updatedAt: new Date(),
  },
});

// 统计科室病例数
const deptCounts = await prisma.case.groupBy({
  by: ['department'],
  _count: { id: true },
  where: { status: { not: 'deleted' } },
});
```

---

## 数据库连接配置

### 环境变量

```bash
# 数据库连接字符串
DATABASE_URL=postgresql://user:password@localhost:5432/case_hub?schema=public

# 连接池大小
DATABASE_POOL_SIZE=10

# 连接超时时间（毫秒）
DATABASE_TIMEOUT=30000
```

### 连接字符串格式

```
postgresql://[user[:password]@][host][:port][/database][?schema=public]
```

### 高级连接选项

```bash
# 带参数的连接字符串
DATABASE_URL="postgresql://user:password@localhost:5432/case_hub?schema=public&connection_limit=10&pool_timeout=30"
```

---

## 数据迁移策略

### 开发环境

```bash
# 直接推送架构变更（快速迭代）
pnpm prisma:push
```

### 生产环境

```bash
# 创建迁移文件
pnpm prisma migrate dev --name add_new_field

# 应用迁移
pnpm prisma migrate deploy
```

### 迁移最佳实践

1. **开发阶段**: 使用 `prisma db push` 快速迭代
2. **测试阶段**: 使用迁移文件确保一致性
3. **生产阶段**: 使用 `prisma migrate deploy` 安全应用迁移
4. **备份**: 生产环境迁移前务必备份数据库

---

## 种子数据

### seed.ts 示例

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 创建示例病历
  await prisma.case.createMany({
    data: [
      {
        caseNumber: 'CASE202403170001',
        patientName: '张三',
        gender: '男',
        age: 45,
        department: '普外科',
        disease: '急性阑尾炎',
        content: JSON.stringify({
          chiefComplaint: '转移性右下腹痛3天',
          presentIllness: '患者3天前无明显诱因出现上腹部疼痛...',
        }),
        caseType: 'A型',
        status: 'active',
      },
      {
        caseNumber: 'CASE202403170002',
        patientName: '李四',
        gender: '女',
        age: 32,
        department: '骨科',
        disease: '骨折',
        content: JSON.stringify({
          chiefComplaint: '右下肢外伤后疼痛2小时',
          presentIllness: '患者2小时前不慎摔倒...',
        }),
        caseType: 'B型',
        status: 'active',
      },
    ],
    skipDuplicates: true,
  });

  console.log('Seed data created successfully');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

---

## 性能优化

### 索引优化

```prisma
// 复合索引优化组合查询
@@index([department, disease])
@@index([status, createdAt])
```

### 查询优化

```typescript
// 使用 select 减少数据传输
const cases = await prisma.case.findMany({
  select: {
    id: true,
    caseNumber: true,
    patientName: true,
    department: true,
    disease: true,
    createdAt: true,
  },
  where: { status: 'active' },
});

// 使用 include 关联查询（如有关系）
const caseWithDetails = await prisma.case.findUnique({
  where: { id: 'case-id' },
  include: {
    // 关联表
  },
});
```

### 批量操作

```typescript
// 批量创建
await prisma.case.createMany({
  data: casesData,
  skipDuplicates: true,
});

// 批量更新（使用事务）
await prisma.$transaction([
  prisma.case.update({ where: { id: '1' }, data: { status: 'archived' } }),
  prisma.case.update({ where: { id: '2' }, data: { status: 'archived' } }),
]);
```

---

## 备份与恢复

### 使用 pg_dump 备份

```bash
# 备份整个数据库
pg_dump -h localhost -p 5432 -U user -d case_hub > case_hub_backup.sql

# 备份特定表
pg_dump -h localhost -p 5432 -U user -d case_hub --table=Case > cases_backup.sql
```

### 使用 psql 恢复

```bash
# 恢复数据库
psql -h localhost -p 5432 -U user -d case_hub < case_hub_backup.sql
```

---

## 常见问题

### 1. 连接超时

```bash
# 增加连接超时时间
DATABASE_URL="postgresql://...?connect_timeout=30"
```

### 2. 连接池耗尽

```bash
# 增加连接池大小
DATABASE_URL="postgresql://...?connection_limit=20"
```

### 3. 迁移失败

```bash
# 重置迁移状态（开发环境）
pnpm prisma migrate reset

# 解决冲突后重新应用
pnpm prisma migrate resolve --applied migration_name
```

---

## 相关文档

- [Prisma 官方文档](https://www.prisma.io/docs)
- [PostgreSQL 官方文档](https://www.postgresql.org/docs/)
- [Prisma Client API 参考](https://www.prisma.io/docs/reference/api-reference/prisma-client-reference)
