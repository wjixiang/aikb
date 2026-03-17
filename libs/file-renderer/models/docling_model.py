"""
Docling Service Models - 文件转换服务模型

提供完整的文件转换API模型，支持:
- 多种输入格式: PDF, DOCX, PPTX, XLSX, HTML, Markdown, TXT等
- 多种输出格式: Markdown, JSON, HTML, Text, Doctags
- 转换配置选项: OCR, 表格识别, 图片提取等
- 批量转换和进度追踪
"""

from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field, field_validator


class ConversionStatus(str, Enum):
    """转换状态枚举"""
    PENDING = "pending"
    PROCESSING = "processing"
    SUCCESS = "success"
    FAILED = "failed"
    NOT_FOUND = "not_found"
    CANCELLED = "cancelled"


class FileType(str, Enum):
    """支持的文件类型"""
    PDF = "pdf"
    DOCX = "docx"
    PPTX = "pptx"
    XLSX = "xlsx"
    CSV = "csv"
    HTML = "html"
    MARKDOWN = "markdown"
    TEXT = "text"
    XML = "xml"
    IMAGE = "image"
    JSON = "json"
    LATEX = "latex"
    UNKNOWN = "unknown"


class OutputFormat(str, Enum):
    """输出格式枚举"""
    MARKDOWN = "markdown"
    JSON = "json"
    HTML = "html"
    TEXT = "text"
    DOCTAGS = "doctags"


class ImageExportMode(str, Enum):
    """图片导出模式"""
    REFERENCED = "referenced"
    EMBEDDED = "embedded"
    OMITTED = "omitted"


# ============================================================================
# 转换配置模型
# ============================================================================

class OCRSettings(BaseModel):
    """OCR设置"""
    enabled: bool = Field(True, description="是否启用OCR")
    languages: list[str] = Field(
        default_factory=lambda: ["eng", "chi_sim"],
        description="OCR识别语言列表"
    )
    dpi: int = Field(300, description="OCR扫描DPI", ge=72, le=1200)


class TableExtractionSettings(BaseModel):
    """表格识别设置"""
    enabled: bool = Field(True, description="是否启用表格识别")
    export_format: str = Field("markdown", description="表格导出格式: markdown, html, csv")


class ImageExtractionSettings(BaseModel):
    """图片提取设置"""
    enabled: bool = Field(False, description="是否启用图片提取")
    export_mode: ImageExportMode = Field(ImageExportMode.REFERENCED, description="图片导出模式")
    max_image_size: int = Field(10 * 1024 * 1024, description="最大图片大小(字节)")


class StructureExtractionSettings(BaseModel):
    """文档结构提取设置"""
    enabled: bool = Field(True, description="是否启用结构提取")
    extract_headings: bool = Field(True, description="提取标题")
    extract_lists: bool = Field(True, description="提取列表")
    extract_tables: bool = Field(True, description="提取表格")


class PaginationSettings(BaseModel):
    """分页设置"""
    page_size: int = Field(4000, description="每页字符数", ge=100, le=50000)
    preserve_page_breaks: bool = Field(True, description="保留分页符")


class ConversionOptions(BaseModel):
    """转换选项"""
    ocr: OCRSettings = Field(default_factory=OCRSettings, description="OCR设置")
    table_extraction: TableExtractionSettings = Field(default_factory=TableExtractionSettings, description="表格识别设置")
    image_extraction: ImageExtractionSettings = Field(default_factory=ImageExtractionSettings, description="图片提取设置")
    structure: StructureExtractionSettings = Field(default_factory=StructureExtractionSettings, description="结构提取设置")
    pagination: PaginationSettings = Field(default_factory=PaginationSettings, description="分页设置")
    force_refresh: bool = Field(False, description="是否强制重新转换")
    timeout_seconds: int = Field(300, description="转换超时时间(秒)", ge=10, le=3600)


# ============================================================================
# 基础请求/响应模型
# ============================================================================

class ConvertRequest(BaseModel):
    """文件转换请求"""
    s3_key: str = Field(..., description="S3存储路径")
    output_format: OutputFormat = Field(OutputFormat.MARKDOWN, description="输出格式")
    options: ConversionOptions = Field(default_factory=ConversionOptions, description="转换选项")


class ConvertResponse(BaseModel):
    """文件转换响应"""
    success: bool = Field(..., description="是否成功")
    message: str = Field(..., description="状态消息")
    s3_key: str = Field(..., description="S3存储路径")
    file_name: str = Field(..., description="文件名")
    file_type: str = Field(..., description="文件类型")
    output_format: OutputFormat = Field(..., description="输出格式")
    status: ConversionStatus = Field(..., description="转换状态")
    total_pages: int = Field(0, description="总页数")
    processing_time_ms: float = Field(0.0, description="处理时间(毫秒)")
    error_message: str = Field("", description="错误信息（如果有）")


class ConvertFromUploadRequest(BaseModel):
    """从上传文件转换请求"""
    output_format: OutputFormat = Field(OutputFormat.MARKDOWN, description="输出格式")
    options: ConversionOptions = Field(default_factory=ConversionOptions, description="转换选项")


class ConvertFromUrlRequest(BaseModel):
    """从URL转换请求"""
    url: str = Field(..., description="文件URL")
    output_format: OutputFormat = Field(OutputFormat.MARKDOWN, description="输出格式")
    options: ConversionOptions = Field(default_factory=ConversionOptions, description="转换选项")

    @field_validator("url")
    @classmethod
    def validate_url(cls, v: str) -> str:
        if not v.startswith(("http://", "https://")):
            raise ValueError("URL必须以http://或https://开头")
        return v


class ConvertFromS3Request(BaseModel):
    """从S3转换请求"""
    s3_key: str = Field(..., description="S3存储路径")
    output_format: OutputFormat = Field(OutputFormat.MARKDOWN, description="输出格式")
    options: ConversionOptions = Field(default_factory=ConversionOptions, description="转换选项")


# ============================================================================
# 内容获取模型
# ============================================================================

class TextContentRequest(BaseModel):
    """获取文本内容请求"""
    s3_key: str = Field(..., description="S3存储路径")
    options: ConversionOptions = Field(default_factory=ConversionOptions, description="转换选项")


class TextContentResponse(BaseModel):
    """获取文本内容响应"""
    success: bool = Field(..., description="是否成功")
    s3_key: str = Field(..., description="S3存储路径")
    content: str = Field(..., description="完整文本内容")
    total_pages: int = Field(0, description="总页数")
    word_count: int = Field(0, description="字数")
    char_count: int = Field(0, description="字符数")


class PageContentRequest(BaseModel):
    """获取页面内容请求"""
    s3_key: str = Field(..., description="S3存储路径")
    page_number: int = Field(..., ge=1, description="页码（从1开始）")
    options: ConversionOptions = Field(default_factory=ConversionOptions, description="转换选项")


class PageContentResponse(BaseModel):
    """获取页面内容响应"""
    success: bool = Field(..., description="是否成功")
    s3_key: str = Field(..., description="S3存储路径")
    page_number: int = Field(..., description="当前页码")
    content: str = Field(..., description="页面内容")
    total_pages: int = Field(..., description="总页数")


class AllPagesRequest(BaseModel):
    """获取所有页面请求"""
    s3_key: str = Field(..., description="S3存储路径")
    options: ConversionOptions = Field(default_factory=ConversionOptions, description="转换选项")


class AllPagesResponse(BaseModel):
    """获取所有页面响应"""
    success: bool = Field(..., description="是否成功")
    s3_key: str = Field(..., description="S3存储路径")
    total_pages: int = Field(..., description="总页数")
    pages: dict[str, str] = Field(..., description="页面字典 {page_number: content}")


class ConversionResultRequest(BaseModel):
    """获取转换结果请求"""
    s3_key: str = Field(..., description="S3存储路径")
    output_format: OutputFormat = Field(OutputFormat.MARKDOWN, description="输出格式")


class ConversionResultResponse(BaseModel):
    """获取转换结果响应"""
    success: bool = Field(..., description="是否成功")
    s3_key: str = Field(..., description="S3存储路径")
    file_name: str = Field(..., description="文件名")
    file_type: str = Field(..., description="文件类型")
    output_format: OutputFormat = Field(..., description="输出格式")
    status: ConversionStatus = Field(..., description="转换状态")
    total_pages: int = Field(0, description="总页数")
    markdown: str = Field("", description="Markdown内容")
    json_content: dict = Field(default_factory=dict, description="JSON内容")
    html: str = Field("", description="HTML内容")
    text: str = Field("", description="纯文本内容")
    doctags: str = Field("", description="Doctags内容")
    metadata: dict = Field(default_factory=dict, description="文档元数据")
    images: list[dict] = Field(default_factory=list, description="图片信息列表")
    tables: list[dict] = Field(default_factory=list, description="表格信息列表")
    processing_time_ms: float = Field(0.0, description="处理时间(毫秒)")
    error_message: str = Field("", description="错误信息")


# ============================================================================
# 状态查询模型
# ============================================================================

class ConversionStatusRequest(BaseModel):
    """获取转换状态请求"""
    s3_key: str = Field(..., description="S3存储路径")


class ConversionStatusResponse(BaseModel):
    """获取转换状态响应"""
    success: bool = Field(..., description="是否成功")
    s3_key: str = Field(..., description="S3存储路径")
    status: ConversionStatus = Field(..., description="转换状态")
    is_converted: bool = Field(..., description="是否已转换")


class ConversionProgressData(BaseModel):
    """转换进度数据"""
    task_id: str = Field(..., description="任务ID")
    s3_key: str = Field(..., description="S3存储路径")
    status: ConversionStatus = Field(..., description="转换状态")
    progress_percent: float = Field(0.0, description="进度百分比", ge=0, le=100)
    current_page: int = Field(0, description="当前页码")
    total_pages: int = Field(0, description="总页数")
    message: str = Field("", description="进度消息")
    started_at: Optional[datetime] = Field(None, description="开始时间")
    updated_at: Optional[datetime] = Field(None, description="更新时间")
    completed_at: Optional[datetime] = Field(None, description="完成时间")


class ConversionProgressRequest(BaseModel):
    """获取转换进度请求"""
    task_id: str = Field(..., description="任务ID")


class ConversionProgressResponse(BaseModel):
    """获取转换进度响应"""
    success: bool = Field(..., description="是否成功")
    progress: ConversionProgressData = Field(..., description="进度数据")


# ============================================================================
# 批量转换模型
# ============================================================================

class BatchConvertRequest(BaseModel):
    """批量转换请求"""
    s3_keys: list[str] = Field(..., min_length=1, max_length=100, description="S3存储路径列表")
    output_format: OutputFormat = Field(OutputFormat.MARKDOWN, description="输出格式")
    options: ConversionOptions = Field(default_factory=ConversionOptions, description="转换选项")


class BatchConvertItem(BaseModel):
    """批量转换单项结果"""
    s3_key: str = Field(..., description="S3存储路径")
    file_name: str = Field(..., description="文件名")
    status: ConversionStatus = Field(..., description="转换状态")
    error_message: str = Field("", description="错误信息")
    processing_time_ms: float = Field(0.0, description="处理时间(毫秒)")


class BatchConvertResponse(BaseModel):
    """批量转换响应"""
    success: bool = Field(..., description="是否成功")
    batch_id: str = Field(..., description="批次ID")
    total_files: int = Field(..., description="总文件数")
    completed_files: int = Field(..., description="已完成文件数")
    failed_files: int = Field(..., description="失败文件数")
    pending_files: int = Field(..., description="待处理文件数")
    status: ConversionStatus = Field(..., description="批次状态")
    results: list[BatchConvertItem] = Field(default_factory=list, description="转换结果列表")
    created_at: datetime = Field(..., description="创建时间")
    completed_at: Optional[datetime] = Field(None, description="完成时间")


class BatchStatusRequest(BaseModel):
    """获取批量转换状态请求"""
    batch_id: str = Field(..., description="批次ID")


class BatchStatusResponse(BaseModel):
    """获取批量转换状态响应"""
    success: bool = Field(..., description="是否成功")
    batch_id: str = Field(..., description="批次ID")
    total_files: int = Field(..., description="总文件数")
    completed_files: int = Field(..., description="已完成文件数")
    failed_files: int = Field(..., description="失败文件数")
    pending_files: int = Field(..., description="待处理文件数")
    status: ConversionStatus = Field(..., description="批次状态")
    created_at: datetime = Field(..., description="创建时间")
    completed_at: Optional[datetime] = Field(None, description="完成时间")


# ============================================================================
# 缓存管理模型
# ============================================================================

class InvalidateCacheRequest(BaseModel):
    """使缓存失效请求"""
    s3_key: str = Field(..., description="S3存储路径")


class InvalidateCacheResponse(BaseModel):
    """使缓存失效响应"""
    success: bool = Field(..., description="是否成功")
    s3_key: str = Field(..., description="S3存储路径")
    message: str = Field(..., description="操作结果消息")


class CacheStats(BaseModel):
    """缓存统计信息"""
    total_entries: int = Field(..., description="总缓存条目数")
    total_size_bytes: int = Field(..., description="总缓存大小(字节)")
    oldest_entry: Optional[datetime] = Field(None, description="最早缓存时间")
    newest_entry: Optional[datetime] = Field(None, description="最新缓存时间")


class CacheStatsResponse(BaseModel):
    """缓存统计响应"""
    success: bool = Field(..., description="是否成功")
    stats: CacheStats = Field(..., description="缓存统计信息")


# ============================================================================
# 格式信息模型
# ============================================================================

class OutputFormatInfo(BaseModel):
    """输出格式信息"""
    format: str = Field(..., description="格式名称")
    description: str = Field(..., description="格式描述")
    mime_type: str = Field(..., description="MIME类型")


class SupportedFormatsResponse(BaseModel):
    """支持的文件格式响应"""
    success: bool = Field(True, description="是否成功")
    input_formats: dict[str, list[str]] = Field(..., description="输入格式分类字典")
    output_formats: list[OutputFormatInfo] = Field(..., description="输出格式列表")


# ============================================================================
# 错误响应模型
# ============================================================================

class ConversionErrorResponse(BaseModel):
    """转换错误响应"""
    success: bool = Field(False, description="是否成功")
    error_code: str = Field(..., description="错误代码")
    message: str = Field(..., description="错误消息")
    details: dict = Field(default_factory=dict, description="错误详情")


# ============================================================================
# Docling 专用模型 (简化版，用于直接API)
# ============================================================================

class DoclingConvertRequest(BaseModel):
    """Docling转换请求 - 简化版"""
    output_format: OutputFormat = Field(OutputFormat.MARKDOWN, description="输出格式")
    do_ocr: bool = Field(True, description="是否启用OCR")
    do_table_structure: bool = Field(True, description="是否启用表格结构识别")
    do_picture_description: bool = Field(False, description="是否启用图片描述")
    do_picture_classification: bool = Field(False, description="是否启用图片分类")
    timeout_seconds: int = Field(300, description="转换超时时间(秒)", ge=10, le=3600)


class DoclingConvertResponse(BaseModel):
    """Docling转换响应"""
    success: bool = Field(..., description="是否成功")
    task_id: str = Field(..., description="任务ID")
    s3_key: str = Field(..., description="S3存储路径")
    file_name: str = Field(..., description="文件名")
    output_format: OutputFormat = Field(..., description="输出格式")
    status: ConversionStatus = Field(..., description="转换状态")
    content: str = Field("", description="转换后的内容")
    metadata: dict = Field(default_factory=dict, description="文档元数据")
    processing_time_ms: float = Field(0.0, description="处理时间(毫秒)")
    error_message: str = Field("", description="错误信息")


class DoclingBatchRequest(BaseModel):
    """Docling批量转换请求"""
    s3_keys: list[str] = Field(..., min_length=1, max_length=100, description="S3存储路径列表")
    output_format: OutputFormat = Field(OutputFormat.MARKDOWN, description="输出格式")
    do_ocr: bool = Field(True, description="是否启用OCR")
    do_table_structure: bool = Field(True, description="是否启用表格结构识别")
    do_picture_description: bool = Field(False, description="是否启用图片描述")
    do_picture_classification: bool = Field(False, description="是否启用图片分类")


class DoclingTaskStatus(BaseModel):
    """Docling任务状态"""
    task_id: str = Field(..., description="任务ID")
    status: ConversionStatus = Field(..., description="转换状态")
    progress_percent: float = Field(0.0, description="进度百分比", ge=0, le=100)
    current_page: int = Field(0, description="当前页码")
    total_pages: int = Field(0, description="总页数")
    message: str = Field("", description="状态消息")
    created_at: Optional[datetime] = Field(None, description="创建时间")
    updated_at: Optional[datetime] = Field(None, description="更新时间")
    completed_at: Optional[datetime] = Field(None, description="完成时间")
    result: Optional[dict] = Field(None, description="转换结果")


class DoclingConfig(BaseModel):
    """Docling转换配置"""
    do_ocr: bool = Field(True, description="是否启用OCR")
    do_table_structure: bool = Field(True, description="是否启用表格结构识别")
    do_picture_description: bool = Field(False, description="是否启用图片描述")
    do_picture_classification: bool = Field(False, description="是否启用图片分类")
    ocr_languages: list[str] = Field(
        default_factory=lambda: ["eng", "chi_sim"],
        description="OCR识别语言列表"
    )
    max_file_size: int = Field(100 * 1024 * 1024, description="最大文件大小(字节)")
    timeout_seconds: int = Field(300, description="转换超时时间(秒)")


class DoclingUrlRequest(BaseModel):
    """Docling URL转换请求"""
    url: str = Field(..., description="文件URL")
    output_format: OutputFormat = Field(OutputFormat.MARKDOWN, description="输出格式")
    do_ocr: bool = Field(True, description="是否启用OCR")
    do_table_structure: bool = Field(True, description="是否启用表格结构识别")
    do_picture_description: bool = Field(False, description="是否启用图片描述")
    do_picture_classification: bool = Field(False, description="是否启用图片分类")

    @field_validator("url")
    @classmethod
    def validate_url(cls, v: str) -> str:
        if not v.startswith(("http://", "https://")):
            raise ValueError("URL必须以http://或https://开头")
        return v


class DoclingS3Request(BaseModel):
    """Docling S3转换请求"""
    s3_key: str = Field(..., description="S3存储路径")
    output_format: OutputFormat = Field(OutputFormat.MARKDOWN, description="输出格式")
    do_ocr: bool = Field(True, description="是否启用OCR")
    do_table_structure: bool = Field(True, description="是否启用表格结构识别")
    do_picture_description: bool = Field(False, description="是否启用图片描述")
    do_picture_classification: bool = Field(False, description="是否启用图片分类")


class DoclingStatusResponse(BaseModel):
    """Docling状态查询响应"""
    success: bool = Field(..., description="是否成功")
    task: DoclingTaskStatus = Field(..., description="任务状态")


class DoclingResultResponse(BaseModel):
    """Docling结果查询响应"""
    success: bool = Field(..., description="是否成功")
    task_id: str = Field(..., description="任务ID")
    status: ConversionStatus = Field(..., description="转换状态")
    content: str = Field("", description="转换后的内容")
    metadata: dict = Field(default_factory=dict, description="文档元数据")
    images: list[dict] = Field(default_factory=list, description="图片信息列表")
    tables: list[dict] = Field(default_factory=list, description="表格信息列表")
    processing_time_ms: float = Field(0.0, description="处理时间(毫秒)")
    error_message: str = Field("", description="错误信息")
