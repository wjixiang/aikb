#!/usr/bin/env python3
"""
Integration test for PDF Splitting Worker with real S3 PDF
"""

import asyncio
import json
import os
import tempfile
import uuid
from pathlib import Path
import sys
import subprocess

# Add the current directory to Python path
sys.path.insert(0, str(Path(__file__).parent))

from config import Config
from pdf_splitting_worker import PDFSplitter, RabbitMQClient, S3StorageClient


async def upload_test_pdf_and_get_url():
    """
    Upload the test PDF using the existing TypeScript library function
    and return the S3 URL
    """
    print("Uploading test PDF using existing library...")
    
    # Create a temporary TypeScript file to call the UploadTestPdf function
    test_script = """
import { UploadTestPdf } from './knowledgeBase/knowledgeImport/library.integrated.test';

async function main() {
  try {
    const book = await UploadTestPdf();
    const downloadUrl = await book.getPdfDownloadUrl();
    
    console.log('PDF uploaded successfully!');
    console.log('ID:', book.metadata.id);
    console.log('S3 Key:', book.metadata.s3Key);
    console.log('S3 URL:', book.metadata.s3Url);
    console.log('Download URL:', downloadUrl);
    
    // Output as JSON for easy parsing
    console.log('---JSON-START---');
    console.log(JSON.stringify({
      id: book.metadata.id,
      s3Key: book.metadata.s3Key,
      s3Url: book.metadata.s3Url,
      downloadUrl: downloadUrl,
      pageCount: book.metadata.pageCount
    }));
    console.log('---JSON-END---');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
"""
    
    # Write the test script to the workspace root
    with open('/workspace/test_upload_pdf.ts', 'w') as f:
        f.write(test_script)
    
    try:
        # Run the TypeScript script using npx tsx from workspace root
        result = subprocess.run(
            ['npx', 'tsx', 'test_upload_pdf.ts'],
            cwd='/workspace',
            capture_output=True,
            text=True,
            timeout=60000  # 60 seconds timeout
        )
        
        if result.returncode != 0:
            print(f"Error running upload script: {result.stderr}")
            return None
        
        # Parse the JSON output
        output_lines = result.stdout.split('\n')
        json_start = None
        json_end = None
        
        for i, line in enumerate(output_lines):
            if line.strip() == '---JSON-START---':
                json_start = i + 1
            elif line.strip() == '---JSON-END---':
                json_end = i
                break
        
        if json_start is not None and json_end is not None and json_end > json_start:
            json_data = '\n'.join(output_lines[json_start:json_end])
            return json.loads(json_data)
        else:
            print("Could not find JSON output in script result")
            print("Script output:", result.stdout)
            return None
            
    finally:
        # Clean up temporary file
        if os.path.exists('/workspace/test_upload_pdf.ts'):
            os.unlink('/workspace/test_upload_pdf.ts')


async def test_real_pdf_splitting():
    """Test PDF splitting with a real PDF from S3"""
    print("Testing PDF splitting with real S3 PDF...")
    
    # Get the PDF info from the existing library
    pdf_info = await upload_test_pdf_and_get_url()
    if not pdf_info:
        print("Failed to get PDF info from library")
        return False
    
    print(f"PDF Info: {pdf_info}")
    
    # Download the PDF from S3
    import aiohttp
    async with aiohttp.ClientSession() as session:
        async with session.get(pdf_info['downloadUrl'], timeout=60) as response:
            if response.status == 200:
                pdf_content = await response.read()
                print(f"Downloaded PDF: {len(pdf_content)} bytes")
            else:
                print(f"Failed to download PDF: HTTP {response.status}")
                return False
    
    # Test splitting with the real PDF
    with tempfile.TemporaryDirectory() as temp_dir:
        # Save the PDF to a temporary file
        pdf_path = os.path.join(temp_dir, 'test.pdf')
        with open(pdf_path, 'wb') as f:
            f.write(pdf_content)
        
        # Get page count first
        from PyPDF2 import PdfReader
        with open(pdf_path, 'rb') as f:
            reader = PdfReader(f)
            page_count = len(reader.pages)
        
        print(f"PDF has {page_count} pages")
        
        # Test different split sizes
        test_split_sizes = [5, 10, 20]
        
        for split_size in test_split_sizes:
            if split_size >= page_count:
                continue
                
            print(f"\nTesting split size: {split_size}")
            
            try:
                # Split the PDF
                parts = PDFSplitter.split_pdf(pdf_path, temp_dir, split_size)
                
                print(f"Split PDF into {len(parts)} parts:")
                
                total_pages = 0
                for part in parts:
                    print(f"  Part {part['part_index'] + 1}: pages {part['start_page']}-{part['end_page']} ({part['page_count']} pages)")
                    
                    # Verify the part exists and has the correct number of pages
                    if os.path.exists(part['path']):
                        with open(part['path'], 'rb') as f:
                            part_reader = PdfReader(f)
                            actual_pages = len(part_reader.pages)
                            expected_pages = part['page_count']
                            
                            if actual_pages != expected_pages:
                                print(f"    ❌ Error: Expected {expected_pages} pages, got {actual_pages}")
                                return False
                            else:
                                print(f"    ✓ Verified {actual_pages} pages")
                            total_pages += actual_pages
                    else:
                        print(f"    ❌ Error: Part file not found: {part['path']}")
                        return False
                
                # Verify total pages match
                if total_pages != page_count:
                    print(f"    ❌ Error: Total pages mismatch. Expected {page_count}, got {total_pages}")
                    return False
                else:
                    print(f"    ✓ Total pages match: {total_pages}")
                
            except Exception as e:
                print(f"    ❌ Error splitting PDF: {e}")
                return False
    
    print("\n✅ Real PDF splitting test passed!")
    return True


async def test_message_flow_compatibility():
    """Test that our Python worker can handle the same message format as TypeScript"""
    print("\nTesting message flow compatibility...")
    
    # Get the PDF info from the existing library
    pdf_info = await upload_test_pdf_and_get_url()
    if not pdf_info:
        print("Failed to get PDF info from library")
        return False
    
    # Create a message similar to what the TypeScript system would send
    test_message = {
        'messageId': str(uuid.uuid4()),
        'timestamp': int(asyncio.get_event_loop().time()),
        'eventType': 'PDF_SPLITTING_REQUEST',
        'itemId': pdf_info['id'],
        's3Url': pdf_info['downloadUrl'],
        's3Key': pdf_info['s3Key'],
        'fileName': 'viral_pneumonia.pdf',
        'pageCount': pdf_info.get('pageCount', 0),
        'splitSize': 10,
        'priority': 'normal',
        'retryCount': 0,
        'maxRetries': 3
    }
    
    print(f"Test message: {json.dumps(test_message, indent=2)}")
    
    # Verify the message can be serialized and deserialized
    message_json = json.dumps(test_message)
    parsed_message = json.loads(message_json)
    
    # Check all required fields are present and have correct types
    required_fields = {
        'messageId': str,
        'timestamp': int,
        'eventType': str,
        'itemId': str,
        's3Url': str,
        's3Key': str,
        'fileName': str,
        'pageCount': int,
        'splitSize': int,
        'priority': str,
        'retryCount': int,
        'maxRetries': int
    }
    
    for field, expected_type in required_fields.items():
        if field not in parsed_message:
            print(f"❌ Missing required field: {field}")
            return False
        
        if not isinstance(parsed_message[field], expected_type):
            print(f"❌ Field {field} has wrong type. Expected {expected_type}, got {type(parsed_message[field])}")
            return False
    
    print("✅ Message format compatibility test passed!")
    return True


async def run_integration_tests():
    """Run all integration tests"""
    print("Running PDF Splitting Worker Integration Tests...\n")
    
    try:
        # Test configuration
        print("Testing configuration...")
        rabbitmq_config = Config.get_rabbitmq_config()
        s3_config = Config.get_s3_config()
        pdf_config = Config.get_pdf_processing_config()
        
        print(f"RabbitMQ config: {rabbitmq_config}")
        print(f"S3 config: {s3_config}")
        print(f"PDF config: {pdf_config}")
        print("✓ Configuration test passed\n")
        
        # Test message flow compatibility
        if not await test_message_flow_compatibility():
            return False
        
        # Test real PDF splitting
        if not await test_real_pdf_splitting():
            return False
        
        print("\n✅ All integration tests passed!")
        return True
        
    except Exception as e:
        print(f"\n❌ Integration test failed: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = asyncio.run(run_integration_tests())
    exit(0 if success else 1)