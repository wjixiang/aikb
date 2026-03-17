"""
通用响应模型和错误模型

提供统一的 API 响应格式和错误处理模型
"""

from datetime import datetime
from typing import Any, Generic, TypeVar

from pydantic import BaseModel, Field


T = TypeVar("T")


class PaginationInfo(BaseModel):
    """分页信息"""

    total: int = Field(..., description="总记录数", examples=[100])
    limit: int = Field(..., description="每页数量", examples=[20])
    offset: int = Field(..., description="当前偏移量", examples=[0])
    has_next: bool = Field(..., description="是否有下一页", examples=[True])
    has_previous: bool = Field(..., description="是否有上一页", examples=[False])


class PaginationParams(BaseModel):
    """分页参数"""

    limit: int = Field(default=20, ge=1, le=100, description="每页数量", examples=[20])
    offset: int = Field(default=0, ge=0, description="偏移量", examples=[0])


class ApiResponse(BaseModel, Generic[T]):
    """通用 API 响应包装器

    所有成功响应的统一格式
    """

    success: bool = Field(
        default=True,
        description="请求是否成功",
        examples=[True]
    )
    message: str = Field(
        default="操作成功",
        description="响应消息",
        examples=["操作成功"]
    )
    data: T | None = Field(
        default=None,
        description="响应数据"
    )
    timestamp: datetime = Field(
        default_factory=datetime.utcnow,
        description="响应时间戳",
        examples=["2024-01-15T08:30:00Z"]
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "success": True,
                    "message": "操作成功",
                    "data": None,
                    "timestamp": "2024-01-15T08:30:00Z"
                }
            ]
        }
    }


class PaginatedResponse(ApiResponse, Generic[T]):
    """分页响应包装器

    包含分页信息的响应格式
    """

    data: list[T] = Field(
        default_factory=list,
        description="数据列表"
    )
    pagination: PaginationInfo = Field(
        ...,
        description="分页信息"
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "success": True,
                    "message": "获取成功",
                    "data": [],
                    "pagination": {
                        "total": 100,
                        "limit": 20,
                        "offset": 0,
                        "has_next": True,
                        "has_previous": False
                    },
                    "timestamp": "2024-01-15T08:30:00Z"
                }
            ]
        }
    }


class ErrorDetail(BaseModel):
    """错误详情"""

    field: str | None = Field(
        default=None,
        description="错误字段",
        examples=["file_id"]
    )
    message: str = Field(
        ...,
        description="错误信息",
        examples=["文件不存在"]
    )
    code: str | None = Field(
        default=None,
        description="错误代码",
        examples=["FILE_NOT_FOUND"]
    )


class ErrorResponse(BaseModel):
    """错误响应模型

    统一的错误响应格式
    """

    success: bool = Field(
        default=False,
        description="请求是否成功",
        examples=[False]
    )
    message: str = Field(
        ...,
        description="错误消息",
        examples=["请求参数错误"]
    )
    errors: list[ErrorDetail] = Field(
        default_factory=list,
        description="错误详情列表"
    )
    error_code: str | None = Field(
        default=None,
        description="错误代码",
        examples=["VALIDATION_ERROR"]
    )
    timestamp: datetime = Field(
        default_factory=datetime.utcnow,
        description="响应时间戳",
        examples=["2024-01-15T08:30:00Z"]
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "success": False,
                    "message": "请求参数错误",
                    "errors": [
                        {
                            "field": "file_id",
                            "message": "文件不存在",
                            "code": "FILE_NOT_FOUND"
                        }
                    ],
                    "error_code": "VALIDATION_ERROR",
                    "timestamp": "2024-01-15T08:30:00Z"
                }
            ]
        }
    }


class ValidationErrorResponse(ErrorResponse):
    """验证错误响应"""

    error_code: str = Field(
        default="VALIDATION_ERROR",
        description="错误代码"
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "success": False,
                    "message": "参数验证失败",
                    "errors": [
                        {
                            "field": "s3_key",
                            "message": "S3 key 不能为空",
                            "code": "REQUIRED_FIELD"
                        }
                    ],
                    "error_code": "VALIDATION_ERROR",
                    "timestamp": "2024-01-15T08:30:00Z"
                }
            ]
        }
    }


class NotFoundErrorResponse(ErrorResponse):
    """资源不存在错误响应"""

    error_code: str = Field(
        default="NOT_FOUND",
        description="错误代码"
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "success": False,
                    "message": "资源不存在",
                    "errors": [
                        {
                            "field": "file_id",
                            "message": "指定的文件不存在",
                            "code": "FILE_NOT_FOUND"
                        }
                    ],
                    "error_code": "NOT_FOUND",
                    "timestamp": "2024-01-15T08:30:00Z"
                }
            ]
        }
    }


class ServerErrorResponse(ErrorResponse):
    """服务器错误响应"""

    error_code: str = Field(
        default="INTERNAL_ERROR",
        description="错误代码"
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "success": False,
                    "message": "服务器内部错误",
                    "errors": [],
                    "error_code": "INTERNAL_ERROR",
                    "timestamp": "2024-01-15T08:30:00Z"
                }
            ]
        }
    }


class HealthStatus(BaseModel):
    """健康检查状态"""

    status: str = Field(
        ...,
        description="服务状态",
        examples=["healthy", "degraded", "unhealthy"]
    )
    version: str = Field(
        ...,
        description="服务版本",
        examples=["1.0.0"]
    )
    s3_connected: bool = Field(
        ...,
        description="S3 存储连接状态",
        examples=[True]
    )
    database_connected: bool = Field(
        ...,
        description="数据库连接状态",
        examples=[True]
    )
    timestamp: datetime = Field(
        default_factory=datetime.utcnow,
        description="检查时间戳",
        examples=["2024-01-15T08:30:00Z"]
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "status": "healthy",
                    "version": "1.0.0",
                    "s3_connected": True,
                    "database_connected": True,
                    "timestamp": "2024-01-15T08:30:00Z"
                }
            ]
        }
    }


class FileDeleteResponse(BaseModel):
    """文件删除响应"""

    success: bool = Field(
        ...,
        description="删除是否成功",
        examples=[True]
    )
    message: str = Field(
        ...,
        description="响应消息",
        examples=["文件删除成功"]
    )
    file_id: str = Field(
        ...,
        description="删除的文件ID",
        examples=["550e8400-e29b-41d4-a716-446655440000"]
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "success": True,
                    "message": "文件删除成功",
                    "file_id": "550e8400-e29b-41d4-a716-446655440000"
                }
            ]
        }
    }


class FileListResponse(BaseModel):
    """文件列表响应"""

    files: list[dict[str, Any]] = Field(
        default_factory=list,
        description="文件列表"
    )
    total: int = Field(
        ...,
        description="总记录数",
        examples=[100]
    )
    limit: int = Field(
        ...,
        description="每页数量",
        examples=[20]
    )
    offset: int = Field(
        ...,
        description="当前偏移量",
        examples=[0]
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "files": [],
                    "total": 0,
                    "limit": 20,
                    "offset": 0
                }
            ]
        }
    }


# 常用的 HTTP 状态码响应字典
HTTP_400_RESPONSE = {
    "description": "请求参数错误",
    "model": ValidationErrorResponse
}

HTTP_404_RESPONSE = {
    "description": "资源不存在",
    "model": NotFoundErrorResponse
}

HTTP_500_RESPONSE = {
    "description": "服务器内部错误",
    "model": ServerErrorResponse
}

# 常用的组合响应
COMMON_RESPONSES = {
    400: HTTP_400_RESPONSE,
    404: HTTP_404_RESPONSE,
    500: HTTP_500_RESPONSE
}

# 扩展响应组合
FILE_RESPONSES = {
    400: HTTP_400_RESPONSE,
    404: HTTP_404_RESPONSE,
    413: {
        "description": "文件过大",
        "model": ErrorResponse,
        "content": {
            "application/json": {
                "example": {
                    "success": False,
                    "message": "文件超过大小限制",
                    "error_code": "FILE_TOO_LARGE",
                    "errors": [],
                    "timestamp": "2024-01-15T08:30:00Z"
                }
            }
        }
    },
    500: HTTP_500_RESPONSE
}

# 认证错误响应
HTTP_401_RESPONSE = {
    "description": "未授权",
    "model": ErrorResponse,
    "content": {
        "application/json": {
            "example": {
                "success": False,
                "message": "认证失败，请提供有效的认证信息",
                "error_code": "UNAUTHORIZED",
                "errors": [],
                "timestamp": "2024-01-15T08:30:00Z"
            }
        }
    }
}

HTTP_403_RESPONSE = {
    "description": "禁止访问",
    "model": ErrorResponse,
    "content": {
        "application/json": {
            "example": {
                "success": False,
                "message": "没有权限访问此资源",
                "error_code": "FORBIDDEN",
                "errors": [],
                "timestamp": "2024-01-15T08:30:00Z"
            }
        }
    }
}

HTTP_409_RESPONSE = {
    "description": "资源冲突",
    "model": ErrorResponse,
    "content": {
        "application/json": {
            "example": {
                "success": False,
                "message": "资源已存在",
                "error_code": "CONFLICT",
                "errors": [],
                "timestamp": "2024-01-15T08:30:00Z"
            }
        }
    }
}

HTTP_422_RESPONSE = {
    "description": "无法处理的实体",
    "model": ValidationErrorResponse,
    "content": {
        "application/json": {
            "example": {
                "success": False,
                "message": "请求格式错误",
                "error_code": "VALIDATION_ERROR",
                "errors": [
                    {
                        "field": "email",
                        "message": "无效的邮箱格式",
                        "code": "INVALID_FORMAT"
                    }
                ],
                "timestamp": "2024-01-15T08:30:00Z"
            }
        }
    }
}

HTTP_429_RESPONSE = {
    "description": "请求过于频繁",
    "model": ErrorResponse,
    "content": {
        "application/json": {
            "example": {
                "success": False,
                "message": "请求过于频繁，请稍后重试",
                "error_code": "RATE_LIMITED",
                "errors": [],
                "timestamp": "2024-01-15T08:30:00Z"
            }
        }
    }
}

HTTP_503_RESPONSE = {
    "description": "服务不可用",
    "model": ErrorResponse,
    "content": {
        "application/json": {
            "example": {
                "success": False,
                "message": "服务暂时不可用，请稍后重试",
                "error_code": "SERVICE_UNAVAILABLE",
                "errors": [],
                "timestamp": "2024-01-15T08:30:00Z"
            }
        }
    }
}

# 完整的响应组合
ALL_RESPONSES = {
    400: HTTP_400_RESPONSE,
    401: HTTP_401_RESPONSE,
    403: HTTP_403_RESPONSE,
    404: HTTP_404_RESPONSE,
    409: HTTP_409_RESPONSE,
    422: HTTP_422_RESPONSE,
    429: HTTP_429_RESPONSE,
    500: HTTP_500_RESPONSE,
    503: HTTP_503_RESPONSE,
}

# 带认证的响应组合
AUTH_RESPONSES = {
    401: HTTP_401_RESPONSE,
    403: HTTP_403_RESPONSE,
}

# 完整的认证 + 通用响应组合
FULL_RESPONSES = {**ALL_RESPONSES}
