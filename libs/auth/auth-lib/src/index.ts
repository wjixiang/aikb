// // Export services
// export { AuthService } from './lib/auth.service';

// // Export controllers
// export { AuthController } from './lib/auth.controller';
// export { UserController } from './lib/user.controller';
// export { SessionController } from './lib/session.controller';
// export { VerificationController } from './lib/verification.controller';
// export { PasswordResetController } from './lib/password-reset.controller';
// export { AdminController } from './lib/admin.controller';

// Export oRPC controllers
// export { ORPCAuthController } from './lib/orpc/orpc-auth.controller';
// export { ORPCUserController } from './lib/orpc/orpc-user.controller';
// export { ORPCSessionController } from './lib/orpc/orpc-session.controller';
// export { ORPCVerificationController } from './lib/orpc/orpc-verification.controller';
// export { ORPCPasswordResetController } from './lib/orpc/orpc-password-reset.controller';
// export { ORPCAdminController } from './lib/orpc/orpc-admin.controller';

// Export oRPC contract
export { authContract, type AuthContract } from './lib/orpc/orpc.contract';
export { orpc_client } from './lib/orpc/orpc.client';

// Export guards
export { JwtAuthGuard } from './lib/guards/jwt-auth.guard';

// Export strategies
export { JwtStrategy } from './lib/strategies/jwt.strategy';

// Export DTOs
export * from './lib/auth.dto';

// Export schemas
export * from './lib/auth.schema';

// Export module
export * from './lib/auth-lib.module';
