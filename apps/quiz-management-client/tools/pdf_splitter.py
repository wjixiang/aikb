import argparse
import os
from PyPDF2 import PdfReader, PdfWriter

def split_pdf(input_path, output_dir, num_splits):
    """Split a PDF into specified number of parts"""
    # Create output directory if it doesn't exist
    os.makedirs(output_dir, exist_ok=True)
    
    # Read the input PDF
    reader = PdfReader(input_path)
    total_pages = len(reader.pages)
    
    # Calculate pages per split
    pages_per_split = total_pages // num_splits
    remainder = total_pages % num_splits
    
    # Split the PDF
    start_page = 0
    for i in range(num_splits):
        writer = PdfWriter()
        
        # Calculate end page
        end_page = start_page + pages_per_split
        if i < remainder:
            end_page += 1
            
        # Add pages to this split
        for page_num in range(start_page, end_page):
            writer.add_page(reader.pages[page_num])
            
        # Save the split
        output_path = os.path.join(output_dir, f"split_{i+1}.pdf")
        with open(output_path, "wb") as f:
            writer.write(f)
            print(f"Created: {output_path} (pages {start_page+1}-{end_page})")
            
        start_page = end_page

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Split a PDF into multiple parts")
    parser.add_argument("input", help="Input PDF file path")
    parser.add_argument("output_dir", help="Output directory for split PDFs")
    parser.add_argument("num_splits", type=int, help="Number of splits to create")
    args = parser.parse_args()
    
    split_pdf(args.input, args.output_dir, args.num_splits)