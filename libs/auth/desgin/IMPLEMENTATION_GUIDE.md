# Authentication System Implementation Guide

## Prerequisites

Before implementing the authentication system, ensure you have:
- Node.js 18+ installed
- PostgreSQL database running
- Existing NestJS monorepo setup with Nx
- Basic understanding of JWT and OAuth concepts

## Step 1: Install Dependencies

Add the required dependencies to your project:

```bash
# Core authentication dependencies
pnpm add @nestjs/passport @nestjs/jwt passport passport-jwt passport-local bcrypt

# OAuth providers
pnpm add passport-google-oauth20 passport-github2

# Email service
pnpm add nodemailer handlebars

# Security and validation
pnpm add express-rate-limit helmet class-validator class-transformer

# Development dependencies
pnpm add -D @types/passport-jwt @types/passport-local @types/bcrypt @types/nodemailer
```

## Step 2: Extend Prisma Schema

1. **Backup your database** first
2. **Add authentication models** to `libs/bibliography-db/src/prisma/schema.prisma` using the schema from `PRISMA_SCHEMA_EXTENSION.md`
3. **Generate and apply migration**:
   ```bash
   cd libs/bibliography-db
   npx prisma migrate dev --name add_auth_models
   npx prisma generate
   ```

## Step 3: Create Auth Library Structure

Create the following directory structure in `libs/auth/`:

```
libs/auth/
├── src/
│   ├── controllers/
│   ├── services/
│   ├── strategies/
│   ├── guards/
│   ├── decorators/
│   ├── dto/
│   ├── entities/
│   ├── interfaces/
│   ├── config/
│   ├── auth.module.ts
│   └── index.ts
├── project.json
├── tsconfig.json
├── tsconfig.lib.json
├── tsconfig.spec.json
├── vite.config.ts
├── eslint.config.mjs
└── README.md
```

## Step 4: Configure Environment Variables

Add these to your `.env` file:

```bash
# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
JWT_REFRESH_SECRET=your-super-secret-refresh-key-min-32-chars
JWT_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d

# OAuth Configuration
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback

GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
GITHUB_CALLBACK_URL=http://localhost:3000/api/auth/github/callback

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
FROM_EMAIL=noreply@yourapp.com
FROM_NAME=Your App Name

# Application Configuration
APP_URL=http://localhost:3000
API_URL=http://localhost:3000/api
FRONTEND_URL=http://localhost:4200
```

## Step 5: Create Core Interfaces

Create `libs/auth/src/interfaces/auth.interface.ts`:

```typescript
export interface JwtPayload {
  sub: string; // userId
  email: string;
  iat?: number;
  exp?: number;
}

export interface JwtRefreshPayload {
  sub: string; // userId
  tokenId: string; // refresh token ID
  iat?: number;
  exp?: number;
}

export interface AuthResponse {
  user: UserResponse;
  tokens: TokenResponse;
}

export interface UserResponse {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  isEmailVerified: boolean;
  createdAt: Date;
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

export interface OAuthUser {
  provider: string;
  providerId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
}
```

## Step 6: Create DTOs

Create `libs/auth/src/dto/auth.dto.ts`:

```typescript
import { IsEmail, IsString, MinLength, MaxLength, Matches, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'SecurePass123!', minLength: 8, maxLength: 32 })
  @IsString()
  @MinLength(8)
  @MaxLength(32)
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message: 'Password must contain uppercase, lowercase, number and special character',
  })
  password: string;

  @ApiProperty({ example: 'John', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @ApiProperty({ example: 'Doe', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;
}

export class LoginDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'SecurePass123!' })
  @IsString()
  password: string;
}

export class RefreshTokenDto {
  @ApiProperty()
  @IsString()
  refreshToken: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty()
  @IsString()
  token: string;

  @ApiProperty({ example: 'NewSecurePass123!', minLength: 8, maxLength: 32 })
  @IsString()
  @MinLength(8)
  @MaxLength(32)
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message: 'Password must contain uppercase, lowercase, number and special character',
  })
  password: string;
}

export class ChangePasswordDto {
  @ApiProperty({ example: 'CurrentPass123!' })
  @IsString()
  currentPassword: string;

  @ApiProperty({ example: 'NewSecurePass123!', minLength: 8, maxLength: 32 })
  @IsString()
  @MinLength(8)
  @MaxLength(32)
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message: 'Password must contain uppercase, lowercase, number and special character',
  })
  newPassword: string;
}

export class VerifyEmailDto {
  @ApiProperty()
  @IsString()
  token: string;
}

export class ResendVerificationDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;
}

export class UpdateProfileDto {
  @ApiProperty({ example: 'Jane', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @ApiProperty({ example: 'Smith', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @ApiProperty({ example: 'https://example.com/avatar.jpg', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  avatar?: string;
}
```

## Step 7: Create Auth Service

Create `libs/auth/src/services/auth.service.ts`:

```typescript
import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from 'bibliography-db';
import { UserService } from './user.service';
import { TokenService } from './token.service';
import { EmailService } from './email.service';
import { RegisterDto, LoginDto, AuthResponse } from '../dto/auth.dto';
import { JwtPayload, JwtRefreshPayload } from '../interfaces/auth.interface';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private userService: UserService,
    private tokenService: TokenService,
    private emailService: EmailService,
  ) {}

  async register(registerDto: RegisterDto): Promise<AuthResponse> {
    const { email, password, firstName, lastName } = registerDto;

    // Check if user already exists
    const existingUser = await this.userService.findByEmail(email);
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
      },
    });

    // Generate email verification token
    const verificationToken = await this.tokenService.generateEmailVerificationToken(user.id, email);

    // Send verification email
    await this.emailService.sendVerificationEmail(email, verificationToken);

    // Generate tokens
    const tokens = await this.tokenService.generateTokens(user.id, user.email);

    return {
      user: this.userService.buildUserResponse(user),
      tokens,
    };
  }

  async login(loginDto: LoginDto): Promise<AuthResponse> {
    const { email, password } = loginDto;

    // Find user
    const user = await this.userService.findByEmail(email);
    if (!user || !user.password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if user is active
    if (!user.isActive) {
      throw new UnauthorizedException('Account is disabled');
    }

    // Validate password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if email is verified
    if (!user.isEmailVerified) {
      throw new UnauthorizedException('Please verify your email before logging in');
    }

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Generate tokens
    const tokens = await this.tokenService.generateTokens(user.id, user.email);

    return {
      user: this.userService.buildUserResponse(user),
      tokens,
    };
  }

  async refreshTokens(refreshToken: string): Promise<{ tokens: any }> {
    try {
      // Verify refresh token
      const payload = this.jwtService.verify<JwtRefreshPayload>(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });

      // Check if refresh token exists and is valid
      const storedToken = await this.tokenService.findRefreshToken(payload.tokenId);
      if (!storedToken || storedToken.isRevoked || storedToken.expiresAt < new Date()) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Generate new tokens
      const tokens = await this.tokenService.generateTokens(payload.sub, payload.email);

      // Revoke old refresh token
      await this.tokenService.revokeRefreshToken(storedToken.id);

      return { tokens };
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(refreshToken: string): Promise<void> {
    try {
      const payload = this.jwtService.verify<JwtRefreshPayload>(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });

      await this.tokenService.revokeRefreshTokenByTokenId(payload.tokenId);
    } catch (error) {
      // Ignore errors during logout
    }
  }

  async verifyEmail(token: string): Promise<void> {
    const verification = await this.tokenService.findEmailVerificationToken(token);
    if (!verification || verification.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    // Update user email verification status
    await this.prisma.user.update({
      where: { id: verification.userId },
      data: { isEmailVerified: true },
    });

    // Delete verification token
    await this.prisma.emailVerification.delete({
      where: { id: verification.id },
    });
  }

  async resendVerificationEmail(email: string): Promise<void> {
    const user = await this.userService.findByEmail(email);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.isEmailVerified) {
      throw new BadRequestException('Email already verified');
    }

    // Delete existing verification tokens
    await this.prisma.emailVerification.deleteMany({
      where: { userId: user.id },
    });

    // Generate new verification token
    const verificationToken = await this.tokenService.generateEmailVerificationToken(user.id, email);

    // Send verification email
    await this.emailService.sendVerificationEmail(email, verificationToken);
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.userService.findByEmail(email);
    if (!user) {
      // Don't reveal if user exists
      return;
    }

    // Delete existing password reset tokens
    await this.prisma.passwordReset.deleteMany({
      where: { userId: user.id },
    });

    // Generate password reset token
    const resetToken = await this.tokenService.generatePasswordResetToken(user.id, email);

    // Send password reset email
    await this.emailService.sendPasswordResetEmail(email, resetToken);
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const reset = await this.tokenService.findPasswordResetToken(token);
    if (!reset || reset.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update user password
    await this.prisma.user.update({
      where: { id: reset.userId },
      data: { password: hashedPassword },
    });

    // Delete reset token
    await this.prisma.passwordReset.delete({
      where: { id: reset.id },
    });

    // Revoke all refresh tokens for security
    await this.tokenService.revokeAllUserRefreshTokens(reset.userId);
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.userService.findById(userId);
    if (!user || !user.password) {
      throw new BadRequestException('User not found');
    }

    // Validate current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update user password
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    // Revoke all refresh tokens for security
    await this.tokenService.revokeAllUserRefreshTokens(userId);
  }
}
```

## Step 8: Create JWT Strategies

Create `libs/auth/src/strategies/jwt.strategy.ts`:

```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from 'bibliography-db';
import { JwtPayload } from '../interfaces/auth.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException();
    }

    return {
      userId: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    };
  }
}
```

## Step 9: Create Guards

Create `libs/auth/src/guards/jwt-auth.guard.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
```

## Step 10: Create Decorators

Create `libs/auth/src/decorators/current-user.decorator.ts`:

```typescript
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return request.user;
  },
);
```

Create `libs/auth/src/decorators/public.decorator.ts`:

```typescript
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

## Step 11: Create Auth Module

Create `libs/auth/src/auth.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaModule } from 'bibliography-db';
import { AuthController } from './controllers/auth.controller';
import { OAuthController } from './controllers/oauth.controller';
import { AuthService } from './services/auth.service';
import { UserService } from './services/user.service';
import { TokenService } from './services/token.service';
import { EmailService } from './services/email.service';
import { OAuthService } from './services/oauth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { GitHubStrategy } from './strategies/github.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRATION', '15m'),
        },
      }),
      inject: [ConfigService],
    }),
    ConfigModule,
    PrismaModule,
  ],
  controllers: [AuthController, OAuthController],
  providers: [
    AuthService,
    UserService,
    TokenService,
    EmailService,
    OAuthService,
    JwtStrategy,
    JwtRefreshStrategy,
    GoogleStrategy,
    GitHubStrategy,
  ],
  exports: [AuthService, UserService],
})
export class AuthModule {}
```

## Step 12: Create Project Configuration

Create `libs/auth/project.json`:

```json
{
  "name": "auth",
  "$schema": "../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "libs/auth/src",
  "projectType": "library",
  "tags": [],
  "targets": {
    "build": {
      "executor": "@nx/js:tsc",
      "outputs": ["{options.outputPath}"],
      "options": {
        "outputPath": "dist/libs/auth",
        "main": "libs/auth/src/index.ts",
        "tsConfig": "libs/auth/tsconfig.lib.json",
        "assets": ["libs/auth/src/templates/*.hbs"]
      }
    },
    "test": {
      "executor": "@nx/vite:test",
      "outputs": ["{options.reportsDirectory}"],
      "options": {
        "reportsDirectory": "../../coverage/libs/auth",
        "passWithNoTests": true
      }
    },
    "lint": {
      "executor": "@nx/eslint:lint",
      "outputs": ["{options.outputFile}"],
      "options": {
        "lintFilePatterns": ["libs/auth/**/*.ts"]
      }
    }
  }
}
```

## Step 13: Testing Strategy

### Unit Tests
Create comprehensive unit tests for:
- AuthService methods
- TokenService methods
- UserService methods
- JWT validation logic

### Integration Tests
Test the complete authentication flow:
- User registration and login
- Email verification process
- Password reset functionality
- OAuth provider integration
- Token refresh mechanism

### E2E Tests
Test real-world scenarios:
- Complete user journey from registration to login
- OAuth authentication flows
- Error handling and edge cases
- Rate limiting behavior

## Step 14: Security Checklist

- [ ] Password hashing with bcrypt (minimum 10 salt rounds)
- [ ] JWT token expiration (15 minutes for access, 7 days for refresh)
- [ ] Rate limiting on all authentication endpoints
- [ ] Email verification required for login
- [ ] Secure password reset tokens with expiration
- [ ] Input validation and sanitization
- [ ] SQL injection prevention via Prisma
- [ ] XSS protection
- [ ] CSRF protection
- [ ] Secure headers with Helmet
- [ ] CORS configuration
- [ ] Environment variable validation
- [ ] Error message security (don't reveal user existence)
- [ ] Token revocation on password change
- [ ] Session management
- [ ] Audit logging for security events

## Step 15: Deployment Considerations

### Production Environment Variables
- Use strong, unique JWT secrets
- Configure proper OAuth callback URLs
- Set up production email service
- Enable HTTPS for all authentication endpoints
- Configure rate limiting based on your infrastructure

### Database Optimization
- Add database indexes for frequently queried fields
- Implement connection pooling
- Set up database backups
- Monitor query performance

### Monitoring and Logging
- Log authentication events (login, logout, failed attempts)
- Monitor for suspicious activity
- Set up alerts for security events
- Implement audit trails

This implementation guide provides a comprehensive foundation for building a secure authentication system. Remember to adapt it to your specific requirements and always follow security best practices.