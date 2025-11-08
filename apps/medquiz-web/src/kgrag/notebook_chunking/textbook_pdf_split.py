import fitz  # PyMuPDF
import base64
from typing import List, Optional
from pathlib import Path

class PDFProcessor:
    """
    A class for processing PDF files with capabilities to convert pages to images.
    """
    
    def __init__(self, pdf_path: str):
        """
        Initialize the PDF processor with a PDF file path.
        
        Args:
            pdf_path: Path to the PDF file to process
        """
        self.pdf_path = Path(pdf_path)
        if not self.pdf_path.exists():
            raise FileNotFoundError(f"PDF file not found: {pdf_path}")
        
        self.doc = fitz.open(self.pdf_path)
    
    def page_to_image(self, page_num: int, dpi: int = 300) -> str:
        """
        Convert a specified PDF page to a base64 encoded PNG image.
        
        Args:
            page_num: Page number to convert (1-based index)
            dpi: Resolution in dots per inch for the output image
            
        Returns:
            Base64 encoded string of the PNG image
            
        Raises:
            ValueError: If page number is out of range
        """
        if page_num < 1 or page_num > len(self.doc):
            raise ValueError(f"Invalid page number {page_num}. Document has {len(self.doc)} pages.")
        
        # Get the page (convert to 0-based index)
        page = self.doc[page_num - 1]
        
        # Render page to an image (pixmap)
        zoom = dpi / 72  # 72 is the default DPI of PDF
        mat = fitz.Matrix(zoom, zoom)
        pix = page.get_pixmap(matrix=mat)
        
        # Convert to bytes then to base64
        image_bytes = pix.tobytes("png")
        return f"data:image/png;base64,{base64.b64encode(image_bytes).decode('utf-8')}"
    
    def close(self):
        """Close the PDF document when done."""
        if hasattr(self, 'doc'):
            self.doc.close()
    
    def __enter__(self):
        """Support context manager protocol."""
        return self
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Ensure document is closed when exiting context."""
        self.close()

    def extract_text(self, page_num: int) -> str:
        """
        Extract text from specified PDF page.
        
        Args:
            page_num: Page number to extract text from (1-based index)
            
        Returns:
            Extracted text content
            
        Raises:
            ValueError: If page number is out of range
        """
        if page_num < 1 or page_num > len(self.doc):
            raise ValueError(f"Invalid page number {page_num}. Document has {len(self.doc)} pages.")
            
        # Get the page (convert to 0-based index)
        page = self.doc[page_num - 1]
        return page.get_text()

    def extract_pages(self, page_nums: List[int], output_path: str) -> str:
        """
        Extract specified pages to a new PDF file.
        
        Args:
            page_nums: List of page numbers to extract (1-based index)
            output_path: Path to save the extracted PDF
            
        Returns:
            Path to the created PDF file
            
        Raises:
            ValueError: If any page number is out of range
            IOError: If output file cannot be written
        """
        # Validate page numbers
        for page_num in page_nums:
            if page_num < 1 or page_num > len(self.doc):
                raise ValueError(
                    f"Invalid page number {page_num}. Document has {len(self.doc)} pages."
                )
        
        # Create new PDF
        new_doc = fitz.open()
        
        # Insert selected pages
        for page_num in page_nums:
            new_doc.insert_pdf(self.doc, from_page=page_num-1, to_page=page_num-1)
        
        # Save the new PDF
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        new_doc.save(output_path)
        new_doc.close()
        
        return str(output_path)

    def extract_page(self, page_num: int, output_path: Optional[str] = None) -> str:
        """
        Extract a single page, optionally saving to file and/or returning as base64.
        
        Args:
            page_num: Page number to extract (1-based index)
            output_path: Optional path to save the extracted PDF. If None, won't save to file.
            
        Returns:
            Base64 encoded string of the PDF if output_path is None,
            otherwise returns the saved file path
            
        Raises:
            ValueError: If page number is out of range
            IOError: If output file cannot be written
        """
        # Validate page number
        if page_num < 1 or page_num > len(self.doc):
            raise ValueError(
                f"Invalid page number {page_num}. Document has {len(self.doc)} pages."
            )
        
        # Create new PDF with just this page
        new_doc = fitz.open()
        new_doc.insert_pdf(self.doc, from_page=page_num-1, to_page=page_num-1)
        
        # Save to file if path provided
        if output_path is not None:
            output_path = Path(output_path)
            output_path.parent.mkdir(parents=True, exist_ok=True)
            new_doc.save(output_path)
            new_doc.close()
            return str(output_path)
        
        # Return as base64
        pdf_bytes = new_doc.tobytes()
        new_doc.close()
        return f"data:application/pdf;base64,{base64.b64encode(pdf_bytes).decode('utf-8')}"

    def extract_page(self, page_num: int, output_path: str) -> str:
        """
        Extract a single page to a new PDF file.
        
        Args:
            page_num: Page number to extract (1-based index)
            output_path: Path to save the extracted PDF
            
        Returns:
            Path to the created PDF file
            
        Raises:
            ValueError: If page number is out of range
            IOError: If output file cannot be written
        """
        return self.extract_pages([page_num], output_path)