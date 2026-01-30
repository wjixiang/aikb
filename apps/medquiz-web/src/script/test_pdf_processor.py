import os
import sys
import base64
import fitz  # PyMuPDF
from pathlib import Path

# Add project root to Python path
project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.append(project_root)

try:
    from kgrag.notebook_chunking.textbook_pdf_split import PDFProcessor
except ImportError:
    from src.kgrag.notebook_chunking.textbook_pdf_split import PDFProcessor

def create_test_pdf(path):
    """Create a simple test PDF if it doesn't exist"""
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((100, 100), "Test PDF Page", fontsize=50)
    doc.save(path)
    doc.close()

def test_page_to_image():
    # Test PDF paths to try (in order)
    test_paths = [
       "/Users/a123/Documents/GitHub/MedQuiz/notebook/26医客考研-内科学讲义-风湿中毒-合并.pdf"
    ]
    
    pdf_path = None
    for path in test_paths:
        if os.path.exists(path):
            pdf_path = path
            break
    
    if not pdf_path:
        # Create test PDF if none exists
        pdf_path = "test_data/test.pdf"
        os.makedirs(os.path.dirname(pdf_path), exist_ok=True)
        create_test_pdf(pdf_path)
        print(f"Created test PDF at: {pdf_path}")

    output_dir = "output/images"
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    
    try:
        print(f"Testing with PDF: {pdf_path}")
        with PDFProcessor(pdf_path) as processor:
            # Test first page conversion
            page_num = 1
            base64_img = processor.page_to_image(page_num)
            
            # Verify base64 output
            assert base64_img.startswith("data:image/png;base64,"), "Invalid base64 image format"
            
            # Save the image for visual verification
            output_path = os.path.join(output_dir, f"page_{page_num+1}.png")
            with open(output_path, "wb") as f:
                f.write(base64.b64decode(base64_img.split(",")[1]))
            
            print(f"Successfully converted page {page_num+1} to image")
            print(f"Image saved to: {output_path}")
            
    except Exception as e:
        print(f"Error processing PDF: {e}")
        raise

if __name__ == "__main__":
    test_page_to_image()