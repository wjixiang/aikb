"""
S3 Key Generator - Unified S3 key generation utility
"""

import re
import uuid
from datetime import datetime
from typing import Literal

FileType = Literal["pdf", "markdown", "text", "html", "csv", "xml", "json", "binary"]

DEFAULT_PREFIX = "files"


def sanitize_filename(filename: str) -> str:
    """Sanitize filename by removing or replacing illegal characters."""
    sanitized = re.sub(r"[^\w\-.]", "_", filename)
    sanitized = re.sub(r"_+", "_", sanitized)
    sanitized = sanitized.strip("_-")
    return sanitized


def generate_s3_key(
    file_type: FileType,
    original_filename: str,
    prefix: str = DEFAULT_PREFIX,
) -> str:
    """
    Generate an S3 key.

    Format: {prefix}/{type}/{year}/{month}/{day}/{uuid}/{sanitized_name}

    Example:
        >>> generate_s3_key("pdf", "my document.pdf")
        'files/pdf/2026/04/07/abc12345/my_document.pdf'
    """
    now = datetime.now()
    unique_id = str(uuid.uuid4())[:8]
    sanitized_name = sanitize_filename(original_filename)
    return f"{prefix}/{file_type}/{now:%Y/%m/%d}/{unique_id}/{sanitized_name}"


def generate_pdf_key(filename: str, prefix: str = DEFAULT_PREFIX) -> str:
    return generate_s3_key("pdf", filename, prefix)


def generate_markdown_key(filename: str, prefix: str = DEFAULT_PREFIX) -> str:
    return generate_s3_key("markdown", filename, prefix)


def generate_text_key(filename: str, prefix: str = DEFAULT_PREFIX) -> str:
    return generate_s3_key("text", filename, prefix)


def derive_output_key(input_s3_key: str, output_format: str = "markdown") -> str:
    """
    Derive the output S3 key from an input key.

    Example:
        >>> derive_output_key("files/pdf/2026/04/07/abc123/paper.pdf", "markdown")
        'files/markdown/2026/04/07/abc123/paper.md'
    """
    parts = input_s3_key.split("/")
    # Replace the type segment (2nd segment) with the output type
    if len(parts) >= 2:
        parts[1] = output_format
    # Replace file extension
    if parts:
        name = parts[-1]
        base = name.rsplit(".", 1)[0] if "." in name else name
        ext_map = {"markdown": "md", "text": "txt", "json": "json"}
        parts[-1] = f"{base}.{ext_map.get(output_format, output_format)}"
    return "/".join(parts)
