"""
S3 Key Generator Unit Tests
"""

import re
from datetime import datetime

import pytest

from lib.s3_key_generator import (
    sanitize_filename,
    generate_s3_key,
    generate_pdf_key,
    generate_markdown_key,
    generate_text_key,
    generate_html_key,
    generate_csv_key,
    generate_xml_key,
    generate_json_key,
    generate_binary_key,
    generate_tex_key,
    generate_file_key,
)


class TestSanitizeFilename:
    """sanitize_filename function tests"""

    def test_sanitize_spaces(self):
        """Test sanitizing filename with spaces"""
        result = sanitize_filename("my document.pdf")
        assert " " not in result
        assert "_" in result

    def test_sanitize_special_chars(self):
        """Test sanitizing filename with special characters"""
        result = sanitize_filename("file@#$%^&*()name.pdf")
        # Should replace special chars with underscore
        assert "@" not in result
        assert "#" not in result

    def test_sanitize_multiple_underscores(self):
        """Test that multiple consecutive underscores are collapsed"""
        result = sanitize_filename("file___name.pdf")
        assert "___" not in result

    def test_sanitize_leading_trailing(self):
        """Test removing leading/trailing underscores and hyphens"""
        result = sanitize_filename("_-filename-_.pdf")
        assert not result.startswith("_")
        assert not result.startswith("-")
        assert not result.endswith("_")
        assert not result.endswith("-")

    def test_sanitize_unicode(self):
        """Test sanitizing unicode filename"""
        result = sanitize_filename("\u4e2d\u6587\u6587\u4ef6.pdf")
        # Unicode characters might be kept or replaced depending on regex
        assert result.endswith(".pdf")

    def test_sanitize_empty(self):
        """Test sanitizing empty filename"""
        result = sanitize_filename("")
        assert result == ""

    def test_sanitize_only_special(self):
        """Test sanitizing filename with only special characters"""
        result = sanitize_filename("@#$%^&*")
        # Should result in empty or minimal string
        assert result == "" or "_" not in result


class TestGenerateS3Key:
    """generate_s3_key function tests"""

    def test_generate_s3_key_structure(self):
        """Test generated key structure"""
        result = generate_s3_key("pdf", "document.pdf")

        # Should follow pattern: {prefix}/{type}/{year}/{month}/{day}/{uuid}/{sanitized_name}
        parts = result.split("/")
        assert len(parts) == 7
        assert parts[0] == "files"
        assert parts[1] == "pdf"
        # Year should be 4 digits
        assert re.match(r"^\d{4}$", parts[2])
        # Month should be 2 digits
        assert re.match(r"^\d{2}$", parts[3])
        # Day should be 2 digits
        assert re.match(r"^\d{2}$", parts[4])
        # UUID should be 8 characters
        assert re.match(r"^[a-f0-9]{8}$", parts[5])
        # Filename should end with .pdf
        assert parts[6].endswith(".pdf")

    def test_generate_s3_key_custom_prefix(self):
        """Test generating key with custom prefix"""
        result = generate_s3_key("pdf", "document.pdf", prefix="custom")

        assert result.startswith("custom/pdf/")

    def test_generate_s3_key_sanitizes_filename(self):
        """Test that filename is sanitized"""
        result = generate_s3_key("pdf", "my document@#$%.pdf")

        assert "@" not in result
        assert "#" not in result
        assert "$" not in result
        assert "%" not in result

    def test_generate_s3_key_different_types(self):
        """Test generating keys for different file types"""
        types = ["pdf", "markdown", "text", "html", "csv", "xml", "json", "binary", "tex", "files"]

        for file_type in types:
            result = generate_s3_key(file_type, "test.file")
            assert file_type in result

    def test_generate_s3_key_unique_uuids(self):
        """Test that different calls generate different UUIDs"""
        result1 = generate_s3_key("pdf", "document.pdf")
        result2 = generate_s3_key("pdf", "document.pdf")

        # UUID part should be different
        uuid1 = result1.split("/")[5]
        uuid2 = result2.split("/")[5]
        assert uuid1 != uuid2

    def test_generate_s3_key_current_date(self):
        """Test that key uses current date"""
        now = datetime.now()
        result = generate_s3_key("pdf", "document.pdf")

        parts = result.split("/")
        assert parts[2] == now.strftime("%Y")
        assert parts[3] == now.strftime("%m")
        assert parts[4] == now.strftime("%d")


class TestGenerateTypeSpecificKeys:
    """Type-specific key generator tests"""

    def test_generate_pdf_key(self):
        """Test generate_pdf_key"""
        result = generate_pdf_key("document.pdf")
        assert "pdf" in result
        assert result.endswith("document.pdf")

    def test_generate_markdown_key(self):
        """Test generate_markdown_key"""
        result = generate_markdown_key("notes.md")
        assert "markdown" in result
        assert result.endswith("notes.md")

    def test_generate_text_key(self):
        """Test generate_text_key"""
        result = generate_text_key("readme.txt")
        assert "text" in result
        assert result.endswith("readme.txt")

    def test_generate_html_key(self):
        """Test generate_html_key"""
        result = generate_html_key("page.html")
        assert "html" in result
        assert result.endswith("page.html")

    def test_generate_csv_key(self):
        """Test generate_csv_key"""
        result = generate_csv_key("data.csv")
        assert "csv" in result
        assert result.endswith("data.csv")

    def test_generate_xml_key(self):
        """Test generate_xml_key"""
        result = generate_xml_key("config.xml")
        assert "xml" in result
        assert result.endswith("config.xml")

    def test_generate_json_key(self):
        """Test generate_json_key"""
        result = generate_json_key("data.json")
        assert "json" in result
        assert result.endswith("data.json")

    def test_generate_binary_key(self):
        """Test generate_binary_key"""
        result = generate_binary_key("app.bin")
        assert "binary" in result
        assert result.endswith("app.bin")

    def test_generate_tex_key(self):
        """Test generate_tex_key"""
        result = generate_tex_key("paper.tex")
        assert "tex" in result
        assert result.endswith("paper.tex")


class TestGenerateFileKey:
    """generate_file_key function tests"""

    def test_generate_file_key_pdf(self):
        """Test generate_file_key with PDF extension"""
        result = generate_file_key("document.pdf")
        assert "pdf" in result

    def test_generate_file_key_markdown(self):
        """Test generate_file_key with markdown extensions"""
        result_md = generate_file_key("notes.md")
        assert "markdown" in result_md

    def test_generate_file_key_text(self):
        """Test generate_file_key with text extension"""
        result = generate_file_key("readme.txt")
        assert "text" in result

    def test_generate_file_key_html(self):
        """Test generate_file_key with HTML extensions"""
        result_html = generate_file_key("page.html")
        result_htm = generate_file_key("page.htm")
        assert "html" in result_html
        assert "html" in result_htm

    def test_generate_file_key_csv(self):
        """Test generate_file_key with CSV extension"""
        result = generate_file_key("data.csv")
        assert "csv" in result

    def test_generate_file_key_xml(self):
        """Test generate_file_key with XML extension"""
        result = generate_file_key("config.xml")
        assert "xml" in result

    def test_generate_file_key_json(self):
        """Test generate_file_key with JSON extension"""
        result = generate_file_key("data.json")
        assert "json" in result

    def test_generate_file_key_unknown(self):
        """Test generate_file_key with unknown extension"""
        result = generate_file_key("unknown.xyz")
        assert "binary" in result

    def test_generate_file_key_no_extension(self):
        """Test generate_file_key without extension"""
        result = generate_file_key("README")
        assert "binary" in result

    def test_generate_file_key_custom_prefix(self):
        """Test generate_file_key with custom prefix"""
        result = generate_file_key("document.pdf", prefix="uploads")
        assert result.startswith("uploads/pdf/")


class TestS3KeyGeneratorEdgeCases:
    """S3 key generator edge case tests"""

    def test_generate_s3_key_empty_filename(self):
        """Test generating key with empty filename"""
        result = generate_s3_key("pdf", "")
        assert "pdf" in result
        # Should still have proper structure
        parts = result.split("/")
        assert len(parts) == 7

    def test_generate_s3_key_very_long_filename(self):
        """Test generating key with very long filename"""
        long_name = "a" * 200 + ".pdf"
        result = generate_s3_key("pdf", long_name)
        assert result.endswith(".pdf")

    def test_generate_s3_key_multiple_dots(self):
        """Test generating key with multiple dots in filename"""
        result = generate_s3_key("pdf", "archive.tar.gz")
        assert "archive.tar.gz" in result or "archive_tar.gz" in result

    def test_generate_file_key_case_insensitive(self):
        """Test that file type detection is case insensitive"""
        result_upper = generate_file_key("DOCUMENT.PDF")
        result_lower = generate_file_key("document.pdf")
        # Both should map to pdf type
        assert "pdf" in result_upper
        assert "pdf" in result_lower
