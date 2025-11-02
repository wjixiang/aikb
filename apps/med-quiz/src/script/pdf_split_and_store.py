import argparse
import os
import asyncio
import sys
from typing import Dict
from pathlib import Path
from datetime import datetime
from pymongo import MongoClient
from dotenv import load_dotenv

# Add the project root to the Python path for module imports
script_dir = os.path.dirname(__file__)
project_root = os.path.abspath(os.path.join(script_dir, '..', '..'))
sys.path.insert(0, project_root)

from src.kgrag.notebook_chunking.textbook_pdf_split import PDFProcessor
from src.kgrag.notebook_chunking.textbook_s3_storage import NotebookS3Storage

# Load environment variables from .env file
env_path = '/Users/a123/Documents/GitHub/MedQuiz/.env'
load_dotenv(env_path)

# Debug print environment variables
print("AWS_REGION:", os.getenv('AWS_REGION'))
print("AWS_S3_BUCKET_NAME_NOTEBOOK_CHUNK:", os.getenv('AWS_S3_BUCKET_NAME_NOTEBOOK_CHUNK'))

async def process_page_chunk(pdf_path: str, pdf_name: str, start_page: int, end_page: int, s3_storage: NotebookS3Storage, collection):
    """Processes a chunk of pages from a PDF."""
    # Ensure PDFProcessor is initialized per task to avoid concurrency issues
    with PDFProcessor(pdf_path) as processor:
        temp_pdf_path = f"/tmp/{pdf_name}_pages_{start_page}-{end_page}.pdf"
        
        # Extract pages. Note: range is inclusive for extract_pages
        processor.extract_pages(list(range(start_page, end_page + 1)), temp_pdf_path)
        
        s3_key = f"pdf_pages/{pdf_name}/pages_{start_page}-{end_page}.pdf"
        with open(temp_pdf_path, 'rb') as f:
            image_data = f.read()

        upload_data = {
            'image_data': image_data,
            'image_type': 'application/pdf'
        }

        s3_url = await s3_storage.upload_image(upload_data, s3_key)
        presigned_url = await s3_storage.get_presigned_url(s3_key)

        # Extract text from both pages as per original logic
        text_content = processor.extract_text(start_page)
        if start_page != end_page: # Only add second page text if it's a pair
            text_content += "\n\n" + processor.extract_text(end_page)

        record = {
            'pdf_name': pdf_name,
            'start_page': start_page,
            'end_page': end_page,
            's3_key': s3_key,
            's3_url': s3_url,
            'presigned_url': presigned_url,
            'text_content': text_content,
            'created_at': datetime.utcnow()
        }

        collection.insert_one(record)
        print(f"Processed pages {start_page}-{end_page} for {pdf_name} - {s3_url}")
        os.remove(temp_pdf_path)

async def process_pdf(pdf_path: str, MONGODB_URI: str, mongo_db: str, mongo_collection: str):
    """Process PDF file: split pages, upload to S3, store metadata in MongoDB concurrently."""
    pdf_name = Path(pdf_path).stem
    s3_storage = NotebookS3Storage()
    
    # Verify S3 connection
    if not await s3_storage.check_connection():
        raise ConnectionError("Failed to connect to OSS storage. Please check your credentials and bucket configuration.")
    
    # Initialize MongoDB client
    mongo_client = MongoClient(MONGODB_URI)
    db = mongo_client[mongo_db]
    collection = db[mongo_collection]
    
    tasks = []
    
    # Get total_pages using a temporary processor instance
    with PDFProcessor(pdf_path) as processor:
        total_pages = len(processor.doc)

    # Create tasks for overlapping page pairs as per original logic
    for i in range(1, total_pages):
        start_page = i
        end_page = i + 1
        tasks.append(process_page_chunk(pdf_path, pdf_name, start_page, end_page, s3_storage, collection))
    
    # Handle the last page if total_pages is odd, as per original logic
    if total_pages % 2 == 1:
        start_page = total_pages
        end_page = total_pages # Single page chunk
        tasks.append(process_page_chunk(pdf_path, pdf_name, start_page, end_page, s3_storage, collection))

    await asyncio.gather(*tasks)
    
    mongo_client.close() # Close client after all tasks are done

async def async_main():
    parser = argparse.ArgumentParser(description='Split PDF into pages and store in S3 with MongoDB metadata')
    parser.add_argument('pdf_path', help='Path to the PDF file to process')
    parser.add_argument('--mongo-uri', default=os.getenv('MONGODB_URI'), 
                      help='MongoDB connection URI')
    parser.add_argument('--mongo-db', default=os.getenv('QUIZ_DB', 'QuizBank'),
                      help='MongoDB database name')
    parser.add_argument('--mongo-collection', default=os.getenv('MONGO_COLLECTION', 'pdf_pages'),
                      help='MongoDB collection name')
    
    args = parser.parse_args()
    
    if not args.MONGODB_URI:
        raise ValueError("MongoDB URI must be provided via --mongo-uri or MONGODB_URI environment variable")
    
    await process_pdf(
        args.pdf_path,
        args.MONGODB_URI,
        args.mongo_db,
        args.mongo_collection
    )

def main():
    asyncio.run(async_main())

if __name__ == '__main__':
    main()
