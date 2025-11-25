# Auth Service

基于 tRPC 的认证和用户管理服务。

## 功能特性

- 🔐 **用户认证**: 注册、登录、令牌刷新、登出
- 👥 **用户管理**: CRUD 操作、批量操作、用户统计
- 🔒 **安全功能**: 密码重置、邮箱验证、会话管理
- 📊 **监控和日志**: 用户活动日志、登录记录
- 🚀 **高性能**: 基于 tRPC 和 NestJS 构建

## 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 配置环境变量

复制 `.env.example` 到 `.env` 并更新配置：

```bash
cp .env.example .env
```

### 3. 启动服务

```bash
# 开发模式
pnpm run start:dev

# 生产模式
pnpm build
pnpm start
```

## API 端点

### tRPC 端点
- **基础 URL**: `http://localhost:3001/trpc`
- **用户路由**: `/trpc/user.*`

### 健康检查
- **URL**: `http://localhost:3001/health`

### API 文档
- **URL**: `http://localhost:3001/docs`

## 主要 API 路由

### 认证相关
- `POST /trpc/user.register` - 用户注册
- `POST /trpc/user.login` - 用户登录
- `POST /trpc/user.refreshToken` - 刷新令牌
- `POST /trpc/user.logout` - 用户登出

### 用户管理
- `GET /trpc/user.getUsers` - 获取用户列表（支持分页和搜索）
- `GET /trpc/user.getUserById` - 根据ID获取用户详情
- `PUT /trpc/user.updateUser` - 更新用户信息
- `DELETE /trpc/user.deleteUser` - 删除用户
- `PUT /trpc/user.updatePassword` - 更新用户密码

### 安全功能
- `POST /trpc/user.sendEmailVerification` - 发送邮箱验证
- `POST /trpc/user.verifyEmail` - 验证邮箱
- `POST /trpc/user.requestPasswordReset` - 请求密码重置
- `POST /trpc/user.confirmPasswordReset` - 确认密码重置

### 会话管理
- `GET /trpc/user.getUserSessions` - 获取用户会话
- `DELETE /trpc/user.revokeSession` - 撤销单个会话
- `DELETE /trpc/user.revokeAllUserSessions` - 撤销所有会话

### 批量操作
- `POST /trpc/user.bulkOperation` - 批量操作用户

### 统计和监控
- `GET /trpc/user.getUserStats` - 获取用户统计信息
- `GET /trpc/user.getUserActivity` - 获取用户活动日志

## 使用示例

### 客户端集成

```typescript
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from './types';

const client = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: 'http://localhost:3001/trpc',
    }),
  ],
});

// 使用示例
const user = await client.user.login.query({
  email: 'user@example.com',
  password: 'password123'
});

const users = await client.user.getUsers.query({
  page: 1,
  limit: 10,
  search: 'john'
});
```

### 环境变量

| 变量名 | 描述 | 默认值 |
|---------|---------|---------|
| PORT | 服务端口 | 3001 |
| NODE_ENV | 运行环境 | development |
| JWT_SECRET | JWT 密钥 | - |
| JWT_REFRESH_SECRET | JWT 刷新密钥 | - |
| JWT_EXPIRATION | JWT 过期时间 | 15m |
| JWT_REFRESH_EXPIRATION | JWT 刷新过期时间 | 7d |
| CORS_ORIGIN | CORS 源 | * |

## 开发

### 项目结构

```
apps/auth-service/
├── src/
│   ├── main.ts              # 应用入口点
│   └── ...
├── package.json
├── tsconfig.json
├── tsconfig.app.json
├── webpack.config.js
├── .env.example
└── README.md
```

### 构建和部署

```bash
# 构建
pnpm build

# 启动生产服务
node dist/main.js
```

## 技术栈

- **框架**: NestJS
- **API**: tRPC
- **数据库**: PostgreSQL (通过 Prisma)
- **验证**: Zod
- **类型安全**: TypeScript
- **构建**: Webpack

## 贡献

欢迎提交 Issue 和 Pull Request！

## 许可证

MIT License