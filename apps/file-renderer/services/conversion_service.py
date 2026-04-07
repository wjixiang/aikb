"""
Document conversion service using Docling

Handles PDF to text/markdown conversion with optional OCR.
"""

import logging
from typing import Optional

from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import OcrOptions, PdfPipelineOptions
from docling.document_converter import DocumentConverter, FormatOption, PdfFormatOption
from docling_core.types.doc.document import TitleItem

from config import settings

logger = logging.getLogger(__name__)


def _extract_metadata(result) -> dict:
    """Extract metadata from a Docling conversion result."""
    title = None
    for item in result.document.texts:
        if isinstance(item, TitleItem):
            title = item.text
            break
    return {
        "pages": len(result.document.pages),
        "format": str(result.input.format),
        "title": title,
    }


class ConversionService:
    """Service for converting documents to text/markdown"""

    def __init__(self):
        """Initialize the conversion service"""
        self.converter = self._create_converter()
        logger.info("ConversionService initialized")

    def _create_converter(self) -> DocumentConverter:
        """Create a configured Docling document converter"""
        # Configure PDF pipeline options
        pipeline_options = PdfPipelineOptions()

        # OCR settings
        pipeline_options.do_ocr = settings.conversion.enable_ocr
        pipeline_options.ocr_options = OcrOptions(
            lang=settings.conversion.ocr_languages,
        )

        # Table extraction
        pipeline_options.do_table_structure = (
            settings.conversion.enable_table_extraction
        )

        # Other options
        pipeline_options.generate_page_images = False  # We don't need images
        pipeline_options.generate_picture_images = False

        # Create format options
        format_options: dict[InputFormat, FormatOption] = {
            InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_options),
        }

        return DocumentConverter(format_options=format_options)

    def convert_pdf_to_text(
        self,
        file_path: str,
        enable_ocr: Optional[bool] = None,
    ) -> tuple[str, dict]:
        """
        Convert PDF to plain text

        Args:
            file_path: Path to PDF file
            enable_ocr: Override OCR setting

        Returns:
            Tuple of (text content, metadata)
        """
        logger.info(f"Converting PDF to text: {file_path}")

        try:
            # Convert document
            result = self.converter.convert(file_path)

            # Export to text
            text_content = result.document.export_to_markdown()

            # Extract metadata
            metadata = _extract_metadata(result)

            logger.info(f"Successfully converted PDF: {len(text_content)} chars")
            return text_content, metadata

        except Exception as e:
            logger.error(f"Error converting PDF to text: {e}", exc_info=True)
            raise

    def convert_pdf_to_markdown(
        self,
        file_path: str,
        enable_ocr: Optional[bool] = None,
        preserve_layout: bool = False,
    ) -> tuple[str, dict]:
        """
        Convert PDF to Markdown

        Args:
            file_path: Path to PDF file
            enable_ocr: Override OCR setting
            preserve_layout: Preserve original document layout

        Returns:
            Tuple of (markdown content, metadata)
        """
        logger.info(f"Converting PDF to markdown: {file_path}")

        try:
            # Convert document
            result = self.converter.convert(file_path)

            # Export to markdown
            markdown_content = result.document.export_to_markdown()

            # Extract metadata
            metadata = {
                **_extract_metadata(result),
                "tables": len(result.document.tables),
                "figures": len(result.document.pictures),
            }

            logger.info(
                f"Successfully converted PDF to markdown: {len(markdown_content)} chars"
            )
            return markdown_content, metadata

        except Exception as e:
            logger.error(f"Error converting PDF to markdown: {e}", exc_info=True)
            raise

    def convert_document(
        self,
        file_path: str,
        output_format: str = "markdown",
        **options,
    ) -> tuple[str, dict]:
        """
        Convert document to specified format

        Args:
            file_path: Path to document file
            output_format: Output format (text, markdown, json)
            **options: Additional conversion options

        Returns:
            Tuple of (content, metadata)
        """
        logger.info(f"Converting document to {output_format}: {file_path}")

        if output_format == "text":
            return self.convert_pdf_to_text(file_path, **options)
        elif output_format == "markdown":
            return self.convert_pdf_to_markdown(file_path, **options)
        else:
            raise ValueError(f"Unsupported output format: {output_format}")


# Singleton instance
_conversion_service: Optional[ConversionService] = None


def get_conversion_service() -> ConversionService:
    """Get or create conversion service singleton"""
    global _conversion_service
    if _conversion_service is None:
        _conversion_service = ConversionService()
    return _conversion_service
