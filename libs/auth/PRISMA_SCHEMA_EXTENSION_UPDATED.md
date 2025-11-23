# 更新的Prisma模式扩展 - gRPC认证系统

本文档包含针对gRPC通信、增强密码安全性和中国用户优化的Prisma模式扩展。

## 主要变更

1. **移除firstName/lastName字段**，使用单一name字段支持中文姓名
2. **增强密码安全**，添加盐值和迭代次数字段
3. **添加手机号支持**，包括手机号验证表
4. **集成微信登录**，添加微信账户表
5. **优化索引**，提高查询性能

## 更新的模式定义

将以下模型添加到现有的 `libs/bibliography-db/src/prisma/schema.prisma` 文件中：

```prisma
// 用户模型 - 针对中国用户优化
model User {
  id                String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  email             String    @unique @db.VarChar(255)
  name              String?   @db.VarChar(100) // 单一姓名字段，支持中文
  avatar            String?   @db.VarChar(500)
  phone             String?   @unique @db.VarChar(20) // 手机号，支持+86格式
  passwordSalt      String?   @db.VarChar(64) // 密码盐值，客户端生成
  passwordHash      String?   @db.VarChar(128) // 密码哈希，客户端计算
  passwordIterations Int?      @default(100000) // PBKDF2迭代次数
  isEmailVerified   Boolean   @default(false)
  isPhoneVerified   Boolean   @default(false)
  isActive          Boolean   @default(true)
  lastLoginAt       DateTime? @db.Timestamptz(6)
  createdAt         DateTime  @default(now()) @db.Timestamptz(6)
  updatedAt         DateTime  @default(now()) @db.Timestamptz(6)
  
  // 关联关系
  refreshTokens     RefreshToken[]
  emailVerifications EmailVerification[]
  phoneVerifications PhoneVerification[]
  passwordResets    PasswordReset[]
  accounts          Account[]
  sessions          Session[]
  wechatAccounts    WechatAccount[]
  
  @@index([email])
  @@index([phone])
  @@index([isActive])
  @@index([isEmailVerified])
  @@index([isPhoneVerified])
  @@map("users")
}

// 刷新令牌模型 - gRPC优化
model RefreshToken {
  id          String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  token       String   @unique @db.VarChar(500)
  userId      String   @db.Uuid
  expiresAt   DateTime @db.Timestamptz(6)
  createdAt   DateTime @default(now()) @db.Timestamptz(6)
  isRevoked   Boolean  @default(false)
  clientInfo  Json?     // 客户端信息（IP、User-Agent等）
  
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@index([userId])
  @@index([token])
  @@index([expiresAt])
  @@index([isRevoked])
  @@map("refresh_tokens")
}

// 邮箱验证模型
model EmailVerification {
  id        String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  email     String   @db.VarChar(255)
  token     String   @unique @db.VarChar(255)
  expiresAt DateTime @db.Timestamptz(6)
  createdAt DateTime @default(now()) @db.Timestamptz(6)
  userId    String   @db.Uuid
  
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@index([email])
  @@index([token])
  @@index([expiresAt])
  @@map("email_verifications")
}

// 手机号验证模型 - 新增
model PhoneVerification {
  id        String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  phone     String   @db.VarChar(20)
  code      String   @db.VarChar(10) // 6位数字验证码
  type      String   @db.VarChar(20) @default("REGISTER") // REGISTER, LOGIN, RESET_PASSWORD
  attempts  Int      @default(0) // 验证尝试次数
  expiresAt DateTime @db.Timestamptz(6)
  createdAt DateTime @default(now()) @db.Timestamptz(6)
  userId    String?  @db.Uuid // 可选，用于已注册用户
  
  user      User?    @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@index([phone])
  @@index([code])
  @@index([expiresAt])
  @@index([type])
  @@map("phone_verifications")
}

// 密码重置模型 - 增强安全
model PasswordReset {
  id        String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  email     String   @db.VarChar(255)
  phone     String?  @db.VarChar(20) // 支持手机号重置
  token     String   @unique @db.VarChar(255)
  expiresAt DateTime @db.Timestamptz(6)
  createdAt DateTime @default(now()) @db.Timestamptz(6)
  userId    String   @db.Uuid
  isUsed    Boolean  @default(false) // 标记是否已使用
  
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@index([email])
  @@index([phone])
  @@index([token])
  @@index([expiresAt])
  @@index([isUsed])
  @@map("password_resets")
}

// OAuth账户信息模型
model Account {
  id                String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId            String   @db.Uuid
  type              String   @db.VarChar(50) // "oauth", "email", "phone", "wechat"
  provider          String   @db.VarChar(50) // "google", "github", "wechat"
  providerAccountId String   @db.VarChar(255)
  refresh_token     String?  @db.Text
  access_token      String?  @db.Text
  expires_at        Int?
  token_type        String?  @db.VarChar(50)
  scope             String?  @db.Text
  id_token          String?  @db.Text
  session_state     String?  @db.Text
  createdAt         DateTime @default(now()) @db.Timestamptz(6)
  updatedAt         DateTime @default(now()) @db.Timestamptz(6)
  
  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@unique([provider, providerAccountId])
  @@index([userId])
  @@index([provider])
  @@map("accounts")
}

// 会话管理模型 - gRPC优化
model Session {
  id           String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  sessionToken String   @unique @db.VarChar(255)
  userId       String   @db.Uuid
  expires      DateTime @db.Timestamptz(6)
  createdAt    DateTime @default(now()) @db.Timestamptz(6)
  lastActivity DateTime @default(now()) @db.Timestamptz(6)
  clientInfo   Json?     // 客户端信息
  isActive     Boolean   @default(true)
  
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@index([userId])
  @@index([sessionToken])
  @@index([expires])
  @@index([isActive])
  @@map("sessions")
}

// 微信账户模型 - 新增
model WechatAccount {
  id                String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId            String   @db.Uuid
  wechatOpenId      String   @unique @db.VarChar(100)
  wechatUnionId     String?  @db.VarChar(100) // 开放平台唯一标识
  nickname          String?  @db.VarChar(100) // 微信昵称
  avatar            String?  @db.VarChar(500) // 微信头像
  sex               Int?     // 性别：1男性，2女性，0未知
  province          String?  @db.VarChar(50) // 省份
  city              String?  @db.VarChar(50) // 城市
  country           String?  @db.VarChar(50) // 国家
  accessToken       String?  @db.Text // 访问令牌
  refreshToken      String?  @db.Text // 刷新令牌
  expiresAt         DateTime? @db.Timestamptz(6) // 令牌过期时间
  scope             String?  @db.Text // 授权范围
  createdAt         DateTime @default(now()) @db.Timestamptz(6)
  updatedAt         DateTime @default(now()) @db.Timestamptz(6)
  
  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@index([userId])
  @@index([wechatOpenId])
  @@index([wechatUnionId])
  @@map("wechat_accounts")
}

// 登录日志模型 - 新增，用于安全审计
model LoginLog {
  id          String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId      String?  @db.Uuid
  email       String?  @db.VarChar(255)
  phone       String?  @db.VarChar(20)
  loginType   String   @db.VarChar(20) // EMAIL, PHONE, OAUTH, WECHAT
  provider    String?  @db.VarChar(50) // OAuth提供商
  ip          String   @db.VarChar(45) // 支持IPv6
  userAgent   String?  @db.Text
  success     Boolean
  failureReason String? @db.VarChar(255) // 失败原因
  createdAt   DateTime @default(now()) @db.Timestamptz(6)
  
  @@index([userId])
  @@index([email])
  @@index([phone])
  @@index([loginType])
  @@index([success])
  @@index([createdAt])
  @@map("login_logs")
}

// 密码历史模型 - 新增，防止密码重复使用
model PasswordHistory {
  id          String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId      String   @db.Uuid
  passwordHash String   @db.VarChar(128)
  passwordSalt String   @db.VarChar(64)
  iterations  Int      @default(100000)
  createdAt   DateTime @default(now()) @db.Timestamptz(6)
  
  @@index([userId])
  @@index([createdAt])
  @@map("password_history")
}
```

## 数据库迁移步骤

1. **备份数据库**（重要！）
2. **添加新模型**到现有的schema.prisma文件
3. **生成并应用迁移**：
   ```bash
   cd libs/bibliography-db
   npx prisma migrate dev --name add_grpc_auth_models
   npx prisma generate
   ```

## 数据库索引优化

### 性能索引
- **用户查询优化**：email, phone, isActive的复合索引
- **令牌验证优化**：token, expiresAt的复合索引
- **OAuth查询优化**：provider, providerAccountId的复合索引
- **安全审计优化**：userId, createdAt的复合索引

### 安全索引
- **唯一性约束**：email, phone, wechatOpenId
- **外键索引**：所有userId字段
- **时间索引**：所有expiresAt, createdAt字段

## 中国用户特定优化

### 1. 姓名字段
```sql
-- 支持中文姓名的正则验证
ALTER TABLE users ADD CONSTRAINT chk_name_format 
CHECK (name ~ '^[\u4e00-\u9fa5a-zA-Z\s]+$' OR name IS NULL);
```

### 2. 手机号字段
```sql
-- 中国手机号格式验证
ALTER TABLE users ADD CONSTRAINT chk_phone_format 
CHECK (phone ~ '^1[3-9]\d{9}$' OR phone ~ '^\+861[3-9]\d{9}$' OR phone IS NULL);
```

### 3. 时区处理
```sql
-- 设置中国时区
SET timezone = 'Asia/Shanghai';
```

## 安全增强措施

### 1. 密码安全
- **客户端哈希**：密码在客户端进行PBKDF2哈希
- **动态盐值**：每个用户使用不同的盐值
- **迭代次数**：默认100,000次，可根据性能调整
- **密码历史**：记录最近12次密码，防止重复使用

### 2. 验证码安全
- **短信验证码**：6位数字，5分钟过期
- **邮箱验证码**：JWT令牌，24小时过期
- **频率限制**：同一手机号/邮箱1分钟内只能发送1次
- **尝试次数**：验证码最多尝试5次

### 3. 会话安全
- **会话令牌**：随机生成，定期轮换
- **客户端信息**：记录IP、User-Agent等信息
- **活跃检测**：记录最后活动时间
- **自动过期**：会话30分钟无活动自动过期

## 数据清理策略

### 定期清理任务
```sql
-- 清理过期的验证码
DELETE FROM phone_verifications WHERE expiresAt < NOW() - INTERVAL '1 day';

-- 清理过期的邮箱验证
DELETE FROM email_verifications WHERE expiresAt < NOW() - INTERVAL '7 days';

-- 清理过期的密码重置令牌
DELETE FROM password_resets WHERE expiresAt < NOW() - INTERVAL '7 days';

-- 清理过期的会话
DELETE FROM sessions WHERE expires < NOW() - INTERVAL '1 day';

-- 清理旧的登录日志（保留90天）
DELETE FROM login_logs WHERE createdAt < NOW() - INTERVAL '90 days';

-- 清理旧的密码历史（保留2年）
DELETE FROM password_history WHERE createdAt < NOW() - INTERVAL '2 years';
```

## gRPC特定优化

### 1. 二进制数据处理
- **令牌存储**：使用VARBINARY类型存储二进制令牌
- **头像存储**：支持二进制头像数据
- **加密数据**：敏感信息使用数据库加密

### 2. 性能优化
- **连接池**：配置适当的连接池大小
- **查询缓存**：使用Redis缓存频繁查询的数据
- **读写分离**：使用只读副本处理查询请求

### 3. 监控指标
- **查询性能**：监控慢查询
- **连接数**：监控数据库连接使用情况
- **缓存命中率**：监控Redis缓存效果
- **错误率**：监控数据库错误和超时

这个更新的模式设计提供了更强的安全性、更好的中国用户体验，以及针对gRPC通信的优化。