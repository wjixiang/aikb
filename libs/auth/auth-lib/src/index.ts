// Export services
export { AuthService } from './lib/auth.service';

// Export controllers
export { AuthController } from './lib/auth.controller';
export { UserController } from './lib/user.controller';
export { SessionController } from './lib/session.controller';
export { VerificationController } from './lib/verification.controller';
export { PasswordResetController } from './lib/password-reset.controller';
export { AdminController } from './lib/admin.controller';

// Export guards
export { JwtAuthGuard } from './lib/guards/jwt-auth.guard';
export { GqlJwtAuthGuard } from './lib/guards/gql-jwt-auth.guard';

// Export strategies
export { JwtStrategy } from './lib/strategies/jwt.strategy';

// Export decorators
export { CurrentUser } from './lib/current-user.decorator';
export { GqlCurrentUser } from './lib/graphql-user.decorator';
export type { CurrentUserData } from './lib/current-user.decorator';

// Export JWT types
export * from './lib/jwt.types';

// Export test helpers
export {
  TestAuthHelper,
  generateTestAccessToken,
  generateTestRefreshToken,
} from './lib/authTestHelper';

// Export DTOs
export * from './lib/auth.dto';

// Export schemas
export * from './lib/auth.schema';

// Export module
export * from './lib/auth-lib.module';
