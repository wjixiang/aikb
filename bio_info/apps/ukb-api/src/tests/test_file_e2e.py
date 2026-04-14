"""文件端点 E2E 测试。"""

from __future__ import annotations

import os
from pathlib import Path
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from ukb_api.main import app
from ukb_api.api.deps import get_dx_client
from dx_client import DXClient, DXClientConfig, DXFileInfo


@pytest.fixture
def mock_dx_client():
    client = MagicMock(spec=DXClient)
    client.is_connected = True
    client.current_project_id = "project-test123"

    file_info = DXFileInfo(
        id="file-test123",
        name="test_file.txt",
        project="project-test123",
        folder="/test",
        state="complete",
        size=1024,
        created=1700000000,
        modified=1700000000,
        md5="d41d8cd98f00b204e9800998ecf8427e",
    )

    client.list_files.return_value = [file_info]
    client.describe_file.return_value = file_info
    client.upload_file.return_value = file_info
    client.download_file.return_value = Path("/tmp/test_file.txt")

    return client


@pytest.fixture
def client(mock_dx_client):
    def _override():
        return mock_dx_client

    app.dependency_overrides[get_dx_client] = _override
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def test_list_files(client, mock_dx_client):
    response = client.get("/api/v1/file/")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    mock_dx_client.list_files.assert_called_once()


def test_get_file_info(client, mock_dx_client):
    response = client.get("/api/v1/file/file-test123")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == "file-test123"
    assert data["name"] == "test_file.txt"
    mock_dx_client.describe_file.assert_called_once_with("file-test123", refresh=False)


def test_file_not_found(client, mock_dx_client):
    mock_dx_client.describe_file.side_effect = Exception("File not found")
    response = client.get("/api/v1/file/nonexistent")
    assert response.status_code == 500
