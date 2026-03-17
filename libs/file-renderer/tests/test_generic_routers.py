"""
Generic File Routers API Tests (Text, JSON, HTML, XML, CSV, Binary, TeX)
"""

import pytest


class TestTextRouter:
    """Text router endpoint tests"""

    def test_create_text_success(self, client, mock_storage_service):
        """Test creating text file"""
        mock_storage_service.upload.return_value = "http://example.com/files/text/2026/03/17/test.txt"

        response = client.post("/text/create", json={
            "fileName": "test.txt"
        })

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["content_type"] == "text/plain"
        mock_storage_service.upload.assert_called_once()

    def test_create_text_storage_error(self, client, mock_storage_service):
        """Test creating text file with storage error"""
        mock_storage_service.upload.side_effect = Exception("S3 error")

        response = client.post("/text/create", json={
            "fileName": "test.txt"
        })

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is False


class TestJsonRouter:
    """JSON router endpoint tests"""

    def test_create_json_success(self, client, mock_storage_service):
        """Test creating JSON file"""
        mock_storage_service.upload.return_value = "http://example.com/files/json/2026/03/17/test.json"

        response = client.post("/json/create", json={
            "fileName": "test.json"
        })

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["content_type"] == "application/json"

    def test_create_json_storage_error(self, client, mock_storage_service):
        """Test creating JSON file with storage error"""
        mock_storage_service.upload.side_effect = Exception("S3 error")

        response = client.post("/json/create", json={
            "fileName": "test.json"
        })

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is False


class TestHtmlRouter:
    """HTML router endpoint tests"""

    def test_create_html_success(self, client, mock_storage_service):
        """Test creating HTML file"""
        mock_storage_service.upload.return_value = "http://example.com/files/html/2026/03/17/test.html"

        response = client.post("/html/create", json={
            "fileName": "test.html"
        })

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["content_type"] == "text/html"

    def test_create_html_storage_error(self, client, mock_storage_service):
        """Test creating HTML file with storage error"""
        mock_storage_service.upload.side_effect = Exception("S3 error")

        response = client.post("/html/create", json={
            "fileName": "test.html"
        })

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is False


class TestXmlRouter:
    """XML router endpoint tests"""

    def test_create_xml_success(self, client, mock_storage_service):
        """Test creating XML file"""
        mock_storage_service.upload.return_value = "http://example.com/files/xml/2026/03/17/test.xml"

        response = client.post("/xml/create", json={
            "fileName": "test.xml"
        })

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["content_type"] == "application/xml"

    def test_create_xml_storage_error(self, client, mock_storage_service):
        """Test creating XML file with storage error"""
        mock_storage_service.upload.side_effect = Exception("S3 error")

        response = client.post("/xml/create", json={
            "fileName": "test.xml"
        })

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is False


class TestCsvRouter:
    """CSV router endpoint tests"""

    def test_create_csv_success(self, client, mock_storage_service):
        """Test creating CSV file"""
        mock_storage_service.upload.return_value = "http://example.com/files/csv/2026/03/17/test.csv"

        response = client.post("/csv/create", json={
            "fileName": "test.csv"
        })

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["content_type"] == "text/csv"

    def test_create_csv_storage_error(self, client, mock_storage_service):
        """Test creating CSV file with storage error"""
        mock_storage_service.upload.side_effect = Exception("S3 error")

        response = client.post("/csv/create", json={
            "fileName": "test.csv"
        })

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is False


class TestBinaryRouter:
    """Binary router endpoint tests"""

    def test_create_binary_success(self, client, mock_storage_service):
        """Test creating binary file"""
        mock_storage_service.upload.return_value = "http://example.com/files/binary/2026/03/17/test.bin"

        response = client.post("/binary/create", json={
            "fileName": "test.bin"
        })

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["content_type"] == "application/octet-stream"

    def test_create_binary_storage_error(self, client, mock_storage_service):
        """Test creating binary file with storage error"""
        mock_storage_service.upload.side_effect = Exception("S3 error")

        response = client.post("/binary/create", json={
            "fileName": "test.bin"
        })

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is False


class TestTexRouter:
    """TeX router endpoint tests"""

    def test_create_tex_success(self, client, mock_storage_service):
        """Test creating TeX file"""
        mock_storage_service.upload.return_value = "http://example.com/files/tex/2026/03/17/test.tex"

        response = client.post("/tex/create", json={
            "fileName": "test.tex"
        })

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["content_type"] == "application/x-tex"

    def test_create_tex_storage_error(self, client, mock_storage_service):
        """Test creating TeX file with storage error"""
        mock_storage_service.upload.side_effect = Exception("S3 error")

        response = client.post("/tex/create", json={
            "fileName": "test.tex"
        })

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is False


class TestGenericRouterEdgeCases:
    """Generic router edge case tests"""

    def test_create_file_empty_filename(self, client, mock_storage_service):
        """Test creating file with empty filename"""
        mock_storage_service.upload.return_value = "http://example.com/files/text/2026/03/17/.txt"

        response = client.post("/text/create", json={
            "fileName": ""
        })

        assert response.status_code == 200
        assert response.json()["success"] is True

    def test_create_file_unicode_filename(self, client, mock_storage_service):
        """Test creating file with unicode filename"""
        mock_storage_service.upload.return_value = "http://example.com/files/text/2026/03/17/test.txt"

        response = client.post("/text/create", json={
            "fileName": "\u4e2d\u6587\u6587\u4ef6.txt"
        })

        assert response.status_code == 200

    def test_create_file_special_chars(self, client, mock_storage_service):
        """Test creating file with special characters in filename"""
        mock_storage_service.upload.return_value = "http://example.com/files/text/2026/03/17/test_file.txt"

        response = client.post("/text/create", json={
            "fileName": "test file with spaces & symbols.txt"
        })

        assert response.status_code == 200

    def test_all_routers_return_same_structure(self, client, mock_storage_service):
        """Test that all create endpoints return consistent structure"""
        mock_storage_service.upload.return_value = "http://example.com/files/test"

        routers = ["/text/create", "/json/create", "/html/create", "/xml/create",
                   "/csv/create", "/binary/create", "/tex/create", "/pdf/create"]

        for router in routers:
            response = client.post(router, json={"fileName": "test.file"})
            assert response.status_code == 200
            data = response.json()
            assert "success" in data
            assert "message" in data
            assert "s3_key" in data
            assert "content_type" in data
            assert "file_size" in data
