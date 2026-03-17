# File Renderer API 错误代码参考

本文档详细说明 File Renderer Service API 的错误代码和响应格式。

## 目录

- [错误响应格式](#错误响应格式)
- [HTTP 状态码](#http-状态码)
- [错误代码列表](#错误代码列表)
- [验证错误](#验证错误)
- [文件操作错误](#文件操作错误)
- [认证错误](#认证错误)
- [服务器错误](#服务器错误)

## 错误响应格式

所有错误响应都遵循统一的 JSON 格式：

```json
{
  "success": false,
  "message": "人类可读的错误描述",
  "error_code": "ERROR_CODE",
  "errors": [
    {
      "field": "字段名（可选）",
      "message": "字段错误描述",
      "code": "FIELD_ERROR_CODE"
    }
  ],
  "timestamp": "2024-01-15T08:30:00Z"
}
```

### 字段说明

| 字段 | 类型 | 描述 |
|------|------|------|
| `success` | boolean | 始终为 `false` |
| `message` | string | 人类可读的错误描述 |
| `error_code` | string | 机器可读的错误代码 |
| `errors` | array | 详细的字段错误列表（可选） |
| `timestamp` | string | ISO 8601 格式的时间戳 |

## HTTP 状态码

| 状态码 | 描述 | 场景 |
|--------|------|------|
| 200 | OK | 请求成功 |
| 201 | Created | 资源创建成功 |
| 400 | Bad Request | 请求参数错误 |
| 401 | Unauthorized | 未认证 |
| 403 | Forbidden | 无权限 |
| 404 | Not Found | 资源不存在 |
| 409 | Conflict | 资源冲突 |
| 413 | Payload Too Large | 请求体过大 |
| 422 | Unprocessable Entity | 无法处理的实体 |
| 429 | Too Many Requests | 请求过于频繁 |
| 500 | Internal Server Error | 服务器内部错误 |
| 503 | Service Unavailable | 服务不可用 |

## 错误代码列表

### 通用错误

| 错误代码 | HTTP 状态码 | 描述 | 解决方案 |
|----------|-------------|------|----------|
| `VALIDATION_ERROR` | 400 | 请求参数验证失败 | 检查请求参数格式和类型 |
| `INVALID_JSON` | 400 | 请求体 JSON 格式错误 | 检查 JSON 语法 |
| `MISSING_FIELD` | 400 | 缺少必需字段 | 补充必需的字段 |
| `INVALID_FIELD_TYPE` | 400 | 字段类型错误 | 检查字段数据类型 |
| `INVALID_FIELD_VALUE` | 400 | 字段值无效 | 检查字段值范围或格式 |

### 认证错误

| 错误代码 | HTTP 状态码 | 描述 | 解决方案 |
|----------|-------------|------|----------|
| `UNAUTHORIZED` | 401 | 未提供认证信息 | 添加认证头 |
| `INVALID_API_KEY` | 401 | API Key 无效 | 检查 API Key 是否正确 |
| `EXPIRED_TOKEN` | 401 | Token 已过期 | 刷新 Token 或重新登录 |
| `INVALID_TOKEN` | 403 | Token 无效 | 检查 Token 格式 |
| `FORBIDDEN` | 403 | 无权限访问 | 联系管理员获取权限 |
| `INSUFFICIENT_PERMISSIONS` | 403 | 权限不足 | 使用具有更高权限的账号 |

### 文件操作错误

| 错误代码 | HTTP 状态码 | 描述 | 解决方案 |
|----------|-------------|------|----------|
| `FILE_NOT_FOUND` | 404 | 文件不存在 | 检查文件路径或 ID |
| `FILE_ALREADY_EXISTS` | 409 | 文件已存在 | 使用不同的文件名或先删除 |
| `FILE_TOO_LARGE` | 413 | 文件超过大小限制 | 压缩文件或分片上传 |
| `INVALID_FILE_TYPE` | 400 | 不支持的文件类型 | 检查支持的文件类型列表 |
| `FILE_UPLOAD_FAILED` | 500 | 文件上传失败 | 重试或联系管理员 |
| `FILE_DOWNLOAD_FAILED` | 500 | 文件下载失败 | 检查文件是否存在 |
| `FILE_DELETE_FAILED` | 500 | 文件删除失败 | 检查权限或重试 |
| `FILE_READ_FAILED` | 500 | 文件读取失败 | 检查文件完整性 |
| `FILE_WRITE_FAILED` | 500 | 文件写入失败 | 检查存储空间 |

### PDF 处理错误

| 错误代码 | HTTP 状态码 | 描述 | 解决方案 |
|----------|-------------|------|----------|
| `PDF_NOT_FOUND` | 404 | PDF 文件不存在 | 检查 S3 路径 |
| `INVALID_PAGE_NUMBER` | 400 | 页码无效 | 检查页码范围 |
| `PDF_PARSE_ERROR` | 500 | PDF 解析失败 | 检查 PDF 文件是否损坏 |
| `PDF_CONVERSION_ERROR` | 500 | PDF 转换失败 | 尝试其他文件或联系管理员 |
| `PDF_ENCRYPTION_ERROR` | 400 | PDF 加密无法处理 | 提供未加密的 PDF |

### Markdown 编辑错误

| 错误代码 | HTTP 状态码 | 描述 | 解决方案 |
|----------|-------------|------|----------|
| `MARKDOWN_NOT_FOUND` | 404 | Markdown 文件不存在 | 检查 S3 路径 |
| `INVALID_LINE_NUMBER` | 400 | 行号无效 | 检查行号范围 |
| `INVALID_EDIT_OPERATION` | 400 | 无效的编辑操作 | 检查操作参数 |
| `EDIT_CONFLICT` | 409 | 编辑冲突 | 获取最新内容后重试 |
| `PREVIEW_FAILED` | 500 | 预览生成失败 | 重试或联系管理员 |

### Docling 转换错误

| 错误代码 | HTTP 状态码 | 描述 | 解决方案 |
|----------|-------------|------|----------|
| `CONVERSION_NOT_FOUND` | 404 | 转换结果不存在 | 先执行转换操作 |
| `CONVERSION_IN_PROGRESS` | 409 | 转换正在进行中 | 等待转换完成 |
| `CONVERSION_FAILED` | 500 | 转换失败 | 检查文件格式或重试 |
| `UNSUPPORTED_FORMAT` | 400 | 不支持的文件格式 | 查看支持的格式列表 |
| `CACHE_INVALIDATION_FAILED` | 500 | 缓存失效失败 | 重试或联系管理员 |

### 存储错误

| 错误代码 | HTTP 状态码 | 描述 | 解决方案 |
|----------|-------------|------|----------|
| `S3_CONNECTION_ERROR` | 503 | S3 连接失败 | 检查 S3 配置和网络 |
| `S3_UPLOAD_ERROR` | 500 | S3 上传失败 | 重试或联系管理员 |
| `S3_DOWNLOAD_ERROR` | 500 | S3 下载失败 | 检查文件是否存在 |
| `S3_DELETE_ERROR` | 500 | S3 删除失败 | 检查权限或重试 |
| `S3_BUCKET_NOT_FOUND` | 404 | S3 Bucket 不存在 | 检查 Bucket 名称 |

### 数据库错误

| 错误代码 | HTTP 状态码 | 描述 | 解决方案 |
|----------|-------------|------|----------|
| `DB_CONNECTION_ERROR` | 503 | 数据库连接失败 | 检查数据库配置 |
| `DB_QUERY_ERROR` | 500 | 数据库查询失败 | 重试或联系管理员 |
| `DB_INTEGRITY_ERROR` | 409 | 数据完整性错误 | 检查数据约束 |

### 服务器错误

| 错误代码 | HTTP 状态码 | 描述 | 解决方案 |
|----------|-------------|------|----------|
| `INTERNAL_ERROR` | 500 | 服务器内部错误 | 联系管理员 |
| `SERVICE_UNAVAILABLE` | 503 | 服务不可用 | 稍后重试 |
| `RATE_LIMITED` | 429 | 请求过于频繁 | 降低请求频率 |
| `TIMEOUT_ERROR` | 504 | 请求超时 | 重试或优化请求 |

## 验证错误

当请求参数验证失败时，会返回详细的字段错误信息：

```json
{
  "success": false,
  "message": "请求参数验证失败",
  "error_code": "VALIDATION_ERROR",
  "errors": [
    {
      "field": "fileName",
      "message": "文件名不能为空",
      "code": "REQUIRED_FIELD"
    },
    {
      "field": "page",
      "message": "页码必须大于等于 1",
      "code": "INVALID_RANGE"
    }
  ],
  "timestamp": "2024-01-15T08:30:00Z"
}
```

### 字段错误代码

| 错误代码 | 描述 |
|----------|------|
| `REQUIRED_FIELD` | 必需字段缺失 |
| `INVALID_TYPE` | 字段类型错误 |
| `INVALID_FORMAT` | 字段格式错误 |
| `INVALID_RANGE` | 字段值超出范围 |
| `INVALID_LENGTH` | 字段长度错误 |
| `INVALID_ENUM` | 枚举值无效 |
| `INVALID_PATTERN` | 正则匹配失败 |

## 文件操作错误

### 文件不存在

```json
{
  "success": false,
  "message": "文件不存在",
  "error_code": "FILE_NOT_FOUND",
  "errors": [
    {
      "field": "file_id",
      "message": "指定的文件不存在: 550e8400-e29b-41d4-a716-446655440000",
      "code": "FILE_NOT_FOUND"
    }
  ],
  "timestamp": "2024-01-15T08:30:00Z"
}
```

### 文件过大

```json
{
  "success": false,
  "message": "文件超过大小限制",
  "error_code": "FILE_TOO_LARGE",
  "errors": [
    {
      "field": "file",
      "message": "文件大小 150MB 超过最大限制 100MB",
      "code": "FILE_TOO_LARGE"
    }
  ],
  "timestamp": "2024-01-15T08:30:00Z"
}
```

### 文件已存在

```json
{
  "success": false,
  "message": "文件已存在",
  "error_code": "FILE_ALREADY_EXISTS",
  "errors": [
    {
      "field": "s3_key",
      "message": "文件已存在: markdown/document.md",
      "code": "FILE_ALREADY_EXISTS"
    }
  ],
  "timestamp": "2024-01-15T08:30:00Z"
}
```

## 认证错误

### 未提供认证

```json
{
  "success": false,
  "message": "未提供认证信息",
  "error_code": "UNAUTHORIZED",
  "errors": [],
  "timestamp": "2024-01-15T08:30:00Z"
}
```

### API Key 无效

```json
{
  "success": false,
  "message": "API Key 无效",
  "error_code": "INVALID_API_KEY",
  "errors": [],
  "timestamp": "2024-01-15T08:30:00Z"
}
```

### Token 过期

```json
{
  "success": false,
  "message": "Token 已过期",
  "error_code": "EXPIRED_TOKEN",
  "errors": [],
  "timestamp": "2024-01-15T08:30:00Z"
}
```

### 权限不足

```json
{
  "success": false,
  "message": "权限不足",
  "error_code": "INSUFFICIENT_PERMISSIONS",
  "errors": [],
  "timestamp": "2024-01-15T08:30:00Z"
}
```

## 服务器错误

### 内部错误

```json
{
  "success": false,
  "message": "服务器内部错误",
  "error_code": "INTERNAL_ERROR",
  "errors": [],
  "timestamp": "2024-01-15T08:30:00Z"
}
```

### 服务不可用

```json
{
  "success": false,
  "message": "服务暂时不可用，请稍后重试",
  "error_code": "SERVICE_UNAVAILABLE",
  "errors": [],
  "timestamp": "2024-01-15T08:30:00Z"
}
```

### 请求过于频繁

```json
{
  "success": false,
  "message": "请求过于频繁，请稍后重试",
  "error_code": "RATE_LIMITED",
  "errors": [],
  "timestamp": "2024-01-15T08:30:00Z"
}
```

## 错误处理示例

### Python

```python
import requests

class FileRendererError(Exception):
    def __init__(self, message, error_code, errors=None):
        super().__init__(message)
        self.error_code = error_code
        self.errors = errors or []

def handle_response(response):
    if response.status_code >= 400:
        data = response.json()
        raise FileRendererError(
            message=data.get("message", "Unknown error"),
            error_code=data.get("error_code", "UNKNOWN"),
            errors=data.get("errors", [])
        )
    return response.json()

def upload_file(file_path):
    try:
        response = requests.post(
            "http://localhost:8000/api/v1/files/upload",
            files={"file": open(file_path, "rb")}
        )
        return handle_response(response)
    except FileRendererError as e:
        if e.error_code == "FILE_TOO_LARGE":
            print("文件过大，请压缩后重试")
        elif e.error_code == "UNAUTHORIZED":
            print("认证失败，请检查 API Key")
        elif e.error_code == "RATE_LIMITED":
            print("请求过于频繁，请稍后重试")
        else:
            print(f"错误: {e.message} ({e.error_code})")
        raise
```

### JavaScript

```javascript
class FileRendererError extends Error {
  constructor(message, errorCode, errors = []) {
    super(message);
    this.errorCode = errorCode;
    this.errors = errors;
  }
}

async function handleResponse(response) {
  if (!response.ok) {
    const data = await response.json();
    throw new FileRendererError(
      data.message || "Unknown error",
      data.error_code || "UNKNOWN",
      data.errors || []
    );
  }
  return response.json();
}

async function uploadFile(file) {
  try {
    const response = await fetch("http://localhost:8000/api/v1/files/upload", {
      method: "POST",
      body: formData,
    });
    return await handleResponse(response);
  } catch (error) {
    if (error instanceof FileRendererError) {
      switch (error.errorCode) {
        case "FILE_TOO_LARGE":
          console.error("文件过大，请压缩后重试");
          break;
        case "UNAUTHORIZED":
          console.error("认证失败，请检查 API Key");
          break;
        case "RATE_LIMITED":
          console.error("请求过于频繁，请稍后重试");
          break;
        default:
          console.error(`错误: ${error.message} (${error.errorCode})`);
      }
    }
    throw error;
  }
}
```

## 调试建议

1. **检查 HTTP 状态码**：状态码可以快速定位问题类型
2. **查看错误代码**：错误代码提供精确的故障定位
3. **检查字段错误**：验证错误会指出具体的字段问题
4. **查看时间戳**：帮助追踪问题发生时间
5. **启用调试模式**：开发环境启用 `DEBUG=true` 获取详细错误信息

## 联系支持

如果遇到无法解决的错误：

1. 记录完整的错误响应
2. 记录请求参数（去除敏感信息）
3. 记录时间戳和请求 ID
4. 联系技术支持团队
