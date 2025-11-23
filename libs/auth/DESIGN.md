# NestJS Authentication System Design

## Architecture Overview

This authentication system is built using:
- **NestJS** - Framework for building scalable server-side applications
- **Prisma** - Database toolkit and ORM
- **PostgreSQL** - Primary database
- **JWT** - JSON Web Tokens for stateless authentication
- **Passport** - Authentication middleware for Node.js
- **bcrypt** - Password hashing

## Database Schema Design

### Core Authentication Models

```prisma
model User {
  id                String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  email             String    @unique @db.VarChar(255)
  password          String?   @db.VarChar(255) // Nullable for OAuth users
  firstName         String?   @db.VarChar(100)
  lastName          String?   @db.VarChar(100)
  avatar            String?   @db.VarChar(500)
  isEmailVerified   Boolean   @default(false)
  isActive          Boolean   @default(true)
  lastLoginAt       DateTime? @db.Timestamptz(6)
  createdAt         DateTime  @default(now()) @db.Timestamptz(6)
  updatedAt         DateTime  @default(now()) @db.Timestamptz(6)
  
  // Relations
  refreshTokens     RefreshToken[]
  emailVerifications EmailVerification[]
  passwordResets    PasswordReset[]
  accounts          Account[]
  sessions          Session[]
  
  @@map("users")
}

model RefreshToken {
  id          String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  token       String   @unique @db.VarChar(500)
  userId      String   @db.Uuid
  expiresAt   DateTime @db.Timestamptz(6)
  createdAt   DateTime @default(now()) @db.Timestamptz(6)
  isRevoked   Boolean  @default(false)
  
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@map("refresh_tokens")
}

model EmailVerification {
  id        String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  email     String   @db.VarChar(255)
  token     String   @unique @db.VarChar(255)
  expiresAt DateTime @db.Timestamptz(6)
  createdAt DateTime @default(now()) @db.Timestamptz(6)
  userId    String   @db.Uuid
  
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@map("email_verifications")
}

model PasswordReset {
  id        String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  email     String   @db.VarChar(255)
  token     String   @unique @db.VarChar(255)
  expiresAt DateTime @db.Timestamptz(6)
  createdAt DateTime @default(now()) @db.Timestamptz(6)
  userId    String   @db.Uuid
  
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@map("password_resets")
}

// OAuth Account model for third-party authentication
model Account {
  id                String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId            String   @db.Uuid
  type              String   @db.VarChar(50) // "oauth", "email", "credentials"
  provider          String   @db.VarChar(50) // "google", "github", "credentials"
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
  @@map("accounts")
}

model Session {
  id           String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  sessionToken String   @unique @db.VarChar(255)
  userId       String   @db.Uuid
  expires      DateTime @db.Timestamptz(6)
  createdAt    DateTime @default(now()) @db.Timestamptz(6)
  
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@map("sessions")
}
```

## API Endpoints Design

### Authentication Endpoints

#### Registration & Login
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `POST /api/auth/refresh` - Refresh access token

#### Email Verification
- `POST /api/auth/verify-email` - Verify email with token
- `POST /api/auth/resend-verification` - Resend verification email

#### Password Management
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password with token
- `POST /api/auth/change-password` - Change password (authenticated)

#### OAuth Providers
- `GET /api/auth/google` - Google OAuth login
- `GET /api/auth/google/callback` - Google OAuth callback
- `GET /api/auth/github` - GitHub OAuth login
- `GET /api/auth/github/callback` - GitHub OAuth callback

#### User Management
- `GET /api/auth/me` - Get current user profile
- `PATCH /api/auth/profile` - Update user profile
- `DELETE /api/auth/account` - Delete user account

## Security Features

### JWT Configuration
- **Access Token**: Short-lived (15 minutes)
- **Refresh Token**: Long-lived (7 days)
- **Algorithm**: RS256 (asymmetric) or HS256 (symmetric)
- **Secret Management**: Environment variables

### Rate Limiting
- Registration: 5 attempts per hour per IP
- Login: 10 attempts per hour per IP
- Password reset: 3 attempts per hour per email
- Email verification: 3 attempts per hour per email

### Password Security
- Minimum 8 characters
- Must contain uppercase, lowercase, number, and special character
- Bcrypt hashing with salt rounds of 10
- Password history to prevent reuse

### Email Security
- JWT-based verification tokens
- Token expiration: 24 hours
- Rate limiting on resend requests

## Implementation Structure

```
libs/auth/
├── src/
│   ├── controllers/
│   │   ├── auth.controller.ts
│   │   └── oauth.controller.ts
│   ├── services/
│   │   ├── auth.service.ts
│   │   ├── user.service.ts
│   │   ├── token.service.ts
│   │   ├── email.service.ts
│   │   └── oauth.service.ts
│   ├── strategies/
│   │   ├── jwt.strategy.ts
│   │   ├── jwt-refresh.strategy.ts
│   │   ├── google.strategy.ts
│   │   └── github.strategy.ts
│   ├── guards/
│   │   ├── jwt-auth.guard.ts
│   │   ├── jwt-refresh.guard.ts
│   │   └── oauth.guard.ts
│   ├── decorators/
│   │   ├── current-user.decorator.ts
│   │   ├── roles.decorator.ts
│   │   └── public.decorator.ts
│   ├── dto/
│   │   ├── auth.dto.ts
│   │   ├── user.dto.ts
│   │   └── oauth.dto.ts
│   ├── entities/
│   │   └── user.entity.ts
│   ├── interfaces/
│   │   ├── auth.interface.ts
│   │   └── jwt.interface.ts
│   ├── config/
│   │   └── auth.config.ts
│   ├── auth.module.ts
│   └── index.ts
├── prisma/
│   └── schema.prisma (extended with auth models)
├── templates/
│   ├── verification-email.hbs
│   ├── password-reset.hbs
│   └── welcome-email.hbs
└── tests/
    ├── auth.service.spec.ts
    ├── auth.controller.spec.ts
    └── e2e/
        └── auth.e2e-spec.ts
```

## Dependencies Required

```json
{
  "@nestjs/passport": "^10.0.0",
  "@nestjs/jwt": "^10.0.0",
  "passport": "^0.6.0",
  "passport-jwt": "^4.0.0",
  "passport-local": "^1.0.0",
  "passport-google-oauth20": "^2.0.0",
  "passport-github2": "^0.1.12",
  "bcrypt": "^5.1.0",
  "nodemailer": "^6.9.0",
  "handlebars": "^4.7.0",
  "express-rate-limit": "^6.7.0",
  "helmet": "^6.1.0",
  "class-validator": "^0.14.0",
  "class-transformer": "^0.5.0"
}
```

## Environment Variables

```bash
# JWT Configuration
JWT_SECRET=your-jwt-secret-key
JWT_REFRESH_SECRET=your-jwt-refresh-secret
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
FROM_NAME=Your App Name

# Application Configuration
APP_URL=http://localhost:3000
API_URL=http://localhost:3000/api
```

## Error Handling

### Authentication Errors
- `AUTH001` - Invalid credentials
- `AUTH002` - User not found
- `AUTH003` - Email not verified
- `AUTH004` - Account disabled
- `AUTH005` - Token expired
- `AUTH006` - Token invalid
- `AUTH007` - Rate limit exceeded
- `AUTH008` - OAuth provider error

### Validation Errors
- `VAL001` - Invalid email format
- `VAL002` - Password too weak
- `VAL003` - Email already exists
- `VAL004` - Invalid token format

## Testing Strategy

### Unit Tests
- AuthService methods
- TokenService methods
- UserService methods
- JWT strategies
- Guards and decorators

### Integration Tests
- Full authentication flow
- OAuth integration
- Email verification flow
- Password reset flow
- Rate limiting behavior

### E2E Tests
- Complete user registration and login
- OAuth provider integration
- Token refresh mechanism
- Account management operations

## Performance Considerations

### Database Optimization
- Indexes on email, token fields
- Composite indexes for OAuth provider lookups
- Proper foreign key constraints

### Caching Strategy
- JWT token validation caching
- User session caching
- Rate limit data caching

### Security Best Practices
- Input validation and sanitization
- SQL injection prevention via Prisma
- XSS protection
- CSRF protection
- Secure headers with Helmet
- Rate limiting on all endpoints