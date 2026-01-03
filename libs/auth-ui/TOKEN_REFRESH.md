# Token 自动刷新实现说明

## 概述

[`auth-context.tsx`](src/lib/auth-context.tsx) 实现了完整的 JWT token 自动刷新机制，确保用户会话在 token 过期前自动刷新，提供无缝的用户体验。

## 核心功能

### 1. Token 过期时间追踪

- **存储位置**: `localStorage.getItem('tokenExpiry')`
- **来源**: 登录/注册响应中的 `expiresIn` 字段，或从 JWT payload 中解析
- **默认值**: 如果服务器未提供 `expiresIn`，默认为 1 小时 (3600 秒)

### 2. 自动刷新定时器

实现了一个定时器，在 token 过期前 **5 分钟** 自动触发刷新：

```typescript
const scheduleTokenRefresh = useCallback((expiryTime: number) => {
  // 清除之前的定时器
  if (refreshTimerRef.current) {
    clearTimeout(refreshTimerRef.current);
  }

  // 在token过期前5分钟刷新
  const now = Date.now();
  const refreshDelay = Math.max(0, expiryTime - now - 5 * 60 * 1000);

  refreshTimerRef.current = setTimeout(() => {
    refreshAccessToken();
  }, refreshDelay);
}, []);
```

### 3. Token 刷新逻辑

[`refreshAccessToken()`](src/lib/auth-context.tsx:224) 函数负责执行实际的刷新操作：

- **防止并发刷新**: 使用 `isRefreshingRef` 确保同时只有一个刷新请求
- **刷新端点**: `POST /api/auth/refresh`
- **刷新成功**: 更新 token 和过期时间，重新安排下次刷新
- **刷新失败**: 自动登出用户

### 4. 401 响应处理

[`fetchWithAuth()`](src/lib/auth-context.tsx:267) 是一个 fetch 包装器，自动处理 401 错误：

```typescript
const fetchWithAuth = useCallback(
  async (url: string, options: RequestInit = {}): Promise<Response> => {
    const token = getToken();
    const headers = {
      ...options.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    let response = await fetch(url, { ...options, headers });

    // 如果收到401，尝试刷新token并重试
    if (response.status === 401 && token) {
      const refreshSuccess = await refreshAccessToken();
      if (refreshSuccess) {
        const newToken = getToken();
        const newHeaders = {
          ...options.headers,
          ...(newToken ? { Authorization: `Bearer ${newToken}` } : {}),
        };
        response = await fetch(url, { ...options, headers: newHeaders });
      }
    }

    return response;
  },
  [getToken, refreshAccessToken],
);
```

## 工作流程

### 登录/注册流程

```
用户登录 → 服务器返回 accessToken + expiresIn
         ↓
    存储 token 和过期时间
         ↓
    启动自动刷新定时器 (过期前5分钟)
```

### 自动刷新流程

```
定时器触发 → 调用 /api/auth/refresh
         ↓
    刷新成功 → 更新 token → 重新安排定时器
    刷新失败 → 自动登出
```

### 应用初始化流程

```
应用启动 → 检查 localStorage 中的 token
         ↓
    Token 已过期？ → 尝试刷新 → 刷新失败则登出
         ↓
    Token 有效？ → 验证 token → 安排自动刷新
```

## 服务器端要求

### 登录/注册响应格式

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "sub": "user-id",
    "email": "user@example.com",
    "name": "User Name",
    "isActive": true
  },
  "expiresIn": 3600 // 可选，单位：秒
}
```

### 刷新端点

**端点**: `POST /api/auth/refresh`

**请求头**:

```
Authorization: Bearer <current_token>
Content-Type: application/json
```

**响应格式**:

```json
{
  "accessToken": "new_token_here",
  "expiresIn": 3600
}
```

### 验证端点

**端点**: `GET /api/auth/validate`

**请求头**:

```
Authorization: Bearer <token>
```

## 使用示例

### 基本使用

```tsx
import { useAuth } from '@your-org/auth-ui';

function MyComponent() {
  const { user, isAuthenticated, refreshAccessToken } = useAuth();

  const handleManualRefresh = async () => {
    const success = await refreshAccessToken();
    if (success) {
      console.log('Token refreshed successfully');
    } else {
      console.log('Token refresh failed');
    }
  };

  if (!isAuthenticated) {
    return <div>Please login</div>;
  }

  return (
    <div>
      <h1>Welcome, {user?.name}</h1>
      <button onClick={handleManualRefresh}>Refresh Token</button>
    </div>
  );
}
```

### 使用 fetchWithAuth 进行 API 调用

```tsx
import { useAuth } from '@your-org/auth-ui';

function DataComponent() {
  const { fetchWithAuth } = useAuth();

  const fetchData = async () => {
    const response = await fetchWithAuth('/api/data', {
      method: 'GET',
    });

    if (response.ok) {
      const data = await response.json();
      console.log(data);
    }
  };

  return <button onClick={fetchData}>Fetch Data</button>;
}
```

## 配置选项

### 修改刷新提前时间

默认在 token 过期前 5 分钟刷新，可以在 [`scheduleTokenRefresh()`](src/lib/auth-context.tsx:210) 中修改：

```typescript
// 修改为过期前 10 分钟刷新
const refreshDelay = Math.max(0, expiryTime - now - 10 * 60 * 1000);
```

### 修改默认过期时间

默认为 1 小时，可以在 [`login()`](src/lib/auth-context.tsx:151) 和 [`signup()`](src/lib/auth-context.tsx:249) 中修改：

```typescript
const expiryTime = Date.now() + (expiresIn || 7200) * 1000; // 2 小时
```

## 注意事项

1. **定时器清理**: 组件卸载时会自动清理定时器，防止内存泄漏
2. **并发刷新保护**: 使用 `isRefreshingRef` 防止多个刷新请求同时进行
3. **错误处理**: 刷新失败会自动登出用户，确保安全性
4. **本地存储**: Token 和过期时间存储在 `localStorage` 中，页面刷新后仍可恢复会话

## 测试建议

1. 测试正常登录后的自动刷新
2. 测试 token 过期后的自动刷新
3. 测试刷新失败时的登出行为
4. 测试页面刷新后的会话恢复
5. 测试并发刷新请求的保护机制
