# File Renderer API 认证说明

本文档介绍 File Renderer Service 的认证机制。

## 目录

- [概述](#概述)
- [认证方式](#认证方式)
- [API Key 认证](#api-key-认证)
- [Bearer Token 认证](#bearer-token-认证)
- [配置认证](#配置认证)
- [安全建议](#安全建议)

## 概述

File Renderer Service 支持两种认证方式：

1. **API Key 认证** - 简单直接的认证方式，适合服务端应用
2. **Bearer Token (JWT) 认证** - 基于令牌的认证方式，适合需要用户身份验证的场景

默认情况下，API 端点不需要认证。在生产环境中，建议启用认证以保护您的数据。

## 认证方式

### 支持的认证方案

| 方案 | 类型 | 头部名称 | 格式 |
|------|------|----------|------|
| API Key | apiKey | `X-API-Key` | `{your_api_key}` |
| Bearer Token | http | `Authorization` | `Bearer {token}` |

## API Key 认证

### 获取 API Key

联系系统管理员获取 API Key。API Key 通常具有以下格式：

```
fr_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 使用 API Key

在请求头中添加 `X-API-Key`：

```bash
curl -X POST \
  http://localhost:8000/api/v1/files/upload \
  -H "X-API-Key: your-api-key" \
  -F "file=@document.pdf"
```

### Python 示例

```python
import requests

headers = {
    "X-API-Key": "your-api-key"
}

response = requests.post(
    "http://localhost:8000/api/v1/files/upload",
    headers=headers,
    files={"file": open("document.pdf", "rb")}
)
```

### JavaScript 示例

```javascript
const response = await fetch("http://localhost:8000/api/v1/files/upload", {
  method: "POST",
  headers: {
    "X-API-Key": "your-api-key",
  },
  body: formData,
});
```

## Bearer Token 认证

### 获取 Token

Token 通过身份验证服务获取。典型的流程：

1. 使用用户名/密码登录
2. 获取 JWT Token
3. 在后续请求中使用 Token

```bash
# 登录获取 Token
curl -X POST \
  https://auth.example.com/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "user@example.com",
    "password": "your-password"
  }'
```

响应示例：

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 3600
}
```

### 使用 Bearer Token

在请求头中添加 `Authorization`：

```bash
curl -X POST \
  http://localhost:8000/api/v1/files/upload \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -F "file=@document.pdf"
```

### Python 示例

```python
import requests

headers = {
    "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}

response = requests.post(
    "http://localhost:8000/api/v1/files/upload",
    headers=headers,
    files={"file": open("document.pdf", "rb")}
)
```

### JavaScript 示例

```javascript
const response = await fetch("http://localhost:8000/api/v1/files/upload", {
  method: "POST",
  headers: {
    Authorization: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  },
  body: formData,
});
```

## 配置认证

### 环境变量配置

在 `.env` 文件中配置认证：

```bash
# 启用认证
ENABLE_AUTH=true

# API Key 配置
API_KEY_HEADER=X-API-Key
ALLOWED_API_KEYS=key1,key2,key3

# JWT 配置
JWT_SECRET=your-jwt-secret-key
JWT_ALGORITHM=HS256
JWT_EXPIRATION_HOURS=24
```

### 服务端配置

在 `config.py` 中添加认证配置：

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # ... 其他配置

    # 认证配置
    enable_auth: bool = False
    api_key_header: str = "X-API-Key"
    allowed_api_keys: list[str] = []
    jwt_secret: str = ""
    jwt_algorithm: str = "HS256"
    jwt_expiration_hours: int = 24
```

### 实现认证依赖

创建 `lib/auth.py`：

```python
from fastapi import HTTPException, Security, status
from fastapi.security import APIKeyHeader, HTTPAuthorizationCredentials, HTTPBearer

from config import settings

api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)
bearer_scheme = HTTPBearer(auto_error=False)


async def verify_api_key(api_key: str = Security(api_key_header)) -> str:
    """验证 API Key"""
    if not settings.enable_auth:
        return api_key

    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API Key is required",
        )

    if api_key not in settings.allowed_api_keys:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid API Key",
        )

    return api_key


async def verify_bearer_token(
    credentials: HTTPAuthorizationCredentials = Security(bearer_scheme),
) -> str:
    """验证 Bearer Token"""
    if not settings.enable_auth:
        return credentials.credentials if credentials else ""

    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Bearer token is required",
        )

    import jwt

    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid token",
        )


async def verify_auth(
    api_key: str = Security(api_key_header),
    bearer: HTTPAuthorizationCredentials = Security(bearer_scheme),
) -> str:
    """验证 API Key 或 Bearer Token"""
    if not settings.enable_auth:
        return api_key or (bearer.credentials if bearer else "")

    # 尝试 API Key 认证
    if api_key and api_key in settings.allowed_api_keys:
        return api_key

    # 尝试 Bearer Token 认证
    if bearer:
        import jwt

        try:
            payload = jwt.decode(
                bearer.credentials,
                settings.jwt_secret,
                algorithms=[settings.jwt_algorithm],
            )
            return payload
        except jwt.ExpiredSignatureError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has expired",
            )
        except jwt.InvalidTokenError:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid token",
            )

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required",
    )
```

### 在路由中使用认证

```python
from fastapi import APIRouter, Depends

from lib.auth import verify_api_key, verify_bearer_token, verify_auth

router = APIRouter()

# 使用 API Key 认证
@router.post("/upload", dependencies=[Depends(verify_api_key)])
async def upload_file(...):
    ...

# 使用 Bearer Token 认证
@router.get("/files", dependencies=[Depends(verify_bearer_token)])
async def list_files(...):
    ...

# 使用任意一种认证
@router.delete("/files/{file_id}", dependencies=[Depends(verify_auth)])
async def delete_file(...):
    ...
```

## 安全建议

### 1. 使用 HTTPS

生产环境必须使用 HTTPS 加密通信：

```bash
# 使用 Let's Encrypt 证书
certbot --nginx -d your-domain.com
```

### 2. 定期轮换 API Key

- 定期更换 API Key
- 使用环境变量或密钥管理服务存储 Key
- 不要在代码中硬编码 API Key

### 3. 设置合理的 Token 过期时间

- Access Token: 15-60 分钟
- Refresh Token: 7-30 天

### 4. 实施速率限制

```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@router.post("/upload")
@limiter.limit("10/minute")
async def upload_file(...):
    ...
```

### 5. 审计日志

记录所有认证事件：

```python
import logging

logger = logging.getLogger(__name__)

async def verify_api_key(api_key: str = Security(api_key_header)) -> str:
    logger.info(f"API Key authentication attempt: {api_key[:8]}...")
    # ... 验证逻辑
```

### 6. 错误信息隐藏

不要泄露敏感信息：

```python
# 好的做法
raise HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Authentication failed",
)

# 避免
raise HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail=f"API Key {api_key} not found in database",
)
```

## 常见问题

### Q: 可以同时使用两种认证方式吗？

A: 可以。系统会依次尝试 API Key 和 Bearer Token 认证。

### Q: 如何禁用认证？

A: 设置环境变量 `ENABLE_AUTH=false`。

### Q: API Key 泄露了怎么办？

A: 立即从 `ALLOWED_API_KEYS` 中移除该 Key，并生成新的 Key。

### Q: Token 过期了怎么办？

A: 使用 Refresh Token 获取新的 Access Token，或重新登录。

### Q: 如何测试认证？

A: 使用 Swagger UI (`/docs`) 的 "Authorize" 按钮测试认证。
