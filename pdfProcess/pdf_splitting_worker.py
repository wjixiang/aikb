"""
PDF Splitting Worker - Python Implementation
A Python-based worker for splitting large PDF files into smaller parts for parallel processing.
This worker is designed to work with the existing RabbitMQ-based distributed system.
"""

import asyncio
import json
import logging
import os
import tempfile
import uuid
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any

import aiofiles
import aiohttp
import pika
from PyPDF2 import PdfReader, PdfWriter

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('PdfSplittingWorker')


class MessageTypes:
    """Message type constants matching the TypeScript implementation"""
    
    # PDF processing status
    PENDING = 'pending'
    PROCESSING = 'processing'
    COMPLETED = 'completed'
    FAILED = 'failed'
    ANALYZING = 'analyzing'
    SPLITTING = 'splitting'
    MERGING = 'merging'
    
    # PDF part status
    PART_PENDING = 'pending'
    PART_PROCESSING = 'processing'
    PART_COMPLETED = 'completed'
    PART_FAILED = 'failed'
    
    # Event types
    PDF_SPLITTING_REQUEST = 'PDF_SPLITTING_REQUEST'
    PDF_PART_CONVERSION_REQUEST = 'PDF_PART_CONVERSION_REQUEST'
    PDF_CONVERSION_PROGRESS = 'PDF_CONVERSION_PROGRESS'
    PDF_CONVERSION_FAILED = 'PDF_CONVERSION_FAILED'


class RabbitMQClient:
    """RabbitMQ client for communicating with the message queue"""
    
    def __init__(self, connection_params: Dict[str, Any]):
        self.connection_params = connection_params
        self.connection = None
        self.channel = None
        self.consumer_tag = None
        
    async def connect(self):
        """Establish connection to RabbitMQ"""
        try:
            # Use URL format for connection, which handles all parameters properly
            url = self.connection_params.get('url')
            if not url:
                # Construct URL from individual parameters
                host = self.connection_params['host']
                port = self.connection_params['port']
                username = self.connection_params['username']
                password = self.connection_params['password']
                virtual_host = self.connection_params['virtual_host']
                url = f"amqp://{username}:{password}@{host}:{port}/{virtual_host}"
            
            logger.info(f"Connecting to RabbitMQ with URL: amqp://{self.connection_params['username']}:***@{self.connection_params['host']}:{self.connection_params['port']}/{self.connection_params['virtual_host']}")
            self.connection = pika.BlockingConnection(pika.URLParameters(url))
            self.channel = self.connection.channel()
            
            # Declare queues
            self.channel.queue_declare(queue='pdf-splitting-request', durable=True)
            self.channel.queue_declare(queue='pdf-part-conversion-request', durable=True)
            self.channel.queue_declare(queue='pdf-conversion-progress', durable=True)
            self.channel.queue_declare(queue='pdf-conversion-failed', durable=True)
            
            logger.info("Connected to RabbitMQ successfully")
        except Exception as e:
            logger.error(f"Failed to connect to RabbitMQ: {e}")
            raise
    
    def close(self):
        """Close RabbitMQ connection"""
        if self.connection and not self.connection.is_closed:
            self.connection.close()
            logger.info("RabbitMQ connection closed")
    
    def start_consuming(self, queue_name: str, callback):
        """Start consuming messages from a queue"""
        self.consumer_tag = self.channel.basic_consume(
            queue=queue_name,
            on_message_callback=callback,
            auto_ack=False
        )
        self.channel.start_consuming()
    
    def stop_consuming(self):
        """Stop consuming messages"""
        if self.consumer_tag:
            self.channel.basic_cancel(self.consumer_tag)
            self.consumer_tag = None
    
    def publish_message(self, routing_key: str, message: Dict[str, Any]):
        """Publish a message to RabbitMQ"""
        try:
            self.channel.basic_publish(
                exchange='',
                routing_key=routing_key,
                body=json.dumps(message),
                properties=pika.BasicProperties(
                    delivery_mode=2,  # Make message persistent
                    message_id=str(uuid.uuid4()),
                    timestamp=int(datetime.now().timestamp())
                )
            )
            logger.debug(f"Published message to {routing_key}: {message.get('messageId')}")
        except Exception as e:
            logger.error(f"Failed to publish message to {routing_key}: {e}")
            raise
    
    def ack_message(self, delivery_tag):
        """Acknowledge a message"""
        self.channel.basic_ack(delivery_tag)
    
    def nack_message(self, delivery_tag, requeue=False):
        """Negative acknowledge a message"""
        self.channel.basic_nack(delivery_tag, requeue=requeue)


class PDFSplitter:
    """Core PDF splitting functionality"""
    
    @staticmethod
    def split_pdf(input_path: str, output_dir: str, split_size: int) -> List[Dict[str, Any]]:
        """
        Split a PDF file into smaller parts
        
        Args:
            input_path: Path to the input PDF file
            output_dir: Directory to save the split parts
            split_size: Number of pages per part
            
        Returns:
            List of dictionaries containing part information
        """
        try:
            reader = PdfReader(input_path)
            total_pages = len(reader.pages)
            total_parts = (total_pages + split_size - 1) // split_size
            
            parts = []
            
            for part_index in range(total_parts):
                start_page = part_index * split_size
                end_page = min((part_index + 1) * split_size, total_pages)
                
                writer = PdfWriter()
                for page_num in range(start_page, end_page):
                    writer.add_page(reader.pages[page_num])
                
                part_filename = f"part_{part_index + 1:03d}.pdf"
                part_path = os.path.join(output_dir, part_filename)
                
                with open(part_path, 'wb') as output_file:
                    writer.write(output_file)
                
                parts.append({
                    'part_index': part_index,
                    'start_page': start_page + 1,  # 1-based indexing
                    'end_page': end_page,  # 1-based indexing
                    'page_count': end_page - start_page,
                    'filename': part_filename,
                    'path': part_path
                })
            
            logger.info(f"Split PDF into {len(parts)} parts")
            return parts
            
        except Exception as e:
            logger.error(f"Failed to split PDF: {e}")
            raise


class S3StorageClient:
    """Mock S3 storage client for uploading split parts"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
    
    async def upload_part(self, file_path: str, item_id: str, part_index: int) -> Dict[str, str]:
        """
        Upload a PDF part to S3 storage
        
        Args:
            file_path: Path to the file to upload
            item_id: ID of the original item
            part_index: Index of the part
            
        Returns:
            Dictionary containing S3 key and URL
        """
        try:
            # Generate S3 key
            s3_key = f"pdf-parts/{item_id}/part_{part_index + 1}.pdf"
            
            # In a real implementation, you would upload to S3 here
            # For now, we'll simulate the upload
            async with aiofiles.open(file_path, 'rb') as f:
                content = await f.read()
                # Simulate upload delay
                await asyncio.sleep(0.1)
            
            # Generate mock URL
            s3_url = f"https://mock-s3-bucket.s3.amazonaws.com/{s3_key}"
            
            logger.info(f"Uploaded part {part_index + 1} to S3: {s3_key}")
            
            return {
                's3_key': s3_key,
                's3_url': s3_url
            }
            
        except Exception as e:
            logger.error(f"Failed to upload part {part_index + 1}: {e}")
            raise


class PdfSplittingWorker:
    """Main PDF splitting worker class"""
    
    def __init__(self, rabbitmq_config: Dict[str, Any], s3_config: Dict[str, Any]):
        self.rabbitmq_client = RabbitMQClient(rabbitmq_config)
        self.s3_client = S3StorageClient(s3_config)
        self.is_running = False
        
    async def start(self):
        """Start the PDF splitting worker"""
        if self.is_running:
            logger.warning("PDF splitting worker is already running")
            return
        
        try:
            await self.rabbitmq_client.connect()
            
            logger.info("Starting PDF splitting worker...")
            
            # Start consuming messages from the splitting request queue
            self.rabbitmq_client.start_consuming(
                'pdf-splitting-request',
                self.handle_pdf_splitting_request
            )
            
            self.is_running = True
            logger.info("PDF splitting worker started successfully")
            
        except Exception as e:
            logger.error(f"Failed to start PDF splitting worker: {e}")
            raise
    
    def stop(self):
        """Stop the PDF splitting worker"""
        if not self.is_running:
            logger.warning("PDF splitting worker is not running")
            return
        
        try:
            logger.info("Stopping PDF splitting worker...")
            
            self.rabbitmq_client.stop_consuming()
            self.rabbitmq_client.close()
            
            self.is_running = False
            logger.info("PDF splitting worker stopped successfully")
            
        except Exception as e:
            logger.error(f"Failed to stop PDF splitting worker: {e}")
            raise
    
    def handle_pdf_splitting_request(self, channel, method, properties, body):
        """Handle incoming PDF splitting request"""
        start_time = datetime.now()
        
        try:
            # Parse message
            message = json.loads(body.decode('utf-8'))
            message_id = message.get('messageId')
            item_id = message.get('itemId')
            
            logger.info(f"Processing PDF splitting request for item: {item_id}")
            
            # Create temporary directory
            with tempfile.TemporaryDirectory() as temp_dir:
                # Download PDF from S3
                pdf_path = os.path.join(temp_dir, 'original.pdf')
                asyncio.run(self.download_pdf_from_s3(message['s3Url'], pdf_path))
                
                # Update status to splitting
                self.update_item_status(
                    item_id,
                    MessageTypes.SPLITTING,
                    'Splitting PDF into parts'
                )
                
                # Split PDF
                split_size = message.get('splitSize', 25)
                parts_info = PDFSplitter.split_pdf(pdf_path, temp_dir, split_size)
                
                # Upload parts to S3
                uploaded_parts = asyncio.run(
                    self.upload_parts_to_s3(parts_info, item_id, temp_dir)
                )
                
                # Update status to processing
                self.update_item_status(
                    item_id,
                    MessageTypes.PROCESSING,
                    f"PDF split into {len(parts_info)} parts"
                )
                
                # Send part conversion requests
                asyncio.run(
                    self.send_part_conversion_requests(item_id, uploaded_parts, message)
                )
                
                processing_time = (datetime.now() - start_time).total_seconds() * 1000
                logger.info(
                    f"PDF splitting completed for item: {item_id}, "
                    f"parts: {len(parts_info)}, time: {processing_time}ms"
                )
            
            # Acknowledge message
            channel.basic_ack(delivery_tag=method.delivery_tag)
            
        except Exception as e:
            processing_time = (datetime.now() - start_time).total_seconds() * 1000
            error_message = str(e)
            
            logger.error(f"PDF splitting failed for item {item_id}: {e}")
            
            # Update status with error
            self.update_item_status(
                item_id,
                MessageTypes.FAILED,
                f"PDF splitting failed: {error_message}",
                error=error_message
            )
            
            # Check if should retry
            retry_count = message.get('retryCount', 0)
            max_retries = message.get('maxRetries', 3)
            should_retry = retry_count < max_retries
            
            if should_retry:
                logger.info(
                    f"Retrying PDF splitting for item {item_id} "
                    f"(attempt {retry_count + 1}/{max_retries})"
                )
                
                # Republish the request with incremented retry count
                retry_request = {
                    **message,
                    'messageId': str(uuid.uuid4()),
                    'timestamp': int(datetime.now().timestamp()),
                    'retryCount': retry_count + 1,
                }
                
                self.rabbitmq_client.publish_message(
                    'pdf-splitting-request',
                    retry_request
                )
            else:
                logger.error(f"Max retries reached for PDF splitting of item {item_id}")
            
            # Negative acknowledge message
            channel.basic_nack(delivery_tag=method.delivery_tag, requeue=False)
    
    async def download_pdf_from_s3(self, s3_url: str, output_path: str):
        """Download PDF from S3 URL"""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(s3_url, timeout=60) as response:
                    if response.status == 200:
                        content = await response.read()
                        async with aiofiles.open(output_path, 'wb') as f:
                            await f.write(content)
                        logger.info(f"Downloaded PDF from S3: {s3_url}")
                    else:
                        raise Exception(f"Failed to download PDF: HTTP {response.status}")
        except Exception as e:
            logger.error(f"Failed to download PDF from S3: {e}")
            raise
    
    async def upload_parts_to_s3(self, parts_info: List[Dict], item_id: str, temp_dir: str) -> List[Dict]:
        """Upload split parts to S3"""
        uploaded_parts = []
        
        for part in parts_info:
            try:
                part_path = os.path.join(temp_dir, part['filename'])
                upload_result = await self.s3_client.upload_part(
                    part_path, item_id, part['part_index']
                )
                
                uploaded_parts.append({
                    **part,
                    's3_key': upload_result['s3_key'],
                    's3_url': upload_result['s3_url'],
                    'status': MessageTypes.PART_PENDING,
                })
                
            except Exception as e:
                logger.error(f"Failed to upload part {part['part_index'] + 1}: {e}")
                raise
        
        return uploaded_parts
    
    async def send_part_conversion_requests(self, item_id: str, parts: List[Dict], original_request: Dict):
        """Send part conversion requests for each part"""
        concurrent_limit = 3  # Process 3 parts concurrently
        
        # Process parts in batches
        for i in range(0, len(parts), concurrent_limit):
            batch = parts[i:i + concurrent_limit]
            
            tasks = []
            for part in batch:
                part_request = {
                    'messageId': str(uuid.uuid4()),
                    'timestamp': int(datetime.now().timestamp()),
                    'eventType': MessageTypes.PDF_PART_CONVERSION_REQUEST,
                    'itemId': item_id,
                    'partIndex': part['part_index'],
                    'totalParts': len(parts),
                    's3Url': part['s3_url'],
                    's3Key': part['s3_key'],
                    'fileName': f"{original_request['fileName']}_part_{part['part_index'] + 1}",
                    'startPage': part['start_page'],
                    'endPage': part['end_page'],
                    'priority': original_request.get('priority', 'normal'),
                    'retryCount': 0,
                    'maxRetries': original_request.get('maxRetries', 3),
                }
                
                self.rabbitmq_client.publish_message(
                    'pdf-part-conversion-request',
                    part_request
                )
                
                logger.info(
                    f"Sent part conversion request for item {item_id}, "
                    f"part {part['part_index'] + 1}/{len(parts)}"
                )
            
            # Small delay between batches
            if i + concurrent_limit < len(parts):
                await asyncio.sleep(1)
    
    def update_item_status(self, item_id: str, status: str, message: str, progress: Optional[int] = None, error: Optional[str] = None):
        """Update item status (mock implementation)"""
        try:
            status_update = {
                'messageId': str(uuid.uuid4()),
                'timestamp': int(datetime.now().timestamp()),
                'eventType': MessageTypes.PDF_CONVERSION_PROGRESS,
                'itemId': item_id,
                'status': status,
                'progress': progress,
                'message': message,
                'error': error,
            }
            
            self.rabbitmq_client.publish_message('pdf-conversion-progress', status_update)
            logger.info(f"Updated status for item {item_id}: {status} - {message}")
            
        except Exception as e:
            logger.error(f"Failed to update status for item {item_id}: {e}")


async def main():
    """Main function to run the PDF splitting worker"""
    # Configuration
    rabbitmq_config = {
        'host': os.getenv('RABBITMQ_HOST', 'localhost'),
        'port': int(os.getenv('RABBITMQ_PORT', 5672)),
        'username': os.getenv('RABBITMQ_USERNAME', 'guest'),
        'password': os.getenv('RABBITMQ_PASSWORD', 'guest'),
        'virtual_host': os.getenv('RABBITMQ_VHOST', '/'),
    }
    
    s3_config = {
        'bucket': os.getenv('S3_BUCKET', 'mock-bucket'),
        'region': os.getenv('S3_REGION', 'us-east-1'),
    }
    
    # Create and start worker
    worker = PdfSplittingWorker(rabbitmq_config, s3_config)
    
    try:
        await worker.start()
        logger.info("PDF splitting worker is running. Press Ctrl+C to stop.")
        
        # Keep the worker running
        while worker.is_running:
            await asyncio.sleep(1)
            
    except KeyboardInterrupt:
        logger.info("Received interrupt signal, stopping worker...")
    except Exception as e:
        logger.error(f"Worker error: {e}")
    finally:
        worker.stop()
        logger.info("Worker stopped")


if __name__ == "__main__":
    asyncio.run(main())