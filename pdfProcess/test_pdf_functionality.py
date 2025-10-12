#!/usr/bin/env python3
"""
Test script to verify PDF splitting functionality without RabbitMQ
"""

import os
import sys
import tempfile
from PyPDF2 import PdfReader, PdfWriter
from config import Config

def create_test_pdf(output_path: str, num_pages: int = 10):
    """Create a simple test PDF with multiple pages"""
    writer = PdfWriter()
    
    for i in range(num_pages):
        # Create a simple page with text
        from reportlab.pdfgen import canvas
        from reportlab.lib.pagesizes import letter
        
        temp_page = tempfile.NamedTemporaryFile(suffix='.pdf', delete=False)
        c = canvas.Canvas(temp_page.name, pagesize=letter)
        c.drawString(100, 750, f"Test Page {i + 1}")
        c.drawString(100, 700, f"This is page {i + 1} of {num_pages}")
        c.drawString(100, 650, f"Content for page {i + 1}")
        c.save()
        
        # Read the temporary page and add to writer
        with open(temp_page.name, 'rb') as f:
            reader = PdfReader(f)
            writer.add_page(reader.pages[0])
        
        os.unlink(temp_page.name)
    
    # Save the final PDF
    with open(output_path, 'wb') as f:
        writer.write(f)
    
    print(f"✅ Created test PDF with {num_pages} pages: {output_path}")

def test_pdf_splitting():
    """Test PDF splitting functionality"""
    print("🧪 Testing PDF splitting functionality...")
    
    # Create temporary directory
    with tempfile.TemporaryDirectory() as temp_dir:
        # Create test PDF
        test_pdf_path = os.path.join(temp_dir, 'test.pdf')
        create_test_pdf(test_pdf_path, 10)
        
        # Import the PDF splitter
        sys.path.append(os.path.dirname(__file__))
        from pdf_splitting_worker import PDFSplitter
        
        # Test splitting
        print("📄 Splitting PDF into parts of 3 pages each...")
        splitter = PDFSplitter()
        
        try:
            result = splitter.split_pdf(
                test_pdf_path,
                temp_dir,
                3    # split size
            )
            
            print(f"✅ PDF split successfully!")
            print(f"   Total parts: {len(result)}")
            print(f"   Parts created:")
            
            for part in result:
                part_file = os.path.join(temp_dir, f"part_{part['part_index'] + 1:03d}.pdf")
                if os.path.exists(part_file):
                    # Verify the part has correct number of pages
                    with open(part_file, 'rb') as f:
                        reader = PdfReader(f)
                        actual_pages = len(reader.pages)
                        expected_pages = part['page_count']
                        
                        print(f"     Part {part['part_index'] + 1}: pages {part['start_page']}-{part['end_page']} ({actual_pages} pages) ✅")
                        
                        if actual_pages != expected_pages:
                            print(f"       ❌ Expected {expected_pages} pages, got {actual_pages}")
                            return False
                else:
                    print(f"     ❌ Part {part['part_index'] + 1} file not found!")
                    return False
            
            return True
            
        except Exception as e:
            print(f"❌ PDF splitting failed: {e}")
            return False

def test_rabbitmq_connection():
    """Test RabbitMQ connection"""
    print("🔗 Testing RabbitMQ connection...")
    
    try:
        import pika
        from config import Config
        
        # Test connection
        connection = pika.BlockingConnection(
            pika.URLParameters(Config.RABBITMQ_URL)
        )
        channel = connection.channel()
        
        # Test queue access
        channel.queue_declare(
            queue='pdf-splitting-request',
            durable=True,
            passive=True
        )
        
        connection.close()
        print("✅ RabbitMQ connection successful!")
        return True
        
    except Exception as e:
        print(f"❌ RabbitMQ connection failed: {e}")
        return False

def main():
    """Main test function"""
    print("🚀 Python PDF Splitting Worker Test Suite")
    print("=" * 50)
    
    # Test PDF splitting functionality
    pdf_test_passed = test_pdf_splitting()
    print()
    
    # Test RabbitMQ connection
    rabbitmq_test_passed = test_rabbitmq_connection()
    print()
    
    # Summary
    print("📊 Test Results:")
    print(f"   PDF Splitting: {'✅ PASSED' if pdf_test_passed else '❌ FAILED'}")
    print(f"   RabbitMQ Connection: {'✅ PASSED' if rabbitmq_test_passed else '❌ FAILED'}")
    
    if pdf_test_passed and rabbitmq_test_passed:
        print("\n🎉 All tests passed! Python PDF Splitting Worker is ready!")
        return 0
    else:
        print("\n❌ Some tests failed. Check the logs above.")
        return 1

if __name__ == "__main__":
    sys.exit(main())