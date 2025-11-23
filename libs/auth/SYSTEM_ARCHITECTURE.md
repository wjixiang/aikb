# Authentication System Architecture

## System Overview

```mermaid
graph TB
    subgraph "Client Applications"
        WEB[Web App]
        MOBILE[Mobile App]
        API_CLIENT[API Client]
    end
    
    subgraph "API Gateway"
        GATEWAY[API Gateway]
        RATE_LIMIT[Rate Limiter]
        CORS[CORS Handler]
    end
    
    subgraph "Authentication Service"
        AUTH_CONTROLLER[Auth Controller]
        OAUTH_CONTROLLER[OAuth Controller]
        USER_CONTROLLER[User Controller]
        
        AUTH_SERVICE[Auth Service]
        USER_SERVICE[User Service]
        TOKEN_SERVICE[Token Service]
        EMAIL_SERVICE[Email Service]
        OAUTH_SERVICE[OAuth Service]
    end
    
    subgraph "Security Layer"
        JWT_GUARD[JWT Guard]
        JWT_STRATEGY[JWT Strategy]
        REFRESH_STRATEGY[Refresh Strategy]
        GOOGLE_STRATEGY[Google Strategy]
        GITHUB_STRATEGY[GitHub Strategy]
    end
    
    subgraph "Data Layer"
        PRISMA[Prisma ORM]
        POSTGRES[(PostgreSQL)]
        REDIS[(Redis Cache)]
    end
    
    subgraph "External Services"
        SMTP[SMTP Server]
        GOOGLE[Google OAuth]
        GITHUB[GitHub OAuth]
    end
    
    WEB --> GATEWAY
    MOBILE --> GATEWAY
    API_CLIENT --> GATEWAY
    
    GATEWAY --> RATE_LIMIT
    RATE_LIMIT --> CORS
    CORS --> AUTH_CONTROLLER
    
    AUTH_CONTROLLER --> AUTH_SERVICE
    OAUTH_CONTROLLER --> OAUTH_SERVICE
    USER_CONTROLLER --> USER_SERVICE
    
    AUTH_SERVICE --> TOKEN_SERVICE
    AUTH_SERVICE --> EMAIL_SERVICE
    AUTH_SERVICE --> USER_SERVICE
    
    AUTH_SERVICE --> JWT_GUARD
    JWT_GUARD --> JWT_STRATEGY
    
    TOKEN_SERVICE --> PRISMA
    USER_SERVICE --> PRISMA
    EMAIL_SERVICE --> SMTP
    
    OAUTH_SERVICE --> GOOGLE
    OAUTH_SERVICE --> GITHUB
    
    PRISMA --> POSTGRES
    TOKEN_SERVICE --> REDIS
```

## Component Architecture

### Authentication Flow

```mermaid
sequenceDiagram
    participant Client
    participant API
    participant AuthService
    participant TokenService
    participant EmailService
    participant Database
    
    Client->>API: POST /auth/register
    API->>AuthService: register(userData)
    AuthService->>Database: Check if user exists
    Database-->>AuthService: User not found
    AuthService->>AuthService: Hash password
    AuthService->>Database: Create user
    Database-->>AuthService: User created
    AuthService->>TokenService: Generate verification token
    TokenService-->>AuthService: Token generated
    AuthService->>EmailService: Send verification email
    EmailService-->>AuthService: Email sent
    AuthService->>TokenService: Generate JWT tokens
    TokenService-->>AuthService: Tokens generated
    AuthService-->>API: Registration successful
    API-->>Client: 201 Created + tokens
```

### Login Flow

```mermaid
sequenceDiagram
    participant Client
    participant API
    participant AuthService
    participant TokenService
    participant Database
    
    Client->>API: POST /auth/login
    API->>AuthService: login(credentials)
    AuthService->>Database: Find user by email
    Database-->>AuthService: User found
    AuthService->>AuthService: Validate password
    AuthService->>AuthService: Check email verified
    AuthService->>Database: Update last login
    AuthService->>TokenService: Generate JWT tokens
    TokenService->>Database: Store refresh token
    TokenService-->>AuthService: Tokens generated
    AuthService-->>API: Login successful
    API-->>Client: 200 OK + tokens
```

### OAuth Flow

```mermaid
sequenceDiagram
    participant Client
    participant API
    participant OAuthService
    participant Google
    participant Database
    
    Client->>API: GET /auth/google
    API->>OAuthService: Initiate Google OAuth
    OAuthService-->>Client: Redirect to Google
    Client->>Google: Authorize application
    Google-->>Client: Redirect with code
    Client->>API: GET /auth/google/callback?code=...
    API->>OAuthService: Handle callback
    OAuthService->>Google: Exchange code for tokens
    Google-->>OAuthService: Access token
    OAuthService->>Google: Get user profile
    Google-->>OAuthService: User profile
    OAuthService->>Database: Find/create user
    Database-->>OAuthService: User data
    OAuthService->>Database: Store OAuth account
    OAuthService-->>API: OAuth successful
    API-->>Client: 200 OK + JWT tokens
```

## Database Schema

```mermaid
erDiagram
    User ||--o{ RefreshToken : has
    User ||--o{ EmailVerification : has
    User ||--o{ PasswordReset : has
    User ||--o{ Account : has
    User ||--o{ Session : has
    
    User {
        string id PK
        string email UK
        string password
        string firstName
        string lastName
        string avatar
        boolean isEmailVerified
        boolean isActive
        datetime lastLoginAt
        datetime createdAt
        datetime updatedAt
    }
    
    RefreshToken {
        string id PK
        string token UK
        string userId FK
        datetime expiresAt
        datetime createdAt
        boolean isRevoked
    }
    
    EmailVerification {
        string id PK
        string email
        string token UK
        datetime expiresAt
        datetime createdAt
        string userId FK
    }
    
    PasswordReset {
        string id PK
        string email
        string token UK
        datetime expiresAt
        datetime createdAt
        string userId FK
    }
    
    Account {
        string id PK
        string userId FK
        string type
        string provider
        string providerAccountId
        string refresh_token
        string access_token
        int expires_at
        string token_type
        string scope
        string id_token
        string session_state
        datetime createdAt
        datetime updatedAt
    }
    
    Session {
        string id PK
        string sessionToken UK
        string userId FK
        datetime expires
        datetime createdAt
    }
```

## Security Architecture

### JWT Token Structure

```typescript
interface AccessTokenPayload {
  sub: string;        // User ID
  email: string;      // User email
  iat: number;        // Issued at
  exp: number;        // Expiration
}

interface RefreshTokenPayload {
  sub: string;        // User ID
  tokenId: string;    // Refresh token ID
  iat: number;        // Issued at
  exp: number;        // Expiration
}
```

### Security Layers

1. **Transport Layer Security**
   - HTTPS enforcement
   - TLS 1.3 minimum
   - Certificate pinning for mobile apps

2. **API Gateway Security**
   - Rate limiting per IP
   - CORS configuration
   - Request size limits
   - DDoS protection

3. **Authentication Layer**
   - JWT token validation
   - Token expiration checks
   - Refresh token rotation
   - Session management

4. **Application Security**
   - Input validation
   - SQL injection prevention
   - XSS protection
   - CSRF protection
   - Secure headers

5. **Data Layer Security**
   - Password hashing (bcrypt)
   - Token encryption
   - Database encryption at rest
   - Secure key management

## Performance Considerations

### Caching Strategy

```mermaid
graph LR
    CLIENT[Client] --> CACHE[Redis Cache]
    CACHE --> SERVICE[Auth Service]
    SERVICE --> DB[(Database)]
    
    CACHE -.-> EVICT[Cache Eviction]
    EVICT -.-> CACHE
```

### Database Optimization

1. **Indexes**
   - `users.email` - Unique index
   - `refresh_tokens.token` - Unique index
   - `refresh_tokens.userId` - Foreign key index
   - `email_verifications.token` - Unique index
   - `password_resets.token` - Unique index
   - `accounts.provider_providerAccountId` - Composite unique index

2. **Query Optimization**
   - Use Prisma's query optimization
   - Implement connection pooling
   - Use database views for complex queries
   - Implement read replicas for scaling

### Scaling Considerations

1. **Horizontal Scaling**
   - Stateless authentication service
   - Shared session storage (Redis)
   - Load balancer configuration
   - Database read replicas

2. **Vertical Scaling**
   - Optimize database queries
   - Implement caching layers
   - Use CDN for static assets
   - Optimize email sending

## Monitoring and Observability

### Metrics to Track

1. **Authentication Metrics**
   - Login success/failure rates
   - Registration conversion rates
   - OAuth adoption rates
   - Token refresh rates

2. **Security Metrics**
   - Failed login attempts
   - Password reset requests
   - Account lockouts
   - Suspicious activity alerts

3. **Performance Metrics**
   - Response times
   - Database query performance
   - Cache hit rates
   - Email delivery rates

### Logging Strategy

```typescript
interface AuthLog {
  timestamp: Date;
  userId?: string;
  email?: string;
  action: AuthAction;
  ip: string;
  userAgent: string;
  success: boolean;
  error?: string;
  metadata?: Record<string, any>;
}

enum AuthAction {
  REGISTER = 'REGISTER',
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  REFRESH_TOKEN = 'REFRESH_TOKEN',
  VERIFY_EMAIL = 'VERIFY_EMAIL',
  RESET_PASSWORD = 'RESET_PASSWORD',
  OAUTH_LOGIN = 'OAUTH_LOGIN',
}
```

## Deployment Architecture

### Development Environment

```yaml
# docker-compose.yml
version: '3.8'
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: auth_dev
      POSTGRES_USER: dev_user
      POSTGRES_PASSWORD: dev_password
    ports:
      - "5432:5432"
  
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
  
  auth-service:
    build: .
    environment:
      DATABASE_URL: postgresql://dev_user:dev_password@postgres:5432/auth_dev
      REDIS_URL: redis://redis:6379
      JWT_SECRET: dev_jwt_secret
    ports:
      - "3000:3000"
    depends_on:
      - postgres
      - redis
```

### Production Environment

```yaml
# kubernetes-deployment.yml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: auth-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: auth-service
  template:
    metadata:
      labels:
        app: auth-service
    spec:
      containers:
      - name: auth-service
        image: your-registry/auth-service:latest
        ports:
        - containerPort: 3000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: auth-secrets
              key: database-url
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: auth-secrets
              key: jwt-secret
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
```

## Security Checklist

### Development Phase
- [ ] Input validation implemented
- [ ] SQL injection prevention
- [ ] XSS protection
- [ ] CSRF protection
- [ ] Secure password policy
- [ ] JWT secret management
- [ ] Rate limiting configured
- [ ] Error handling implemented
- [ ] Logging configured

### Production Phase
- [ ] HTTPS enforcement
- [ ] Security headers configured
- [ ] Database encryption enabled
- [ ] Key rotation strategy
- [ ] Monitoring and alerting
- [ ] Incident response plan
- [ ] Regular security audits
- [ ] Penetration testing
- [ ] Compliance requirements met

This architecture provides a robust, scalable, and secure foundation for authentication in NestJS applications.