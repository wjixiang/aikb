"""
Integration tests for the API
"""

import pytest
from fastapi.testclient import TestClient

from main import app


@pytest.mark.integration
def test_health_check():
    """Test health check endpoint"""
    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"


@pytest.mark.integration
def test_root_endpoint():
    """Test root endpoint"""
    client = TestClient(app)
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "name" in data
    assert "version" in data


@pytest.mark.integration
def test_list_formats():
    """Test list formats endpoint"""
    client = TestClient(app)
    response = client.get("/api/v1/conversion/formats")
    assert response.status_code == 200
    data = response.json()
    assert "formats" in data
    assert len(data["formats"]) > 0


@pytest.mark.integration
def test_chunk_text():
    """Test chunking endpoint"""
    client = TestClient(app)
    request_data = {
        "text": "This is a test. " * 100,
        "chunking_strategy": "fixed",
        "chunk_size": 200,
        "chunk_overlap": 50,
    }
    response = client.post("/api/v1/chunking/chunk", json=request_data)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert len(data["chunks"]) > 0
    assert data["chunk_count"] > 0
