"""DXClient 自定义异常层级。"""


from __future__ import annotations

from typing import Any


class DXClientError(Exception):
    """DXClient 基础异常。"""

    def __init__(self, message: str, *, dx_error: Exception | None = None) -> None:
        self.dx_error = dx_error
        super().__init__(message)


class DXAuthError(DXClientError):
    """认证失败（无效或缺失 token）。"""


class DXProjectNotFoundError(DXClientError):
    """项目不存在或无权访问。"""


class DXFileNotFoundError(DXClientError):
    """文件不存在。"""


class DXDatabaseNotFoundError(DXClientError):
    """数据库不存在或未找到。"""


class DXAPIError(DXClientError):
    """DNAnexus API 调用失败。"""

    def __init__(
        self,
        message: str,
        *,
        status_code: int = 0,
        error_type: str = "",
        dx_error: Exception | None = None,
    ) -> None:
        self.status_code = status_code
        self.error_type = error_type
        super().__init__(message, dx_error=dx_error)


class DXCohortError(DXClientError):
    """Cohort 创建/操作失败。"""


class DXVizserverError(DXClientError):
    """Vizserver API 调用失败。"""


class DXJobError(DXClientError):
    """Job 操作失败（等待超时等）。"""


class DXConfigError(DXClientError):
    """客户端配置无效。"""


# ── Standalone utility functions ────────────────────────────────────────────


def translate_dx_error(e: Exception, context: str) -> None:
    """将 dxpy 异常转换为 DXClientError 层级。

    Vizserver 相关模块使用此函数替代实例方法。
    """
    from dxpy.exceptions import DXAPIError as DxPyDXAPIError
    from dxpy.exceptions import DXError as DxPyDXError

    if isinstance(e, DxPyDXAPIError):
        status_code = getattr(e, "status", 0)
        error_name = getattr(e, "name", "")
        msg = f"{context}: {e}"
        if status_code == 401 or "auth" in error_name.lower():
            raise DXAuthError(msg, dx_error=e) from e
        if status_code == 404 or "not found" in str(e).lower():
            raise DXFileNotFoundError(msg, dx_error=e) from e
        raise DXAPIError(
            msg, status_code=status_code, error_type=error_name, dx_error=e,
        ) from e
    if isinstance(e, DxPyDXError):
        raise DXClientError(f"{context}: {e}", dx_error=e) from e
    raise DXClientError(f"{context}: {e}", dx_error=e) from e


def check_vizserver_response(resp: dict[str, Any], context: str) -> None:
    """检查 vizserver 响应是否包含错误，抛出相应异常。"""
    if resp.get("error"):
        raise DXCohortError(f"{context}: {resp['error']}")
    # Vizserver 也可能返回 isError: true
    if resp.get("isError") or resp.get("is_error"):
        msg = resp.get("message") or resp.get("error") or "Unknown vizserver error"
        raise DXCohortError(f"{context}: {msg}")
