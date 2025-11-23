# Prisma Schema Extension for Authentication

This document contains the Prisma schema extensions needed to add authentication models to the existing database schema.

## Schema Additions

Add these models to your existing `libs/bibliography-db/src/prisma/schema.prisma` file:

```prisma
// User model for authentication
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

// Refresh token model for JWT refresh mechanism
model RefreshToken {
  id          String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  token       String   @unique @db.VarChar(500)
  userId      String   @db.Uuid
  expiresAt   DateTime @db.Timestamptz(6)
  createdAt   DateTime @default(now()) @db.Timestamptz(6)
  isRevoked   Boolean  @default(false)
  
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@index([userId])
  @@index([token])
  @@index([expiresAt])
  @@map("refresh_tokens")
}

// Email verification tokens
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

// Password reset tokens
model PasswordReset {
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
  @@map("password_resets")
}

// OAuth account information for third-party authentication
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
  @@index([userId])
  @@index([provider])
  @@map("accounts")
}

// Session management for additional security
model Session {
  id           String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  sessionToken String   @unique @db.VarChar(255)
  userId       String   @db.Uuid
  expires      DateTime @db.Timestamptz(6)
  createdAt    DateTime @default(now()) @db.Timestamptz(6)
  
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@index([userId])
  @@index([sessionToken])
  @@index([expires])
  @@map("sessions")
}
```

## Migration Steps

1. **Backup your database** before making any changes
2. **Add the models** to your existing schema.prisma file
3. **Generate the migration**:
   ```bash
   cd libs/bibliography-db
   npx prisma migrate dev --name add_auth_models
   ```
4. **Generate the Prisma client**:
   ```bash
   npx prisma generate
   ```

## Database Indexes

The schema includes optimized indexes for:
- User email lookups (`@@unique([email])`)
- Token validation (`@@index([token])`)
- Token expiration cleanup (`@@index([expiresAt])`)
- OAuth provider lookups (`@@unique([provider, providerAccountId])`)
- User relationship queries (`@@index([userId])`)

## Relationships

- **User** → **RefreshToken**: One-to-many (cascade delete)
- **User** → **EmailVerification**: One-to-many (cascade delete)
- **User** → **PasswordReset**: One-to-many (cascade delete)
- **User** → **Account**: One-to-many (cascade delete)
- **User** → **Session**: One-to-many (cascade delete)

## Security Considerations

1. **Password Storage**: Passwords are hashed using bcrypt before storage
2. **Token Security**: All tokens are unique and have expiration times
3. **Cascade Deletes**: When a user is deleted, all related data is automatically removed
4. **Email Uniqueness**: Email addresses must be unique across the system
5. **OAuth Provider Uniqueness**: Each OAuth provider account is unique per user

## Data Cleanup

Consider implementing a cleanup job for:
- Expired refresh tokens
- Expired email verification tokens
- Expired password reset tokens
- Expired sessions

This can be done using a scheduled cron job or a background worker process.