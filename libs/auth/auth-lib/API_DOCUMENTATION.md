# Auth Library REST API Documentation

This document describes all the REST endpoints provided by the auth-lib library.

## Authentication Endpoints

### POST /auth/register
Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe" (optional)
}
```

**Response:**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe"
  },
  "accessToken": "jwt_token",
  "refreshToken": "refresh_token"
}
```

### POST /auth/login
Authenticate a user and return tokens.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe"
  },
  "accessToken": "jwt_token",
  "refreshToken": "refresh_token"
}
```

### POST /auth/refresh
Refresh an access token using a refresh token.

**Request Body:**
```json
{
  "refreshToken": "refresh_token"
}
```

**Response:**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe"
  },
  "accessToken": "new_jwt_token",
  "refreshToken": "new_refresh_token"
}
```

### POST /auth/logout
Logout a user by revoking their refresh token.

**Headers:** `Authorization: Bearer <access_token>`

**Request Body:**
```json
{
  "refreshToken": "refresh_token"
}
```

**Response:**
```json
{
  "message": "登出成功"
}
```

### GET /auth/validate
Validate the current user's token.

**Headers:** `Authorization: Bearer <access_token>`

**Response:**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "name": "John Doe",
  "isActive": true
}
```

## User Management Endpoints

### GET /users
Get a paginated list of users.

**Headers:** `Authorization: Bearer <access_token>`

**Query Parameters:**
- `page` (number, default: 1)
- `limit` (number, default: 10, max: 100)
- `search` (string, optional)
- `isActive` (boolean, optional)
- `isEmailVerified` (boolean, optional)
- `isPhoneVerified` (boolean, optional)
- `sortBy` (string, default: "createdAt", options: ["id", "email", "name", "createdAt", "lastLoginAt"])
- `sortOrder` (string, default: "desc", options: ["asc", "desc"])

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "email": "user@example.com",
      "name": "John Doe",
      "avatar": "https://example.com/avatar.jpg",
      "phone": "+1234567890",
      "isEmailVerified": true,
      "isPhoneVerified": true,
      "isActive": true,
      "lastLoginAt": "2023-01-01T00:00:00.000Z",
      "createdAt": "2023-01-01T00:00:00.000Z",
      "updatedAt": "2023-01-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "totalPages": 10,
    "hasNext": true,
    "hasPrev": false
  }
}
```

### GET /users/:id
Get detailed information about a specific user.

**Headers:** `Authorization: Bearer <access_token>`

**Response:**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "name": "John Doe",
  "avatar": "https://example.com/avatar.jpg",
  "phone": "+1234567890",
  "isEmailVerified": true,
  "isPhoneVerified": true,
  "isActive": true,
  "lastLoginAt": "2023-01-01T00:00:00.000Z",
  "createdAt": "2023-01-01T00:00:00.000Z",
  "updatedAt": "2023-01-01T00:00:00.000Z",
  "refreshTokens": [...],
  "sessions": [...],
  "loginLogs": [...],
  "wechatAccounts": [...],
  "accounts": [...]
}
```

### PUT /users/:id
Update user information.

**Headers:** `Authorization: Bearer <access_token>`

**Request Body:**
```json
{
  "name": "John Smith" (optional),
  "avatar": "https://example.com/new-avatar.jpg" (optional),
  "phone": "+1234567890" (optional),
  "isActive": true (optional)
}
```

**Response:**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "name": "John Smith",
  "avatar": "https://example.com/new-avatar.jpg",
  "phone": "+1234567890",
  "isEmailVerified": true,
  "isPhoneVerified": true,
  "isActive": true,
  "lastLoginAt": "2023-01-01T00:00:00.000Z",
  "createdAt": "2023-01-01T00:00:00.000Z",
  "updatedAt": "2023-01-01T00:00:00.000Z"
}
```

### POST /users/:id/password
Update a user's password.

**Headers:** `Authorization: Bearer <access_token>`

**Request Body:**
```json
{
  "currentPassword": "old_password",
  "newPassword": "new_password"
}
```

**Response:**
```json
{
  "success": true,
  "message": "密码更新成功",
  "timestamp": "2023-01-01T00:00:00.000Z"
}
```

### DELETE /users/:id
Delete a user.

**Headers:** `Authorization: Bearer <access_token>`

**Response:**
```json
{
  "success": true,
  "message": "用户删除成功",
  "timestamp": "2023-01-01T00:00:00.000Z"
}
```

### GET /users/:id/activity
Get user activity logs.

**Headers:** `Authorization: Bearer <access_token>`

**Response:**
```json
{
  "userId": "uuid",
  "activities": [
    {
      "type": "LOGIN",
      "description": "成功登录 (password)",
      "timestamp": "2023-01-01T00:00:00.000Z",
      "ip": "192.168.1.1",
      "userAgent": "Mozilla/5.0..."
    }
  ]
}
```

## Session Management Endpoints

### GET /sessions
Get user sessions.

**Headers:** `Authorization: Bearer <access_token>`

**Query Parameters:**
- `userId` (string, required) - User UUID
- `isActive` (boolean, optional)

**Response:**
```json
[
  {
    "id": "uuid",
    "sessionToken": "session_token",
    "userId": "uuid",
    "expires": "2023-01-01T00:00:00.000Z",
    "createdAt": "2023-01-01T00:00:00.000Z",
    "lastActivity": "2023-01-01T00:00:00.000Z",
    "clientInfo": {...},
    "isActive": true
  }
]
```

### DELETE /sessions/:sessionId
Revoke a specific session.

**Headers:** `Authorization: Bearer <access_token>`

**Response:**
```json
{
  "success": true,
  "message": "会话已撤销",
  "timestamp": "2023-01-01T00:00:00.000Z"
}
```

### DELETE /sessions/user/:userId
Revoke all sessions for a user.

**Headers:** `Authorization: Bearer <access_token>`

**Response:**
```json
{
  "success": true,
  "message": "所有会话已撤销",
  "timestamp": "2023-01-01T00:00:00.000Z"
}
```

## Verification Endpoints

### POST /verification/email/send
Send email verification.

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "验证邮件已发送",
  "token": "verification_token",
  "expiresAt": "2023-01-01T00:00:00.000Z"
}
```

### GET /verification/email/verify/:token
Verify email using token.

**Response:**
```json
{
  "success": true,
  "message": "邮箱验证成功"
}
```

### POST /verification/phone/verify
Verify phone number (not implemented yet).

**Headers:** `Authorization: Bearer <access_token>`

**Request Body:**
```json
{
  "phone": "+1234567890",
  "code": "123456"
}
```

**Response:**
```json
{
  "success": false,
  "message": "手机验证功能暂未实现"
}
```

## Password Reset Endpoints

### POST /password-reset/request
Request password reset.

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "密码重置链接已发送",
  "token": "reset_token",
  "expiresAt": "2023-01-01T00:00:00.000Z"
}
```

### POST /password-reset/confirm
Confirm password reset with token.

**Request Body:**
```json
{
  "token": "reset_token",
  "newPassword": "new_password"
}
```

**Response:**
```json
{
  "success": true,
  "message": "密码重置成功"
}
```

## Admin Endpoints

### GET /admin/stats
Get user statistics.

**Headers:** `Authorization: Bearer <access_token>`

**Response:**
```json
{
  "totalUsers": 1000,
  "activeUsers": 800,
  "verifiedEmailUsers": 900,
  "verifiedPhoneUsers": 700,
  "newUsersThisMonth": 50,
  "newUsersThisWeek": 10,
  "loginStats": {
    "totalLogins": 5000,
    "successfulLogins": 4800,
    "failedLogins": 200,
    "todayLogins": 100
  }
}
```

### POST /admin/bulk-operation
Perform bulk operations on users.

**Headers:** `Authorization: Bearer <access_token>`

**Request Body:**
```json
{
  "userIds": ["uuid1", "uuid2", "uuid3"],
  "action": "activate" | "deactivate" | "delete"
}
```

**Response:**
```json
{
  "success": true,
  "message": "批量操作完成，成功: 3，失败: 0",
  "processedCount": 3,
  "failedCount": 0,
  "errors": []
}
```

## Error Responses

All endpoints may return error responses in the following format:

```json
{
  "statusCode": 400,
  "message": "Error message",
  "error": "Bad Request"
}
```

Common HTTP status codes:
- 200: Success
- 201: Created
- 400: Bad Request
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 409: Conflict
- 500: Internal Server Error