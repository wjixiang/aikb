import { populateContractRouterPaths } from '@orpc/nest';
import { oc } from '@orpc/contract';
import { z } from 'zod';
import {
  LoginSchema,
  RegisterSchema,
  AuthResponseSchema,
  UserQuerySchema,
  UpdateUserSchema,
  UpdatePasswordSchema,
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
  VerificationResponseSchema,
  PasswordResetResponseSchema,
  BulkOperationResponseSchema,
  UserActivityResponseSchema,
  ApiResponseSchema,
} from '../auth.schema';

// Authentication contracts
export const registerContract = oc
  .route({
    method: 'POST',
    path: '/auth/register',
  })
  .input(RegisterSchema)
  .output(AuthResponseSchema);

export const loginContract = oc
  .route({
    method: 'POST',
    path: '/auth/login',
  })
  .input(LoginSchema)
  .output(AuthResponseSchema);

export const refreshContract = oc
  .route({
    method: 'POST',
    path: '/auth/refresh',
  })
  .input(z.object({ refreshToken: z.string() }))
  .output(AuthResponseSchema);

export const logoutContract = oc
  .route({
    method: 'POST',
    path: '/auth/logout',
  })
  .input(z.object({ refreshToken: z.string() }))
  .output(ApiResponseSchema);

export const validateContract = oc
  .route({
    method: 'GET',
    path: '/auth/validate',
  })
  .input(z.object({}))
  .output(UserResponseSchema);

// User management contracts
export const listUsersContract = oc
  .route({
    method: 'GET',
    path: '/users',
  })
  .input(UserQuerySchema)
  .output(
    PaginatedResponseSchema.extend({
      data: z.array(UserResponseSchema),
    }),
  );

export const findUserContract = oc
  .route({
    method: 'GET',
    path: '/users/{id}',
  })
  .input(z.object({ id: z.string().uuid() }))
  .output(UserDetailResponseSchema);

export const updateUserContract = oc
  .route({
    method: 'PUT',
    path: '/users/{id}',
  })
  .input(
    z.object({
      id: z.string().uuid(),
      data: UpdateUserSchema,
    }),
  )
  .output(UserResponseSchema);

export const updateUserPasswordContract = oc
  .route({
    method: 'POST',
    path: '/users/{id}/password',
  })
  .input(
    z.object({
      id: z.string().uuid(),
      data: UpdatePasswordSchema,
    }),
  )
  .output(ApiResponseSchema);

export const deleteUserContract = oc
  .route({
    method: 'DELETE',
    path: '/users/{id}',
  })
  .input(z.object({ id: z.string().uuid() }))
  .output(ApiResponseSchema);

export const getUserActivityContract = oc
  .route({
    method: 'GET',
    path: '/users/{id}/activity',
  })
  .input(z.object({ id: z.string().uuid() }))
  .output(UserActivityResponseSchema);

// Session management contracts
export const listSessionsContract = oc
  .route({
    method: 'GET',
    path: '/sessions',
  })
  .input(UserSessionQuerySchema)
  .output(z.array(SessionResponseSchema));

export const revokeSessionContract = oc
  .route({
    method: 'DELETE',
    path: '/sessions/{sessionId}',
  })
  .input(z.object({ sessionId: z.string().uuid() }))
  .output(ApiResponseSchema);

export const revokeAllUserSessionsContract = oc
  .route({
    method: 'DELETE',
    path: '/sessions/user/{userId}',
  })
  .input(z.object({ userId: z.string().uuid() }))
  .output(ApiResponseSchema);

// Verification contracts
export const sendEmailVerificationContract = oc
  .route({
    method: 'POST',
    path: '/verification/email/send',
  })
  .input(EmailVerificationSchema)
  .output(VerificationResponseSchema);

export const verifyEmailContract = oc
  .route({
    method: 'GET',
    path: '/verification/email/verify/{token}',
  })
  .input(z.object({ token: z.string() }))
  .output(VerificationResponseSchema);

export const verifyPhoneContract = oc
  .route({
    method: 'POST',
    path: '/verification/phone/verify',
  })
  .input(PhoneVerificationSchema)
  .output(VerificationResponseSchema);

// Password reset contracts
export const requestPasswordResetContract = oc
  .route({
    method: 'POST',
    path: '/password-reset/request',
  })
  .input(PasswordResetRequestSchema)
  .output(PasswordResetResponseSchema);

export const confirmPasswordResetContract = oc
  .route({
    method: 'POST',
    path: '/password-reset/confirm',
  })
  .input(PasswordResetConfirmSchema)
  .output(PasswordResetResponseSchema);

// Admin contracts
export const getUserStatsContract = oc
  .route({
    method: 'GET',
    path: '/admin/stats',
  })
  .input(z.object({}))
  .output(UserStatsResponseSchema);

export const bulkOperationContract = oc
  .route({
    method: 'POST',
    path: '/admin/bulk-operation',
  })
  .input(BulkOperationSchema)
  .output(BulkOperationResponseSchema);

// Create the main contract
export const authContract = populateContractRouterPaths({
  auth: {
    register: registerContract,
    login: loginContract,
    refresh: refreshContract,
    logout: logoutContract,
    validate: validateContract,
  },
  users: {
    list: listUsersContract,
    find: findUserContract,
    update: updateUserContract,
    updatePassword: updateUserPasswordContract,
    delete: deleteUserContract,
    getActivity: getUserActivityContract,
  },
  sessions: {
    list: listSessionsContract,
    revoke: revokeSessionContract,
    revokeAllForUser: revokeAllUserSessionsContract,
  },
  verification: {
    sendEmail: sendEmailVerificationContract,
    verifyEmail: verifyEmailContract,
    verifyPhone: verifyPhoneContract,
  },
  passwordReset: {
    request: requestPasswordResetContract,
    confirm: confirmPasswordResetContract,
  },
  admin: {
    getStats: getUserStatsContract,
    bulkOperation: bulkOperationContract,
  },
});

export type AuthContract = typeof authContract;
