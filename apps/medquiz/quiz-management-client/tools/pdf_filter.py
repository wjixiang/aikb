from pdf2image import convert_from_path
import cv2
import numpy as np
import img2pdf
import os
import tempfile
import argparse
import logging
from PIL import Image

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def process_image_cv(image, black_threshold=60):
    """Convert image to keep near-black pixels using OpenCV"""
    # Convert PIL Image to OpenCV format (BGR)
    cv_image = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
    
    # Convert to HSV color space
    hsv = cv2.cvtColor(cv_image, cv2.COLOR_BGR2HSV)
    
    # Use Value channel to detect darkness
    value = hsv[:,:,2]
    
    # Create mask for near-black pixels
    _, mask = cv2.threshold(value, black_threshold, 255, cv2.THRESH_BINARY_INV)
    
    # Create white background
    result = np.full_like(cv_image, 255)
    
    # Apply mask to keep only near-black pixels
    result[mask == 255] = cv_image[mask == 255]
    
    # Convert back to PIL Image
    return Image.fromarray(cv2.cvtColor(result, cv2.COLOR_BGR2RGB))

def parse_page_ranges(page_str, max_pages):
    """Parse page range string into list of page numbers"""
    if page_str.lower() == "all":
        return list(range(1, max_pages + 1))
    
    pages = []
    for part in page_str.split(','):
        if '-' in part:
            start, end = map(int, part.split('-'))
            pages.extend(range(start, end + 1))
        else:
            pages.append(int(part))
    
    # Remove duplicates and sort
    pages = sorted(list(set(pages)))
    
    # Validate page numbers
    if any(p < 1 or p > max_pages for p in pages):
        raise ValueError(f"Page numbers must be between 1 and {max_pages}")
    
    return pages

def pdf_to_black_white(input_path, output_path, dpi=300, black_threshold=60, page_ranges="all"):
    """Convert PDF to keep near-black content"""
    logger.info(f"Starting PDF conversion: {input_path} -> {output_path}")
    logger.info(f"Using DPI: {dpi}, Black threshold: {black_threshold}")
    
    with tempfile.TemporaryDirectory() as temp_dir:
        # Convert PDF to images
        logger.info("Converting PDF to images...")
        images = convert_from_path(input_path, dpi=dpi, output_folder=temp_dir)
        logger.info(f"Converted {len(images)} pages")
        
        # Parse and validate page ranges
        pages_to_process = parse_page_ranges(page_ranges, len(images))
        logger.info(f"Processing pages: {pages_to_process}")
        
        processed_images = []
        for i in pages_to_process:
            image = images[i-1]  # Convert to 0-based index
            # Process each image with adjusted threshold
            logger.info(f"Processing page {i+1}/{len(images)}")
            processed = process_image_cv(image, black_threshold)
            temp_path = os.path.join(temp_dir, f"page_{i}.jpg")
            processed.save(temp_path, "JPEG", quality=95)
            processed_images.append(temp_path)
            logger.debug(f"Saved processed page to {temp_path}")
        
        # Convert images back to PDF
        logger.info("Converting processed images back to PDF...")
        with open(output_path, "wb") as f:
            f.write(img2pdf.convert(processed_images))
        logger.info(f"Successfully saved output PDF: {output_path}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("input", help="Input PDF file path")
    parser.add_argument("output", help="Output PDF file path")
    parser.add_argument("--dpi", type=int, default=300, help="DPI for conversion")
    parser.add_argument("--threshold", type=int, default=30,
                      help="Black threshold (0-255, higher keeps more dark colors)")
    parser.add_argument("--pages", type=str, default="all",
                      help="Page ranges to process (e.g. '1-3,5,7-9') or 'all'")
    args = parser.parse_args()
    
    pdf_to_black_white(args.input, args.output, args.dpi, args.threshold, args.pages)
