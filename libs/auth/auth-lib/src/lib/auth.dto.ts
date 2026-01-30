// libs/auth/auth-lib/src/lib/dto/user-management.dto.ts
import { z } from 'zod';
import {
  LoginSchema,
  RegisterSchema,
  AuthResponseSchema,
  UserQuerySchema,
  UpdateUserSchema,
  UpdatePasswordSchema,
  UpdateUserRoleSchema,
  EmailVerificationSchema,
  PhoneVerificationSchema,
  PasswordResetRequestSchema,
  PasswordResetConfirmSchema,
  UserSessionQuerySchema,
  BulkOperationSchema,
  UserResponseSchema,
  UserDetailResponseSchema,
  PaginatedResponseSchema,
  UserStatsResponseSchema,
  SessionResponseSchema,
  LoginLogResponseSchema,
  VerificationResponseSchema,
  PasswordResetResponseSchema,
  BulkOperationResponseSchema,
  UserActivityResponseSchema,
  ApiResponseSchema,
} from './auth.schema';

// Re-export schemas for backward compatibility
export {
  LoginSchema,
  RegisterSchema,
  AuthResponseSchema,
  UserQuerySchema,
  UpdateUserSchema,
  UpdatePasswordSchema,
  UpdateUserRoleSchema,
  EmailVerificationSchema,
  PhoneVerificationSchema,
  PasswordResetRequestSchema,
  PasswordResetConfirmSchema,
  UserSessionQuerySchema,
  BulkOperationSchema,
  UserResponseSchema,
  UserDetailResponseSchema,
  PaginatedResponseSchema,
  UserStatsResponseSchema,
  SessionResponseSchema,
  LoginLogResponseSchema,
  VerificationResponseSchema,
  PasswordResetResponseSchema,
  BulkOperationResponseSchema,
  UserActivityResponseSchema,
  ApiResponseSchema,
};

// 导出类型
export type UserQueryDto = z.infer<typeof UserQuerySchema>;
export type UpdateUserDto = z.infer<typeof UpdateUserSchema>;
export type UpdatePasswordDto = z.infer<typeof UpdatePasswordSchema>;
export type UpdateUserRoleDto = z.infer<typeof UpdateUserRoleSchema>;
export type EmailVerificationDto = z.infer<typeof EmailVerificationSchema>;
export type PhoneVerificationDto = z.infer<typeof PhoneVerificationSchema>;
export type PasswordResetRequestDto = z.infer<
  typeof PasswordResetRequestSchema
>;
export type PasswordResetConfirmDto = z.infer<
  typeof PasswordResetConfirmSchema
>;
export type UserSessionQueryDto = z.infer<typeof UserSessionQuerySchema>;
export type BulkOperationDto = z.infer<typeof BulkOperationSchema>;

// 响应类型导出
export type UserResponse = z.infer<typeof UserResponseSchema>;
export type UserDetailResponse = z.infer<typeof UserDetailResponseSchema>;
export type PaginatedResponse<T> = z.infer<typeof PaginatedResponseSchema> & {
  data: T[];
};
export type UserStatsResponse = z.infer<typeof UserStatsResponseSchema>;
export type SessionResponse = z.infer<typeof SessionResponseSchema>;
export type LoginLogResponse = z.infer<typeof LoginLogResponseSchema>;
export type VerificationResponse = z.infer<typeof VerificationResponseSchema>;
export type PasswordResetResponse = z.infer<typeof PasswordResetResponseSchema>;
export type BulkOperationResponse = z.infer<typeof BulkOperationResponseSchema>;
export type UserActivityResponse = z.infer<typeof UserActivityResponseSchema>;
export type ApiResponse = z.infer<typeof ApiResponseSchema>;
export type LoginDto = z.infer<typeof LoginSchema>;
export type RegisterDto = z.infer<typeof RegisterSchema>;
export type AuthResponse = z.infer<typeof AuthResponseSchema>;
