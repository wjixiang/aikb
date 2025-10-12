#!/usr/bin/env python3
"""
Test script for PDF Splitting Worker
"""

import asyncio
import json
import os
import tempfile
import uuid
from pathlib import Path

from PyPDF2 import PdfReader, PdfWriter
from pdf_splitting_worker import PDFSplitter, RabbitMQClient, S3StorageClient


def create_test_pdf(output_path: str, num_pages: int = 10):
    """Create a test PDF file with specified number of pages"""
    writer = PdfWriter()
    
    # Create a simple page for each page
    for i in range(num_pages):
        # Create a simple PDF page with text
        from reportlab.pdfgen import canvas
        from reportlab.lib.pagesizes import letter
        
        # Create a temporary PDF for each page
        temp_pdf = tempfile.NamedTemporaryFile(suffix='.pdf', delete=False)
        try:
            c = canvas.Canvas(temp_pdf.name, pagesize=letter)
            c.drawString(100, 750, f"Test Page {i + 1}")
            c.drawString(100, 700, f"This is page {i + 1} of {num_pages}")
            c.save()
            
            # Read the temporary PDF and add its page to our main PDF
            with open(temp_pdf.name, 'rb') as f:
                temp_reader = PdfReader(f)
                if len(temp_reader.pages) > 0:
                    writer.add_page(temp_reader.pages[0])
        finally:
            os.unlink(temp_pdf.name)
    
    # Save the final PDF
    with open(output_path, 'wb') as f:
        writer.write(f)
    
    print(f"Created test PDF with {num_pages} pages: {output_path}")


def test_pdf_splitting():
    """Test the PDF splitting functionality"""
    print("Testing PDF splitting functionality...")
    
    with tempfile.TemporaryDirectory() as temp_dir:
        # Create a test PDF
        test_pdf_path = os.path.join(temp_dir, 'test.pdf')
        create_test_pdf(test_pdf_path, 15)
        
        # Test splitting
        split_size = 5
        parts = PDFSplitter.split_pdf(test_pdf_path, temp_dir, split_size)
        
        print(f"Split PDF into {len(parts)} parts:")
        for part in parts:
            print(f"  Part {part['part_index'] + 1}: pages {part['start_page']}-{part['end_page']} ({part['page_count']} pages)")
            
            # Verify the part exists and has the correct number of pages
            if os.path.exists(part['path']):
                with open(part['path'], 'rb') as f:
                    reader = PdfReader(f)
                    actual_pages = len(reader.pages)
                    expected_pages = part['page_count']
                    assert actual_pages == expected_pages, f"Expected {expected_pages} pages, got {actual_pages}"
                    print(f"    ✓ Verified {actual_pages} pages")
            else:
                raise Exception(f"Part file not found: {part['path']}")
    
    print("✓ PDF splitting test passed")


def test_message_format():
    """Test message format compatibility"""
    print("Testing message format compatibility...")
    
    # Create a test message similar to what the TypeScript worker would send
    test_message = {
        'messageId': str(uuid.uuid4()),
        'timestamp': 1234567890,
        'eventType': 'PDF_SPLITTING_REQUEST',
        'itemId': 'test-item-123',
        's3Url': 'https://example.com/test.pdf',
        's3Key': 'test/test.pdf',
        'fileName': 'test.pdf',
        'pageCount': 15,
        'splitSize': 5,
        'priority': 'normal',
        'retryCount': 0,
        'maxRetries': 3
    }
    
    # Verify the message can be serialized and deserialized
    message_json = json.dumps(test_message)
    parsed_message = json.loads(message_json)
    
    # Check all required fields are present
    required_fields = [
        'messageId', 'timestamp', 'eventType', 'itemId', 's3Url', 's3Key',
        'fileName', 'pageCount', 'splitSize', 'priority', 'retryCount', 'maxRetries'
    ]
    
    for field in required_fields:
        assert field in parsed_message, f"Missing required field: {field}"
    
    # Verify field types match expectations
    assert isinstance(parsed_message['messageId'], str)
    assert isinstance(parsed_message['timestamp'], int)
    assert isinstance(parsed_message['eventType'], str)
    assert isinstance(parsed_message['itemId'], str)
    assert isinstance(parsed_message['s3Url'], str)
    assert isinstance(parsed_message['s3Key'], str)
    assert isinstance(parsed_message['fileName'], str)
    assert isinstance(parsed_message['pageCount'], int)
    assert isinstance(parsed_message['splitSize'], int)
    assert isinstance(parsed_message['priority'], str)
    assert isinstance(parsed_message['retryCount'], int)
    assert isinstance(parsed_message['maxRetries'], int)
    
    print("✓ Message format test passed")


def test_config():
    """Test configuration loading"""
    print("Testing configuration...")
    
    from config import Config
    
    # Test default values (updated to match existing project configuration)
    assert Config.RABBITMQ_HOST == 'rabbitmq'  # Updated to match existing .env
    assert Config.RABBITMQ_PORT == 5672
    assert Config.DEFAULT_SPLIT_SIZE == 25
    assert Config.MAX_RETRIES == 3
    
    # Test config dictionaries
    rabbitmq_config = Config.get_rabbitmq_config()
    assert 'host' in rabbitmq_config
    assert 'port' in rabbitmq_config
    assert 'username' in rabbitmq_config
    assert 'password' in rabbitmq_config
    assert 'virtual_host' in rabbitmq_config
    
    s3_config = Config.get_s3_config()
    assert 'bucket' in s3_config
    assert 'region' in s3_config
    
    pdf_config = Config.get_pdf_processing_config()
    assert 'default_split_size' in pdf_config
    assert 'max_split_size' in pdf_config
    assert 'min_split_size' in pdf_config
    assert 'concurrent_part_processing' in pdf_config
    
    worker_config = Config.get_worker_config()
    assert 'worker_id' in worker_config
    assert 'log_level' in worker_config
    assert 'max_retries' in worker_config
    assert 'temp_dir' in worker_config
    
    print("✓ Configuration test passed")


async def test_rabbitmq_client():
    """Test RabbitMQ client (mock test since we don't have a real RabbitMQ server)"""
    print("Testing RabbitMQ client (mock)...")
    
    # Test with mock configuration
    rabbitmq_config = {
        'host': 'localhost',
        'port': 5672,
        'username': 'guest',
        'password': 'guest',
        'virtual_host': '/',
    }
    
    client = RabbitMQClient(rabbitmq_config)
    
    # Test that the client can be instantiated
    assert client.connection_params == rabbitmq_config
    assert client.connection is None
    assert client.channel is None
    assert client.consumer_tag is None
    
    print("✓ RabbitMQ client test passed (mock)")


async def test_s3_client():
    """Test S3 client (mock test since we don't have real S3 credentials)"""
    print("Testing S3 client (mock)...")
    
    s3_config = {
        'bucket': 'test-bucket',
        'region': 'us-east-1',
        'access_key': 'test-key',
        'secret_key': 'test-secret',
        'endpoint': '',
    }
    
    client = S3StorageClient(s3_config)
    
    # Test that the client can be instantiated
    assert client.config == s3_config
    
    print("✓ S3 client test passed (mock)")


def run_all_tests():
    """Run all tests"""
    print("Running PDF Splitting Worker tests...\n")
    
    try:
        # Test basic functionality
        test_config()
        test_message_format()
        test_pdf_splitting()
        
        # Test async components
        asyncio.run(test_rabbitmq_client())
        asyncio.run(test_s3_client())
        
        print("\n✅ All tests passed!")
        return True
        
    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = run_all_tests()
    exit(0 if success else 1)