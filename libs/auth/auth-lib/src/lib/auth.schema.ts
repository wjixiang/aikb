import { z } from 'zod';

// 认证相关的 Zod 模式
export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(128),
  name: z.string().min(1).max(100).optional(),
});

export const AuthResponseSchema = z.object({
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    name: z.string().optional(),
  }),
  accessToken: z.string(),
  refreshToken: z.string(),
});

export const JwtPayloadSchema = z.object({
  sub: z.string(),
  email: z.string(),
  iat: z.number().optional(),
  exp: z.number().optional(),
});

// 用户查询参数
export const UserQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
  search: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
  isEmailVerified: z.coerce.boolean().optional(),
  isPhoneVerified: z.coerce.boolean().optional(),
  sortBy: z.enum(['id', 'email', 'name', 'createdAt', 'lastLoginAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// 用户更新DTO
export const UpdateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  avatar: z.string().url().optional(),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/).optional(),
  isActive: z.boolean().optional(),
});

// 密码更新DTO
export const UpdatePasswordSchema = z.object({
  currentPassword: z.string().min(6),
  newPassword: z.string().min(6).max(128),
});

// 用户角色更新DTO
export const UpdateUserRoleSchema = z.object({
  roles: z.array(z.string()).optional(),
  permissions: z.array(z.string()).optional(),
});

// 邮箱验证DTO
export const EmailVerificationSchema = z.object({
  email: z.string().email(),
});

// 手机号验证DTO
export const PhoneVerificationSchema = z.object({
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/),
  code: z.string().regex(/^\d{6}$/),
});

// 密码重置请求DTO
export const PasswordResetRequestSchema = z.object({
  email: z.string().email(),
});

// 密码重置确认DTO
export const PasswordResetConfirmSchema = z.object({
  token: z.string(),
  newPassword: z.string().min(6).max(128),
});

// 用户会话查询DTO
export const UserSessionQuerySchema = z.object({
  userId: z.string().uuid(),
  isActive: z.coerce.boolean().optional(),
});

// 批量操作DTO
export const BulkOperationSchema = z.object({
  userIds: z.array(z.string().uuid()),
  action: z.enum(['activate', 'deactivate', 'delete']),
});

// 响应相关的 Zod 模式

// 基础用户响应
export const UserResponseSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().optional(),
  avatar: z.string().url().optional(),
  phone: z.string().optional(),
  isEmailVerified: z.boolean(),
  isPhoneVerified: z.boolean(),
  isActive: z.boolean(),
  lastLoginAt: z.date().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// 用户详情响应
export const UserDetailResponseSchema = UserResponseSchema.extend({
  refreshTokens: z.array(z.any()).optional(), // 实际项目中应该定义具体的类型
  sessions: z.array(z.any()).optional(),
  loginLogs: z.array(z.any()).optional(),
  wechatAccounts: z.array(z.any()).optional(),
  accounts: z.array(z.any()).optional(),
});

// 分页响应
export const PaginatedResponseSchema = z.object({
  data: z.array(z.any()),
  pagination: z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    totalPages: z.number(),
    hasNext: z.boolean(),
    hasPrev: z.boolean(),
  }),
});

// 用户统计响应
export const UserStatsResponseSchema = z.object({
  totalUsers: z.number(),
  activeUsers: z.number(),
  verifiedEmailUsers: z.number(),
  verifiedPhoneUsers: z.number(),
  newUsersThisMonth: z.number(),
  newUsersThisWeek: z.number(),
  loginStats: z.object({
    totalLogins: z.number(),
    successfulLogins: z.number(),
    failedLogins: z.number(),
    todayLogins: z.number(),
  }),
});

// 会话响应
export const SessionResponseSchema = z.object({
  id: z.string().uuid(),
  sessionToken: z.string(),
  userId: z.string().uuid(),
  expires: z.date(),
  createdAt: z.date(),
  lastActivity: z.date(),
  clientInfo: z.any().optional(),
  isActive: z.boolean(),
});

// 登录日志响应
export const LoginLogResponseSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  success: z.boolean(),
  loginType: z.string(),
  failureReason: z.string().optional(),
  ip: z.string(),
  userAgent: z.string().optional(),
  createdAt: z.date(),
});

// 验证响应
export const VerificationResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  token: z.string().optional(),
  expiresAt: z.date().optional(),
});

// 密码重置响应
export const PasswordResetResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  token: z.string().optional(),
  expiresAt: z.date().optional(),
});

// 批量操作响应
export const BulkOperationResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  processedCount: z.number(),
  failedCount: z.number(),
  errors: z.array(z.string()).optional(),
});

// 用户活动响应
export const UserActivityResponseSchema = z.object({
  userId: z.string().uuid(),
  activities: z.array(z.object({
    type: z.string(),
    description: z.string(),
    timestamp: z.date(),
    ip: z.string(),
    userAgent: z.string().optional(),
  })),
});

// 通用API响应
export const ApiResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  timestamp: z.date(),
});