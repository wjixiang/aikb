"""
XML Router API Tests

Tests for the XML file creation router.
"""

import pytest
from fastapi.testclient import TestClient


class TestXmlRouterCreate:
    """Tests for XML file creation endpoint"""

    def test_create_xml_success(self, client: TestClient, mock_storage_service):
        """Test creating XML file successfully"""
        mock_storage_service.upload.return_value = "http://example.com/files/xml/2026/03/17/test.xml"

        response = client.post("/api/v1/xml/create", json={
            "fileName": "test.xml"
        })

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["message"] == "File created successfully"
        assert data["content_type"] == "application/xml"
        assert data["file_size"] == 0
        assert "s3_key" in data
        mock_storage_service.upload.assert_called_once()

    def test_create_xml_with_custom_name(self, client: TestClient, mock_storage_service):
        """Test creating XML file with custom name"""
        mock_storage_service.upload.return_value = "http://example.com/files/xml/2026/03/17/config.xml"

        response = client.post("/api/v1/xml/create", json={
            "fileName": "my-config.xml"
        })

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

    def test_create_xml_storage_error(self, client: TestClient, mock_storage_service):
        """Test creating XML file when storage fails"""
        mock_storage_service.upload.side_effect = Exception("S3 connection error")

        response = client.post("/api/v1/xml/create", json={
            "fileName": "test.xml"
        })

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is False
        assert "failed" in data["message"].lower()

    def test_create_xml_missing_filename(self, client: TestClient):
        """Test creating XML file without filename"""
        response = client.post("/api/v1/xml/create", json={
            "fileType": "xml"
        })

        assert response.status_code == 422

    def test_create_xml_common_names(self, client: TestClient, mock_storage_service):
        """Test creating common XML file names"""
        names = ["config.xml", "settings.xml", "manifest.xml", "pom.xml", "web.xml"]

        for name in names:
            mock_storage_service.reset_mock()
            mock_storage_service.upload.return_value = f"http://example.com/files/xml/{name}"

            response = client.post("/api/v1/xml/create", json={
                "fileName": name
            })

            assert response.status_code == 200
            assert response.json()["success"] is True


class TestXmlRouterResponseStructure:
    """Tests for response structure consistency"""

    def test_response_structure(self, client: TestClient, mock_storage_service):
        """Test that response has all required fields"""
        mock_storage_service.upload.return_value = "http://example.com/files/xml/test.xml"

        response = client.post("/api/v1/xml/create", json={
            "fileName": "test.xml"
        })

        assert response.status_code == 200
        data = response.json()

        assert "success" in data
        assert "message" in data
        assert "s3_key" in data
        assert "content_type" in data
        assert "file_size" in data

    def test_success_response_values(self, client: TestClient, mock_storage_service):
        """Test success response values"""
        mock_storage_service.upload.return_value = "http://example.com/files/xml/test.xml"

        response = client.post("/api/v1/xml/create", json={
            "fileName": "test.xml"
        })

        data = response.json()
        assert data["success"] is True
        assert data["content_type"] == "application/xml"
        assert data["file_size"] == 0


class TestXmlRouterContentType:
    """Tests for content type handling"""

    def test_content_type_is_application_xml(self, client: TestClient, mock_storage_service):
        """Test that content type is application/xml"""
        mock_storage_service.upload.return_value = "http://example.com/files/xml/test.xml"

        response = client.post("/api/v1/xml/create", json={
            "fileName": "test.xml"
        })

        data = response.json()
        assert data["content_type"] == "application/xml"

        call_kwargs = mock_storage_service.upload.call_args[1]
        assert call_kwargs["content_type"] == "application/xml"
