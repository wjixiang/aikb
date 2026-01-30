# NestJS Authentication Library

A comprehensive authentication library for NestJS applications built with Prisma, PostgreSQL, and JWT. Features include user registration, login, email verification, password reset, and OAuth integration with Google and GitHub.

## Features

### Core Authentication
- ✅ User registration with email and password
- ✅ User login with JWT tokens
- ✅ Email verification system
- ✅ Password reset functionality
- ✅ Refresh token mechanism
- ✅ Secure password hashing with bcrypt

### OAuth Integration
- ✅ Google OAuth 2.0 authentication
- ✅ GitHub OAuth authentication
- ✅ Account linking and merging
- ✅ OAuth profile synchronization

### Security Features
- ✅ JWT-based authentication
- ✅ Rate limiting on all endpoints
- ✅ Input validation and sanitization
- ✅ Secure token generation and validation
- ✅ Password strength requirements
- ✅ Account lockout protection
- ✅ CSRF protection
- ✅ Security headers with Helmet

### User Management
- ✅ User profile management
- ✅ Account deletion
- ✅ Session management
- ✅ Activity tracking

## Installation

```bash
# Install the auth library
pnpm add auth

# Install required dependencies
pnpm add @nestjs/passport @nestjs/jwt passport passport-jwt passport-local bcrypt
pnpm add passport-google-oauth20 passport-github2 nodemailer handlebars
pnpm add express-rate-limit helmet class-validator class-transformer

# Install development dependencies
pnpm add -D @types/passport-jwt @types/passport-local @types/bcrypt @types/nodemailer
```

## Quick Start

### 1. Extend Your Prisma Schema

Add the authentication models to your `schema.prisma` file (see `PRISMA_SCHEMA_EXTENSION.md` for details):

```prisma
model User {
  id                String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  email             String    @unique @db.VarChar(255)
  password          String?   @db.VarChar(255)
  firstName         String?   @db.VarChar(100)
  lastName          String?   @db.VarChar(100)
  avatar            String?   @db.VarChar(500)
  isEmailVerified   Boolean   @default(false)
  isActive          Boolean   @default(true)
  lastLoginAt       DateTime? @db.Timestamptz(6)
  createdAt         DateTime  @default(now()) @db.Timestamptz(6)
  updatedAt         DateTime  @default(now()) @db.Timestamptz(6)
  
  refreshTokens     RefreshToken[]
  emailVerifications EmailVerification[]
  passwordResets    PasswordReset[]
  accounts          Account[]
  sessions          Session[]
  
  @@map("users")
}

// Add other authentication models...
```

Run migration:
```bash
npx prisma migrate dev --name add_auth_models
npx prisma generate
```

### 2. Configure Environment Variables

Add to your `.env` file:

```bash
# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
JWT_REFRESH_SECRET=your-super-secret-refresh-key-min-32-chars
JWT_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d

# OAuth Configuration
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
FROM_EMAIL=noreply@yourapp.com
```

### 3. Import Auth Module

In your `AppModule`:

```typescript
import { AuthModule } from 'auth';

@Module({
  imports: [
    // ... other modules
    AuthModule,
  ],
})
export class AppModule {}
```

### 4. Use Authentication in Controllers

```typescript
import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser, Public } from 'auth';
import { RegisterDto, LoginDto } from 'auth';

@Controller('api')
export class AppController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('auth/register')
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Public()
  @Post('auth/login')
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('profile')
  getProfile(@CurrentUser() user) {
    return user;
  }
}
```

## API Endpoints

### Authentication Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/auth/register` | User registration | ❌ |
| POST | `/api/auth/login` | User login | ❌ |
| POST | `/api/auth/logout` | User logout | ✅ |
| POST | `/api/auth/refresh` | Refresh access token | ❌ |

### Email Verification

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/auth/verify-email` | Verify email with token | ❌ |
| POST | `/api/auth/resend-verification` | Resend verification email | ❌ |

### Password Management

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/auth/forgot-password` | Request password reset | ❌ |
| POST | `/api/auth/reset-password` | Reset password with token | ❌ |
| POST | `/api/auth/change-password` | Change password | ✅ |

### OAuth Authentication

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/auth/google` | Google OAuth login | ❌ |
| GET | `/api/auth/google/callback` | Google OAuth callback | ❌ |
| GET | `/api/auth/github` | GitHub OAuth login | ❌ |
| GET | `/api/auth/github/callback` | GitHub OAuth callback | ❌ |

### User Management

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/auth/me` | Get current user profile | ✅ |
| PATCH | `/api/auth/profile` | Update user profile | ✅ |
| DELETE | `/api/auth/account` | Delete user account | ✅ |

## Usage Examples

### User Registration

```typescript
const response = await fetch('/api/auth/register', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'SecurePass123!',
    firstName: 'John',
    lastName: 'Doe',
  }),
});

const data = await response.json();
console.log(data);
// {
//   "success": true,
//   "data": {
//     "user": { "id": "...", "email": "...", ... },
//     "tokens": { "accessToken": "...", "refreshToken": "...", "expiresIn": "15m" }
//   }
// }
```

### Protected Route Access

```typescript
const response = await fetch('/api/auth/me', {
  headers: {
    'Authorization': `Bearer ${accessToken}`,
  },
});

const data = await response.json();
console.log(data);
// {
//   "success": true,
//   "data": {
//     "user": { "id": "...", "email": "...", ... }
//   }
// }
```

### OAuth Authentication

```typescript
// Redirect user to OAuth provider
window.location.href = '/api/auth/google';

// After successful OAuth, user will be redirected back with tokens
// Handle the callback in your frontend application
```

## Decorators

### @CurrentUser()
Inject the current authenticated user into your controller methods:

```typescript
@UseGuards(AuthGuard('jwt'))
@Get('profile')
getProfile(@CurrentUser() user: UserResponse) {
  return user;
}
```

### @Public()
Mark endpoints as public (no authentication required):

```typescript
@Public()
@Post('auth/register')
async register(@Body() registerDto: RegisterDto) {
  // This endpoint doesn't require authentication
}
```

## Guards

### JwtAuthGuard
Protect routes that require JWT authentication:

```typescript
@UseGuards(JwtAuthGuard)
@Get('protected')
getProtectedData() {
  return { message: 'This is protected data' };
}
```

## Error Handling

The library provides comprehensive error handling with specific error codes:

```json
{
  "success": false,
  "error": {
    "code": "AUTH001",
    "message": "Invalid credentials",
    "details": {
      "field": "password",
      "reason": "Password is incorrect"
    }
  }
}
```

### Common Error Codes

| Code | Description |
|------|-------------|
| AUTH001 | Invalid credentials |
| AUTH002 | User not found |
| AUTH003 | Email not verified |
| AUTH004 | Account disabled |
| AUTH005 | Token expired |
| AUTH006 | Token invalid |
| AUTH007 | Rate limit exceeded |
| AUTH008 | OAuth provider error |

## Security Features

### Password Security
- Minimum 8 characters
- Must contain uppercase, lowercase, number, and special character
- Bcrypt hashing with 10 salt rounds
- Password history to prevent reuse

### JWT Security
- Short-lived access tokens (15 minutes)
- Refresh token rotation
- Secure token storage
- Token revocation on password change

### Rate Limiting
- Registration: 5 attempts per hour per IP
- Login: 10 attempts per hour per IP
- Password reset: 3 attempts per hour per email

### OAuth Security
- Secure OAuth flow implementation
- State parameter validation
- PKCE support for OAuth 2.0
- Secure token exchange

## Configuration

### JWT Configuration
```typescript
{
  secret: process.env.JWT_SECRET,
  signOptions: {
    expiresIn: process.env.JWT_EXPIRATION || '15m',
    algorithm: 'HS256'
  }
}
```

### Rate Limiting Configuration
```typescript
{
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP'
}
```

## Testing

Run the test suite:

```bash
# Unit tests
nx test auth

# E2E tests
nx test auth-e2e

# Test coverage
nx test auth --coverage
```

## Troubleshooting

### Common Issues

1. **JWT Token Expired**
   - Use the refresh token to get a new access token
   - Implement automatic token refresh in your frontend

2. **Email Not Sending**
   - Check SMTP configuration
   - Verify email credentials
   - Check email service limits

3. **OAuth Callback Errors**
   - Verify OAuth redirect URLs
   - Check OAuth app credentials
   - Ensure proper CORS configuration

4. **Database Connection Issues**
   - Verify database connection string
   - Check database permissions
   - Ensure migrations are applied

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new features
5. Run the test suite
6. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support and questions:
- Check the documentation
- Review the troubleshooting section
- Open an issue on GitHub
- Contact the maintainers

## Changelog

### v1.0.0
- Initial release
- Core authentication features
- OAuth integration
- Email verification
- Password reset
- Comprehensive security features