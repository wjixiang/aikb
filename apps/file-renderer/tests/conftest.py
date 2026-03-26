"""
Test configuration
"""

import pytest


@pytest.fixture
def sample_text():
    """Sample text for testing"""
    return """
    # Introduction

    Biomedical literature processing is an important task for evidence-based medicine.

    # Methods

    We developed a system for automatic extraction and analysis of biomedical documents.

    # Results

    The system successfully processed thousands of documents with high accuracy.

    # Discussion

    This approach can significantly improve the efficiency of literature review processes.
    """ * 10
