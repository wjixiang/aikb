"""
S3 Key Generator - 统一的 S3 Key 生成工具
"""

import re
import uuid
from datetime import datetime
from typing import Literal

# 支持的文件类型
FileType = Literal["pdf", "markdown", "text", "html", "csv", "xml", "json", "binary", "files"]

# 默认配置
DEFAULT_PREFIX = "files"


def sanitize_filename(filename: str) -> str:
    """
    清理文件名，移除或替换非法字符

    Args:
        filename: 原始文件名

    Returns:
        清理后的文件名
    """
    # 替换空格为下划线，移除非法 S3 字符
    sanitized = re.sub(r'[^\w\-.]', '_', filename)
    # 避免连续的下划线
    sanitized = re.sub(r'_+', '_', sanitized)
    # 移除首尾的下划线和连字符
    sanitized = sanitized.strip('_-')
    return sanitized


def generate_s3_key(
    file_type: FileType,
    original_filename: str,
    prefix: str = DEFAULT_PREFIX,
) -> str:
    """
    生成 S3 Key

    格式: {prefix}/{type}/{year}/{month}/{day}/{uuid}-{sanitized_name}

    Args:
        file_type: 文件类型 (pdf/markdown/text/html/csv/xml/json/binary/files)
        original_filename: 原始文件名
        prefix: S3 路径前缀，默认 "files"

    Returns:
        生成的 S3 Key

    Example:
        >>> generate_s3_key("pdf", "my document.pdf")
        'files/pdf/2026/03/15/abc123-def456-my_document.pdf'
    """
    now = datetime.now()
    year = now.strftime("%Y")
    month = now.strftime("%m")
    day = now.strftime("%d")

    unique_id = str(uuid.uuid4())[:8]
    sanitized_name = sanitize_filename(original_filename)

    return f"{prefix}/{file_type}/{year}/{month}/{day}/{unique_id}/{sanitized_name}"


# 便捷函数，针对常见文件类型
def generate_pdf_key(filename: str, prefix: str = DEFAULT_PREFIX) -> str:
    """生成 PDF 文件的 S3 Key"""
    return generate_s3_key("pdf", filename, prefix)


def generate_markdown_key(filename: str, prefix: str = DEFAULT_PREFIX) -> str:
    """生成 Markdown 文件的 S3 Key"""
    return generate_s3_key("markdown", filename, prefix)


def generate_text_key(filename: str, prefix: str = DEFAULT_PREFIX) -> str:
    """生成 Text 文件的 S3 Key"""
    return generate_s3_key("text", filename, prefix)


def generate_html_key(filename: str, prefix: str = DEFAULT_PREFIX) -> str:
    """生成 HTML 文件的 S3 Key"""
    return generate_s3_key("html", filename, prefix)


def generate_csv_key(filename: str, prefix: str = DEFAULT_PREFIX) -> str:
    """生成 CSV 文件的 S3 Key"""
    return generate_s3_key("csv", filename, prefix)


def generate_xml_key(filename: str, prefix: str = DEFAULT_PREFIX) -> str:
    """生成 XML 文件的 S3 Key"""
    return generate_s3_key("xml", filename, prefix)


def generate_json_key(filename: str, prefix: str = DEFAULT_PREFIX) -> str:
    """生成 JSON 文件的 S3 Key"""
    return generate_s3_key("json", filename, prefix)


def generate_binary_key(filename: str, prefix: str = DEFAULT_PREFIX) -> str:
    """生成 Binary 文件的 S3 Key"""
    return generate_s3_key("binary", filename, prefix)


def generate_file_key(filename: str, prefix: str = DEFAULT_PREFIX) -> str:
    """生成通用文件(上传)的 S3 Key"""
    # 从文件名推断类型
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    type_map = {
        "pdf": "pdf",
        "md": "markdown",
        "txt": "text",
        "html": "html",
        "htm": "html",
        "csv": "csv",
        "xml": "xml",
        "json": "json",
    }
    file_type = type_map.get(ext, "binary")
    return generate_s3_key(file_type, filename, prefix)
