"""
PDF Splitting Worker - Python Implementation
A Python-based worker for splitting large PDF files into smaller parts for parallel processing.
This worker is designed to work with the existing RabbitMQ-based distributed system.
"""

import asyncio
import json
import os
import tempfile
import time
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Any

import aiofiles
import aiohttp
import pika
from PyPDF2 import PdfReader, PdfWriter

# Import enhanced logger
from enhanced_logger import create_enhanced_logger, log_performance, log_async_performance
from config import Config

# Create enhanced logger with configuration
debug_config = Config.get_enhanced_logging_config()
logger = create_enhanced_logger('PdfSplittingWorker', debug_mode=debug_config['debug_mode'])


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
        
    @log_async_performance("rabbitmq_connect")
    async def connect(self):
        """Establish connection to RabbitMQ"""
        with logger.context(operation="rabbitmq_connect"):
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
                
                logger.info(f"Connecting to RabbitMQ", meta={
                    'host': self.connection_params['host'],
                    'port': self.connection_params['port'],
                    'virtual_host': self.connection_params['virtual_host'],
                    'username': self.connection_params['username']
                })
                
                self.connection = pika.BlockingConnection(pika.URLParameters(url))
                self.channel = self.connection.channel()
                
                logger.debug("RabbitMQ connection established, checking queues")
                
                # Verify queues exist using passive declaration
                # This avoids configuration conflicts with existing queues created by TypeScript
                queues = [
                    'pdf-splitting-request',
                    'pdf-part-conversion-request',
                    'pdf-conversion-progress',
                    'pdf-conversion-failed'
                ]
                
                queue_info = {}
                for queue_name in queues:
                    logger.debug(f"Checking queue '{queue_name}'")
                    try:
                        result = self.channel.queue_declare(queue=queue_name, durable=True, passive=True)
                        message_count = result.method.message_count
                        queue_info[queue_name] = message_count
                        logger.info(f"Queue accessible", meta={
                            'queue_name': queue_name,
                            'message_count': message_count,
                            'durable': True
                        })
                    except Exception as e:
                        logger.error(f"Queue access failed", meta={
                            'queue_name': queue_name,
                            'error': str(e),
                            'error_type': type(e).__name__
                        }, exc_info=True)
                        raise
                
                logger.info("RabbitMQ connection successful", meta={
                    'queues': queue_info,
                    'connection_params': {
                        'host': self.connection_params['host'],
                        'port': self.connection_params['port'],
                        'virtual_host': self.connection_params['virtual_host']
                    }
                })
                
            except Exception as e:
                logger.error("RabbitMQ connection failed", meta={
                    'error': str(e),
                    'error_type': type(e).__name__,
                    'connection_params': {
                        'host': self.connection_params.get('host'),
                        'port': self.connection_params.get('port'),
                        'virtual_host': self.connection_params.get('virtual_host')
                    }
                }, exc_info=True)
                raise
    
    def close(self):
        """Close RabbitMQ connection"""
        with logger.context(operation="rabbitmq_close"):
            try:
                if self.connection and not self.connection.is_closed:
                    logger.info("Closing RabbitMQ connection", meta={
                        'connection_state': 'open',
                        'is_closed': self.connection.is_closed
                    })
                    self.connection.close()
                    logger.info("RabbitMQ connection closed successfully")
                else:
                    logger.debug("RabbitMQ connection already closed or not established", meta={
                        'connection_exists': self.connection is not None,
                        'is_closed': self.connection.is_closed if self.connection else None
                    })
            except Exception as e:
                logger.error("Error closing RabbitMQ connection", meta={
                    'error': str(e),
                    'error_type': type(e).__name__
                }, exc_info=True)
                raise
    
    def start_consuming(self, queue_name: str, callback):
        """Start consuming messages from a queue"""
        with logger.context(operation="start_consuming", queue_name=queue_name):
            try:
                logger.info("Starting to consume messages", meta={
                    'queue_name': queue_name,
                    'auto_ack': False,
                    'callback_function': callback.__name__ if hasattr(callback, '__name__') else str(callback)
                })
                
                self.consumer_tag = self.channel.basic_consume(
                    queue=queue_name,
                    on_message_callback=callback,
                    auto_ack=False
                )
                
                logger.info("Message consumer configured", meta={
                    'consumer_tag': self.consumer_tag,
                    'queue_name': queue_name
                })
                
                logger.info("Starting message consumption loop")
                self.channel.start_consuming()
                
            except Exception as e:
                logger.error("Failed to start consuming messages", meta={
                    'queue_name': queue_name,
                    'error': str(e),
                    'error_type': type(e).__name__,
                    'consumer_tag': getattr(self, 'consumer_tag', None)
                }, exc_info=True)
                raise
    
    def stop_consuming(self):
        """Stop consuming messages"""
        with logger.context(operation="stop_consuming"):
            try:
                if self.consumer_tag:
                    logger.info("Stopping message consumption", meta={
                        'consumer_tag': self.consumer_tag
                    })
                    self.channel.basic_cancel(self.consumer_tag)
                    self.consumer_tag = None
                    logger.info("Message consumption stopped successfully")
                else:
                    logger.debug("No active consumer to stop")
            except Exception as e:
                logger.error("Failed to stop consuming messages", meta={
                    'consumer_tag': getattr(self, 'consumer_tag', None),
                    'error': str(e),
                    'error_type': type(e).__name__
                }, exc_info=True)
                raise
    
    def publish_message(self, routing_key: str, message: Dict[str, Any]):
        """Publish a message to RabbitMQ"""
        with logger.context(operation="publish_message", routing_key=routing_key):
            try:
                message_id = message.get('messageId', str(uuid.uuid4()))
                message_size = len(json.dumps(message))
                
                logger.debug("Publishing message", meta={
                    'routing_key': routing_key,
                    'message_id': message_id,
                    'message_size_bytes': message_size,
                    'message_type': message.get('eventType'),
                    'item_id': message.get('itemId'),
                    'delivery_mode': 2  # persistent
                })
                
                self.channel.basic_publish(
                    exchange='',
                    routing_key=routing_key,
                    body=json.dumps(message),
                    properties=pika.BasicProperties(
                        delivery_mode=2,  # Make message persistent
                        message_id=message_id,
                        timestamp=int(datetime.now().timestamp())
                    )
                )
                
                logger.info("Message published successfully", meta={
                    'routing_key': routing_key,
                    'message_id': message_id,
                    'message_size_bytes': message_size,
                    'message_type': message.get('eventType'),
                    'item_id': message.get('itemId')
                })
                
            except Exception as e:
                logger.error("Failed to publish message", meta={
                    'routing_key': routing_key,
                    'message_id': message.get('messageId'),
                    'message_type': message.get('eventType'),
                    'item_id': message.get('itemId'),
                    'error': str(e),
                    'error_type': type(e).__name__
                }, exc_info=True)
                raise
    
    def ack_message(self, delivery_tag):
        """Acknowledge a message"""
        with logger.context(operation="ack_message"):
            try:
                logger.debug("Acknowledging message", meta={
                    'delivery_tag': delivery_tag
                })
                self.channel.basic_ack(delivery_tag)
                logger.debug("Message acknowledged successfully", meta={
                    'delivery_tag': delivery_tag
                })
            except Exception as e:
                logger.error("Failed to acknowledge message", meta={
                    'delivery_tag': delivery_tag,
                    'error': str(e),
                    'error_type': type(e).__name__
                }, exc_info=True)
                raise
    
    def nack_message(self, delivery_tag, requeue=False):
        """Negative acknowledge a message"""
        with logger.context(operation="nack_message"):
            try:
                logger.debug("Negative acknowledging message", meta={
                    'delivery_tag': delivery_tag,
                    'requeue': requeue
                })
                self.channel.basic_nack(delivery_tag, requeue=requeue)
                logger.debug("Message negative acknowledged successfully", meta={
                    'delivery_tag': delivery_tag,
                    'requeue': requeue
                })
            except Exception as e:
                logger.error("Failed to negative acknowledge message", meta={
                    'delivery_tag': delivery_tag,
                    'requeue': requeue,
                    'error': str(e),
                    'error_type': type(e).__name__
                }, exc_info=True)
                raise


class PDFSplitter:
    """Core PDF splitting functionality"""
    
    @staticmethod
    def split_pdf(input_path: str, output_dir: str, split_size: int, progress_callback=None) -> List[Dict[str, Any]]:
        """
        Split a PDF file into smaller parts
        
        Args:
            input_path: Path to the input PDF file
            output_dir: Directory to save the split parts
            split_size: Number of pages per part
            progress_callback: Optional callback function to report progress
            
        Returns:
            List of dictionaries containing part information
        """
        split_logger = create_enhanced_logger('PDFSplitter')
        
        with split_logger.context(operation="pdf_splitting"), \
             split_logger.performance_timer("pdf_split_operation",
                                           tags={'split_size': str(split_size)}):
            
            try:
                # Get file size for logging
                file_size = os.path.getsize(input_path)
                split_logger.info("Starting PDF split", meta={
                    'input_path': input_path,
                    'output_dir': output_dir,
                    'split_size': split_size,
                    'file_size_bytes': file_size
                })
                
                with split_logger.performance_timer("pdf_read"):
                    reader = PdfReader(input_path)
                    total_pages = len(reader.pages)
                
                total_parts = (total_pages + split_size - 1) // split_size
                
                split_logger.info("PDF analysis complete", meta={
                    'total_pages': total_pages,
                    'total_parts': total_parts,
                    'split_size': split_size
                })
                
                parts = []
                
                for part_index in range(total_parts):
                    # Calculate and report progress
                    progress_percentage = int((part_index / total_parts) * 100)
                    if progress_callback:
                        progress_callback(
                            item_id=None,  # Will be set by caller
                            status=MessageTypes.SPLITTING,
                            message=f"Creating part {part_index + 1} of {total_parts} (pages {start_page + 1}-{end_page})",
                            progress=progress_percentage
                        )
                    part_start_time = time.time()
                    
                    start_page = part_index * split_size
                    end_page = min((part_index + 1) * split_size, total_pages)
                    
                    with split_logger.performance_timer(f"part_{part_index + 1}_creation"):
                        split_logger.debug(f"Creating part {part_index + 1}", meta={
                            'part_index': part_index,
                            'start_page': start_page + 1,
                            'end_page': end_page,
                            'page_count': end_page - start_page
                        })
                        
                        writer = PdfWriter()
                        for page_num in range(start_page, end_page):
                            split_logger.trace(f"Adding page {page_num + 1} to part {part_index + 1}", meta={
                                'part_index': part_index,
                                'page_number': page_num + 1,
                                'total_pages_in_part': end_page - start_page
                            })
                            writer.add_page(reader.pages[page_num])
                        
                        part_filename = f"part_{part_index + 1:03d}.pdf"
                        part_path = os.path.join(output_dir, part_filename)
                        
                        split_logger.debug(f"Writing part {part_index + 1} to file", meta={
                            'part_index': part_index,
                            'filename': part_filename,
                            'output_path': part_path
                        })
                        
                        with split_logger.performance_timer(f"part_{part_index + 1}_write"):
                            with open(part_path, 'wb') as output_file:
                                writer.write(output_file)
                    
                    # Get part file size
                    part_file_size = os.path.getsize(part_path)
                    part_duration = (time.time() - part_start_time) * 1000
                    
                    part_info = {
                        'part_index': part_index,
                        'start_page': start_page + 1,  # 1-based indexing
                        'end_page': end_page,  # 1-based indexing
                        'page_count': end_page - start_page,
                        'filename': part_filename,
                        'path': part_path,
                        'file_size_bytes': part_file_size,
                        'processing_time_ms': part_duration
                    }
                    
                    parts.append(part_info)
                    
                    # Report progress after part completion
                    if progress_callback:
                        progress_percentage = int(((part_index + 1) / total_parts) * 100)
                        progress_callback(
                            item_id=None,  # Will be set by caller
                            status=MessageTypes.SPLITTING,
                            message=f"Completed part {part_index + 1} of {total_parts} ({progress_percentage}%)",
                            progress=progress_percentage
                        )
                    
                    split_logger.info(f"Part {part_index + 1} created successfully", meta={
                        'part_index': part_index,
                        'part_number': part_index + 1,
                        'start_page': start_page + 1,
                        'end_page': end_page,
                        'page_count': end_page - start_page,
                        'filename': part_filename,
                        'file_path': part_path,
                        'file_size_bytes': part_file_size,
                        'file_size_mb': round(part_file_size / (1024 * 1024), 2),
                        'processing_time_ms': round(part_duration, 2),
                        'pages_per_second': round((end_page - start_page) / (part_duration / 1000), 2) if part_duration > 0 else 0
                    })
                
                # Calculate total processing metrics
                total_output_size = sum(p['file_size_bytes'] for p in parts)
                avg_part_size = total_output_size / len(parts) if parts else 0
                
                # Calculate additional metrics
                total_processing_time = sum(p['processing_time_ms'] for p in parts)
                avg_processing_time = total_processing_time / len(parts) if parts else 0
                max_part_size = max(p['file_size_bytes'] for p in parts) if parts else 0
                min_part_size = min(p['file_size_bytes'] for p in parts) if parts else 0
                
                split_logger.info("PDF split completed successfully", meta={
                    'total_parts': len(parts),
                    'total_pages': total_pages,
                    'total_input_size_bytes': file_size,
                    'total_input_size_mb': round(file_size / (1024 * 1024), 2),
                    'total_output_size_bytes': total_output_size,
                    'total_output_size_mb': round(total_output_size / (1024 * 1024), 2),
                    'average_part_size_bytes': avg_part_size,
                    'average_part_size_mb': round(avg_part_size / (1024 * 1024), 2),
                    'max_part_size_bytes': max_part_size,
                    'min_part_size_bytes': min_part_size,
                    'compression_ratio': round(total_output_size / file_size if file_size > 0 else 0, 4),
                    'total_processing_time_ms': round(total_processing_time, 2),
                    'average_processing_time_ms': round(avg_processing_time, 2),
                    'overall_pages_per_second': round(total_pages / (total_processing_time / 1000), 2) if total_processing_time > 0 else 0,
                    'output_directory': output_dir
                })
                
                return parts
                
            except Exception as e:
                split_logger.error("PDF split failed", meta={
                    'input_path': input_path,
                    'output_dir': output_dir,
                    'split_size': split_size,
                    'error': str(e),
                    'error_type': type(e).__name__
                }, exc_info=True)
                raise


class S3StorageClient:
    """S3/OSS storage client for uploading split parts"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.bucket = config.get('bucket', 'aikb-pdf')
        self.region = config.get('region', 'oss-cn-beijing')
        self.access_key = config.get('access_key', '')
        self.secret_key = config.get('secret_key', '')
        self.endpoint = config.get('endpoint', 'aliyuncs.com')
        self.storage_logger = create_enhanced_logger('S3StorageClient')
    
    @log_async_performance("s3_upload_part")
    async def upload_part(self, file_path: str, item_id: str, part_index: int, progress_callback=None) -> Dict[str, str]:
        """
        Upload a PDF part to S3/OSS storage
        
        Args:
            file_path: Path to the file to upload
            item_id: ID of the original item
            part_index: Index of the part
            progress_callback: Optional callback function to report progress
            
        Returns:
            Dictionary containing S3 key and URL
        """
        with self.storage_logger.context(operation="s3_upload", item_id=item_id, part_index=part_index):
            try:
                # Generate S3 key
                s3_key = f"pdf-parts/{item_id}/part_{part_index + 1}.pdf"
                
                # Get file size for logging
                file_size = os.path.getsize(file_path)
                
                self.storage_logger.info("Starting S3 upload", meta={
                    'item_id': item_id,
                    'part_index': part_index,
                    's3_key': s3_key,
                    'file_path': file_path,
                    'file_size_bytes': file_size,
                    'bucket': self.bucket,
                    'endpoint': self.endpoint
                })
                
                # Check if we have real S3 credentials
                if self.access_key and self.secret_key:
                    # Real S3/OSS upload implementation
                    try:
                        with self.storage_logger.performance_timer("oss_upload"):
                            import oss2
                            # Create OSS client
                            self.storage_logger.debug("Creating OSS client", meta={
                                'item_id': item_id,
                                'part_index': part_index,
                                'bucket': self.bucket,
                                'endpoint': self.endpoint,
                                'auth_method': 'access_key'
                            })
                            
                            auth = oss2.Auth(self.access_key, self.secret_key)
                            endpoint = f"https://{self.bucket}.{self.endpoint}"
                            bucket = oss2.Bucket(auth, endpoint, self.bucket)
                            
                            self.storage_logger.debug("Uploading file to OSS", meta={
                                'item_id': item_id,
                                'part_index': part_index,
                                's3_key': s3_key,
                                'file_path': file_path,
                                'file_size_bytes': file_size
                            })
                            
                            # Upload file
                            bucket.put_object_from_file(s3_key, file_path)
                            
                            # Report upload progress
                            if progress_callback:
                                progress_callback(
                                    item_id=item_id,
                                    status=MessageTypes.PROCESSING,
                                    message=f"Uploaded part {part_index + 1} to storage",
                                    progress=None  # Will be calculated by caller
                                )
                            
                            # Generate URL
                            s3_url = f"https://{self.bucket}.{self.endpoint}/{s3_key}"
                            
                            self.storage_logger.debug("OSS upload completed", meta={
                                'item_id': item_id,
                                'part_index': part_index,
                                's3_url': s3_url,
                                'final_url_length': len(s3_url)
                            })
                        
                        self.storage_logger.info("OSS upload successful", meta={
                            'item_id': item_id,
                            'part_index': part_index,
                            's3_key': s3_key,
                            's3_url': s3_url,
                            'file_size_bytes': file_size,
                            'storage_type': 'OSS'
                        })
                        
                    except ImportError:
                        self.storage_logger.warning("OSS2 library not available, using mock upload", meta={
                            'item_id': item_id,
                            'part_index': part_index,
                            's3_key': s3_key
                        })
                        # Fallback to mock upload
                        with self.storage_logger.performance_timer("mock_upload"):
                            self.storage_logger.debug("Performing mock upload", meta={
                                'item_id': item_id,
                                'part_index': part_index,
                                'file_path': file_path,
                                'file_size_bytes': file_size,
                                'mock_sleep_duration': 0.1
                            })
                            
                            async with aiofiles.open(file_path, 'rb') as f:
                                content = await f.read()
                                self.storage_logger.trace(f"Read {len(content)} bytes for mock upload", meta={
                                    'item_id': item_id,
                                    'part_index': part_index,
                                    'content_length': len(content)
                                })
                                await asyncio.sleep(0.1)
                            
                            # Report upload progress for mock upload
                            if progress_callback:
                                progress_callback(
                                    item_id=item_id,
                                    status=MessageTypes.PROCESSING,
                                    message=f"Uploaded part {part_index + 1} to storage (mock)",
                                    progress=None  # Will be calculated by caller
                                )
                            
                            s3_url = f"https://{self.bucket}.{self.endpoint}/{s3_key}"
                        
                        self.storage_logger.info("Mock upload completed", meta={
                            'item_id': item_id,
                            'part_index': part_index,
                            's3_key': s3_key,
                            's3_url': s3_url,
                            'file_size_bytes': file_size,
                            'storage_type': 'mock'
                        })
                else:
                    # Mock upload for testing
                    self.storage_logger.debug("Using mock upload (no credentials)", meta={
                        'item_id': item_id,
                        'part_index': part_index,
                        's3_key': s3_key,
                        'has_access_key': bool(self.access_key),
                        'has_secret_key': bool(self.secret_key)
                    })
                    
                    with self.storage_logger.performance_timer("mock_upload"):
                        self.storage_logger.debug("Performing mock upload (no credentials)", meta={
                            'item_id': item_id,
                            'part_index': part_index,
                            'file_path': file_path,
                            'file_size_bytes': file_size,
                            'mock_sleep_duration': 0.1,
                            'has_access_key': bool(self.access_key),
                            'has_secret_key': bool(self.secret_key)
                        })
                        
                        async with aiofiles.open(file_path, 'rb') as f:
                            content = await f.read()
                            self.storage_logger.trace(f"Read {len(content)} bytes for mock upload", meta={
                                'item_id': item_id,
                                'part_index': part_index,
                                'content_length': len(content)
                            })
                            await asyncio.sleep(0.1)
                        
                        # Report upload progress for mock upload (no credentials)
                        if progress_callback:
                            progress_callback(
                                item_id=item_id,
                                status=MessageTypes.PROCESSING,
                                message=f"Uploaded part {part_index + 1} to storage (mock, no credentials)",
                                progress=None  # Will be calculated by caller
                            )
                        
                        s3_url = f"https://{self.bucket}.{self.endpoint}/{s3_key}"
                    
                    self.storage_logger.info("Mock upload completed", meta={
                        'item_id': item_id,
                        'part_index': part_index,
                        's3_key': s3_key,
                        's3_url': s3_url,
                        'file_size_bytes': file_size,
                        'storage_type': 'mock'
                    })
                
                return {
                    's3_key': s3_key,
                    's3_url': s3_url
                }
                
            except Exception as e:
                self.storage_logger.error("S3 upload failed", meta={
                    'item_id': item_id,
                    'part_index': part_index,
                    'file_path': file_path,
                    'error': str(e),
                    'error_type': type(e).__name__,
                    'bucket': self.bucket,
                    'endpoint': self.endpoint
                }, exc_info=True)
                raise


class PdfSplittingWorker:
    """Main PDF splitting worker class"""
    
    def __init__(self, rabbitmq_config: Dict[str, Any], s3_config: Dict[str, Any]):
        self.rabbitmq_client = RabbitMQClient(rabbitmq_config)
        self.s3_client = S3StorageClient(s3_config)
        self.is_running = False
        self.worker_logger = create_enhanced_logger('PdfSplittingWorkerMain')
        
    async def start(self):
        """Start the PDF splitting worker"""
        with self.worker_logger.context(operation="worker_start"):
            if self.is_running:
                self.worker_logger.warning("PDF splitting worker is already running", meta={
                    'current_state': 'running',
                    'worker_id': id(self)
                })
                return
            
            try:
                self.worker_logger.info("Initializing PDF splitting worker", meta={
                    'worker_id': id(self),
                    'rabbitmq_config': {
                        'host': self.rabbitmq_client.connection_params.get('host'),
                        'port': self.rabbitmq_client.connection_params.get('port'),
                        'virtual_host': self.rabbitmq_client.connection_params.get('virtual_host')
                    },
                    's3_config': {
                        'bucket': self.s3_client.bucket,
                        'endpoint': self.s3_client.endpoint,
                        'has_credentials': bool(self.s3_client.access_key and self.s3_client.secret_key)
                    }
                })
                
                await self.rabbitmq_client.connect()
                
                self.worker_logger.info("Starting PDF splitting worker message consumption", meta={
                    'queue_name': 'pdf-splitting-request',
                    'handler_method': 'handle_pdf_splitting_request'
                })
                
                # Start consuming messages from the splitting request queue
                self.rabbitmq_client.start_consuming(
                    'pdf-splitting-request',
                    self.handle_pdf_splitting_request
                )
                
                self.is_running = True
                self.worker_logger.info("PDF splitting worker started successfully", meta={
                    'worker_id': id(self),
                    'queue_name': 'pdf-splitting-request',
                    'start_time': datetime.now().isoformat()
                })
                
            except Exception as e:
                self.worker_logger.error("Failed to start PDF splitting worker", meta={
                    'worker_id': id(self),
                    'error': str(e),
                    'error_type': type(e).__name__
                }, exc_info=True)
                raise
    
    def stop(self):
        """Stop the PDF splitting worker"""
        with self.worker_logger.context(operation="worker_stop"):
            if not self.is_running:
                self.worker_logger.warning("PDF splitting worker is not running", meta={
                    'current_state': 'stopped',
                    'worker_id': id(self)
                })
                return
            
            try:
                self.worker_logger.info("Stopping PDF splitting worker", meta={
                    'worker_id': id(self),
                    'current_state': 'running'
                })
                
                self.rabbitmq_client.stop_consuming()
                self.worker_logger.debug("RabbitMQ message consumption stopped")
                
                self.rabbitmq_client.close()
                self.worker_logger.debug("RabbitMQ connection closed")
                
                self.is_running = False
                self.worker_logger.info("PDF splitting worker stopped successfully", meta={
                    'worker_id': id(self),
                    'stop_time': datetime.now().isoformat()
                })
                
            except Exception as e:
                self.worker_logger.error("Failed to stop PDF splitting worker", meta={
                    'worker_id': id(self),
                    'error': str(e),
                    'error_type': type(e).__name__
                }, exc_info=True)
                raise
    
    def handle_pdf_splitting_request(self, channel, method, properties, body):
        """Handle incoming PDF splitting request"""
        start_time = datetime.now()
        
        try:
            # Parse message
            message = json.loads(body.decode('utf-8'))
            message_id = message.get('messageId')
            item_id = message.get('itemId')
            
            # Set context for this request
            self.worker_logger.set_context(
                correlation_id=message_id,
                request_id=message_id,
                item_id=item_id,
                operation="pdf_splitting_request"
            )
            
            self.worker_logger.info("Processing PDF splitting request", meta={
                'message_id': message_id,
                'item_id': item_id,
                'delivery_tag': method.delivery_tag,
                'message_size': len(body),
                'message_type': message.get('eventType'),
                'retry_count': message.get('retryCount', 0),
                'max_retries': message.get('maxRetries', 3),
                's3_url': message.get('s3Url'),
                'file_name': message.get('fileName'),
                'page_count': message.get('pageCount'),
                'split_size': message.get('splitSize')
            })
            
            # FIX: Simplified async/sync handling to prevent task scheduling issues
            try:
                self.worker_logger.info("=== ASYNC/SYNC CONTEXT DETECTION ===", meta={
                    'item_id': item_id,
                    'message_id': message_id,
                    'current_thread': str(asyncio.current_thread()),
                    'has_running_loop': asyncio.get_running_loop() is not None if hasattr(asyncio, 'get_running_loop') else 'unknown'
                })
                
                # Check if we're in an event loop
                try:
                    loop = asyncio.get_running_loop()
                    self.worker_logger.info("Detected running event loop, using asyncio.create_task()", meta={
                        'item_id': item_id,
                        'message_id': message_id,
                        'loop_type': 'existing',
                        'loop_id': id(loop),
                        'is_running': loop.is_running()
                    })
                    
                    # FIX: Create task with proper error handling and await it to ensure execution
                    async def process_with_ack():
                        try:
                            await self._process_pdf_splitting_async(item_id, message, start_time, channel, method)
                            # Acknowledge message after successful processing
                            self.worker_logger.info("Acknowledging message after async processing", meta={
                                'item_id': item_id,
                                'message_id': message_id,
                                'delivery_tag': method.delivery_tag
                            })
                            channel.basic_ack(delivery_tag=method.delivery_tag)
                        except Exception as processing_error:
                            self.worker_logger.error("Async processing failed", meta={
                                'item_id': item_id,
                                'message_id': message_id,
                                'processing_error': str(processing_error),
                                'processing_error_type': type(processing_error).__name__
                            }, exc_info=True)
                            # Negative acknowledge on failure
                            try:
                                channel.basic_nack(delivery_tag=method.delivery_tag, requeue=False)
                            except Exception as nack_error:
                                self.worker_logger.error("Failed to negative acknowledge message", meta={
                                    'item_id': item_id,
                                    'nack_error': str(nack_error)
                                })
                    
                    # Create and schedule the task
                    task = asyncio.create_task(process_with_ack())
                    self.worker_logger.info("Async task with acknowledgment scheduled successfully", meta={
                        'item_id': item_id,
                        'message_id': message_id,
                        'task_id': id(task)
                    })
                    
                    # FIX: Use loop.create_task and add callback to monitor task status
                    def task_callback(t):
                        if t.cancelled():
                            self.worker_logger.warning("Async task was cancelled", meta={
                                'item_id': item_id,
                                'message_id': message_id,
                                'task_id': id(t)
                            })
                        elif t.exception():
                            self.worker_logger.error("Async task failed with exception", meta={
                                'item_id': item_id,
                                'message_id': message_id,
                                'task_id': id(t),
                                'exception': str(t.exception())
                            })
                        else:
                            self.worker_logger.info("Async task completed successfully", meta={
                                'item_id': item_id,
                                'message_id': message_id,
                                'task_id': id(t)
                            })
                    
                    task.add_done_callback(task_callback)
                    self.worker_logger.info("Task monitoring callback attached, returning from handler", meta={
                        'item_id': item_id,
                        'message_id': message_id,
                        'task_id': id(task),
                        'task_status': 'scheduled_with_callback'
                    })
                    return
                    
                except RuntimeError as runtime_error:
                    self.worker_logger.info("No running event loop, using asyncio.run()", meta={
                        'item_id': item_id,
                        'message_id': message_id,
                        'loop_type': 'new',
                        'runtime_error': str(runtime_error)
                    })
                    # No running event loop, use asyncio.run() for backward compatibility
                    self.worker_logger.info("Starting asyncio.run() for sync processing", meta={
                        'item_id': item_id,
                        'message_id': message_id
                    })
                    asyncio.run(self._process_pdf_splitting_async(item_id, message, start_time, channel, method))
                    # Acknowledge message
                    self.worker_logger.info("Acknowledging message after sync processing", meta={
                        'item_id': item_id,
                        'message_id': message_id,
                        'delivery_tag': method.delivery_tag
                    })
                    channel.basic_ack(delivery_tag=method.delivery_tag)
                    self.worker_logger.info("Message processing completed (sync path)", meta={
                        'item_id': item_id,
                        'message_id': message_id
                    })
            except Exception as context_error:
                self.worker_logger.error("Error in async/sync context handling", meta={
                    'item_id': item_id,
                    'message_id': message_id,
                    'context_error': str(context_error),
                    'context_error_type': type(context_error).__name__
                }, exc_info=True)
                # FIX: Ensure message is acknowledged even if context handling fails
                try:
                    channel.basic_nack(delivery_tag=method.delivery_tag, requeue=False)
                except Exception as nack_error:
                    self.worker_logger.error("Failed to negative acknowledge message after context error", meta={
                        'item_id': item_id,
                        'nack_error': str(nack_error)
                    })
                raise
            
        except Exception as e:
            processing_time = (datetime.now() - start_time).total_seconds() * 1000
            error_message = str(e)
            item_id = message.get('itemId') if 'message' in locals() else 'unknown'
            
            self.worker_logger.error("PDF splitting request failed", meta={
                'item_id': item_id,
                'error': error_message,
                'error_type': type(e).__name__,
                'processing_time_ms': processing_time,
                'delivery_tag': method.delivery_tag if 'method' in locals() else 'unknown'
            }, exc_info=True)
            
            # Update status with error
            try:
                self.update_item_status(
                    item_id,
                    MessageTypes.FAILED,
                    f"PDF splitting failed: {error_message}",
                    error=error_message
                )
            except Exception as status_error:
                self.worker_logger.error("Failed to update item status", meta={
                    'item_id': item_id,
                    'status_error': str(status_error)
                }, exc_info=True)
            
            # Check if should retry
            if 'message' in locals():
                retry_count = message.get('retryCount', 0)
                max_retries = message.get('maxRetries', 3)
                should_retry = retry_count < max_retries
                
                if should_retry:
                    self.worker_logger.info("Scheduling retry", meta={
                        'item_id': item_id,
                        'retry_count': retry_count,
                        'max_retries': max_retries,
                        'next_attempt': retry_count + 1
                    })
                    
                    # Republish the request with incremented retry count
                    retry_request = {
                        **message,
                        'messageId': str(uuid.uuid4()),
                        'timestamp': int(datetime.now().timestamp()),
                        'retryCount': retry_count + 1,
                    }
                    
                    try:
                        self.rabbitmq_client.publish_message(
                            'pdf-splitting-request',
                            retry_request
                        )
                    except Exception as retry_error:
                        self.worker_logger.error("Failed to publish retry message", meta={
                            'item_id': item_id,
                            'retry_error': str(retry_error)
                        }, exc_info=True)
                else:
                    self.worker_logger.error("Max retries reached", meta={
                        'item_id': item_id,
                        'retry_count': retry_count,
                        'max_retries': max_retries
                    })
            
            # Clear context
            self.worker_logger.clear_context()
            
            # Negative acknowledge message
            try:
                channel.basic_nack(delivery_tag=method.delivery_tag, requeue=False)
            except Exception as nack_error:
                self.worker_logger.error("Failed to negative acknowledge message", meta={
                    'item_id': item_id,
                    'nack_error': str(nack_error)
                })
    
    async def _process_pdf_splitting_async(self, item_id: str, message: Dict, start_time: datetime, channel, method):
        """Async processing method for PDF splitting"""
        with self.worker_logger.context(operation="async_pdf_processing", item_id=item_id):
            try:
                self.worker_logger.info("=== STARTING ASYNC PDF PROCESSING ===", meta={
                    'item_id': item_id,
                    'message_id': message.get('messageId'),
                    's3_url': message.get('s3Url'),
                    'file_name': message.get('fileName'),
                    'split_size': message.get('splitSize', 25),
                    'delivery_tag': method.delivery_tag,
                    'async_task_id': id(asyncio.current_task()),
                    'current_loop': str(asyncio.get_running_loop()) if hasattr(asyncio, 'get_running_loop') else 'unknown'
                })
                
                # Create temporary directory
                temp_dir = tempfile.mkdtemp(prefix=f"pdf_split_{item_id}_")
                self.worker_logger.info("Created temporary directory", meta={
                    'item_id': item_id,
                    'temp_directory': temp_dir,
                    'directory_exists': os.path.exists(temp_dir),
                    'directory_permissions': oct(os.stat(temp_dir).st_mode)[-3:]
                })
                
                try:
                    # Download PDF from S3
                    pdf_path = os.path.join(temp_dir, 'original.pdf')
                    self.worker_logger.info("=== STARTING PDF DOWNLOAD ===", meta={
                        'item_id': item_id,
                        's3_url': message['s3Url'],
                        'local_path': pdf_path,
                        'download_start_time': datetime.now().isoformat(),
                        'temp_space_available': os.statvfs(temp_dir).f_bavail * os.statvfs(temp_dir).f_frsize if hasattr(os, 'statvfs') else 'unknown'
                    })
                    
                    download_start = time.time()
                    try:
                        await self.download_pdf_from_s3(message['s3Url'], pdf_path)
                        download_duration = (time.time() - download_start) * 1000
                        self.worker_logger.info("=== PDF DOWNLOAD COMPLETED ===", meta={
                            'item_id': item_id,
                            's3_url': message['s3Url'],
                            'local_path': pdf_path,
                            'download_duration_ms': round(download_duration, 2),
                            'download_completed_at': datetime.now().isoformat()
                        })
                    except Exception as download_error:
                        download_duration = (time.time() - download_start) * 1000
                        self.worker_logger.error("=== PDF DOWNLOAD FAILED ===", meta={
                            'item_id': item_id,
                            's3_url': message['s3Url'],
                            'local_path': pdf_path,
                            'download_error': str(download_error),
                            'download_error_type': type(download_error).__name__,
                            'download_attempt_duration_ms': round(download_duration, 2),
                            'download_failed_at': datetime.now().isoformat()
                        }, exc_info=True)
                        raise
                    
                    # Verify download
                    self.worker_logger.info("=== VERIFYING DOWNLOADED FILE ===", meta={
                        'item_id': item_id,
                        'local_path': pdf_path,
                        'file_exists_check': os.path.exists(pdf_path)
                    })
                    
                    if os.path.exists(pdf_path):
                        downloaded_size = os.path.getsize(pdf_path)
                        self.worker_logger.info("PDF downloaded successfully", meta={
                            'item_id': item_id,
                            'local_path': pdf_path,
                            'file_size_bytes': downloaded_size,
                            'file_size_mb': round(downloaded_size / (1024 * 1024), 2),
                            'file_readable': os.access(pdf_path, os.R_OK),
                            'file_writable': os.access(pdf_path, os.W_OK)
                        })
                    else:
                        self.worker_logger.error("Downloaded file not found", meta={
                            'item_id': item_id,
                            'local_path': pdf_path,
                            'temp_directory_contents': os.listdir(temp_dir) if os.path.exists(temp_dir) else 'temp_dir_not_found'
                        })
                        raise Exception("Downloaded file not found")
                    
                    # Update status to splitting
                    self.worker_logger.info("Updating status to splitting", meta={
                        'item_id': item_id,
                        'status': MessageTypes.SPLITTING
                    })
                    
                    self.update_item_status(
                        item_id,
                        MessageTypes.SPLITTING,
                        'Splitting PDF into parts'
                    )
                    
                    # Split PDF
                    split_size = message.get('splitSize', 25)
                    self.worker_logger.info("Starting PDF split", meta={
                        'item_id': item_id,
                        'split_size': split_size,
                        'input_path': pdf_path,
                        'output_directory': temp_dir
                    })
                    
                    parts_info = PDFSplitter.split_pdf(pdf_path, temp_dir, split_size, lambda *args, **kwargs: self.update_item_status(item_id=item_id if args[0] is None else args[0], **{k: v for k, v in kwargs.items() if k != 'item_id'}))
                    
                    self.worker_logger.info("PDF split completed", meta={
                        'item_id': item_id,
                        'total_parts': len(parts_info),
                        'split_size': split_size,
                        'total_pages': sum(p['page_count'] for p in parts_info)
                    })
                    
                    # Upload parts to S3
                    self.worker_logger.info("Starting parts upload to S3", meta={
                        'item_id': item_id,
                        'total_parts': len(parts_info),
                        'upload_batch_size': len(parts_info)
                    })
                    
                    uploaded_parts = await self.upload_parts_to_s3(parts_info, item_id, temp_dir, lambda *args, **kwargs: self.update_item_status(item_id=item_id if args[0] is None else args[0], **{k: v for k, v in kwargs.items() if k != 'item_id'}))
                    
                    self.worker_logger.info("All parts uploaded successfully", meta={
                        'item_id': item_id,
                        'uploaded_parts_count': len(uploaded_parts),
                        'parts_with_s3_urls': len([p for p in uploaded_parts if p.get('s3_url')])
                    })
                    
                    # Update status to processing
                    self.worker_logger.info("Updating status to processing", meta={
                        'item_id': item_id,
                        'status': MessageTypes.PROCESSING,
                        'parts_count': len(parts_info)
                    })
                    
                    self.update_item_status(
                        item_id,
                        MessageTypes.PROCESSING,
                        f"PDF split into {len(parts_info)} parts"
                    )
                    
                    # Send part conversion requests
                    self.worker_logger.info("Sending part conversion requests", meta={
                        'item_id': item_id,
                        'parts_count': len(uploaded_parts),
                        'original_request_id': message.get('messageId')
                    })
                    
                    await self.send_part_conversion_requests(item_id, uploaded_parts, message, lambda *args, **kwargs: self.update_item_status(item_id=item_id if args[0] is None else args[0], **{k: v for k, v in kwargs.items() if k != 'item_id'}))
                    
                    processing_time = (datetime.now() - start_time).total_seconds() * 1000
                    self.worker_logger.info("PDF splitting processing completed successfully", meta={
                        'item_id': item_id,
                        'total_parts': len(parts_info),
                        'total_processing_time_ms': round(processing_time, 2),
                        'total_processing_time_seconds': round(processing_time / 1000, 2),
                        'average_time_per_part_ms': round(processing_time / len(parts_info), 2) if parts_info else 0,
                        'temp_directory': temp_dir
                    })
                    
                finally:
                    # Clean up temporary directory
                    try:
                        import shutil
                        shutil.rmtree(temp_dir, ignore_errors=True)
                        self.worker_logger.debug("Temporary directory cleaned up", meta={
                            'item_id': item_id,
                            'temp_directory': temp_dir,
                            'cleanup_successful': not os.path.exists(temp_dir)
                        })
                    except Exception as cleanup_error:
                        self.worker_logger.warning("Failed to clean up temporary directory", meta={
                            'item_id': item_id,
                            'temp_directory': temp_dir,
                            'cleanup_error': str(cleanup_error)
                        })
                
                # Acknowledge message
                self.worker_logger.debug("Acknowledging message after successful processing", meta={
                    'item_id': item_id,
                    'delivery_tag': method.delivery_tag
                })
                
                channel.basic_ack(delivery_tag=method.delivery_tag)
                
            except Exception as e:
                processing_time = (datetime.now() - start_time).total_seconds() * 1000
                error_message = str(e)
                
                self.worker_logger.error("PDF splitting processing failed", meta={
                    'item_id': item_id,
                    'error': error_message,
                    'error_type': type(e).__name__,
                    'processing_time_ms': processing_time,
                    'delivery_tag': method.delivery_tag
                }, exc_info=True)
                
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
                    self.worker_logger.info("Scheduling retry", meta={
                        'item_id': item_id,
                        'retry_count': retry_count,
                        'max_retries': max_retries,
                        'next_attempt': retry_count + 1
                    })
                    
                    # Republish the request with incremented retry count
                    retry_request = {
                        **message,
                        'messageId': str(uuid.uuid4()),
                        'timestamp': int(datetime.now().timestamp()),
                        'retryCount': retry_count + 1,
                    }
                    
                    try:
                        self.rabbitmq_client.publish_message(
                            'pdf-splitting-request',
                            retry_request
                        )
                    except Exception as retry_error:
                        self.worker_logger.error("Failed to publish retry message", meta={
                            'item_id': item_id,
                            'retry_error': str(retry_error)
                        }, exc_info=True)
                else:
                    self.worker_logger.error("Max retries reached", meta={
                        'item_id': item_id,
                        'retry_count': retry_count,
                        'max_retries': max_retries
                    })
                
                # Negative acknowledge message
                try:
                    channel.basic_nack(delivery_tag=method.delivery_tag, requeue=False)
                except Exception as nack_error:
                    self.worker_logger.error("Failed to negative acknowledge message", meta={
                        'item_id': item_id,
                        'nack_error': str(nack_error)
                    })
            
            
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
        """Download PDF from S3/OSS URL"""
        download_logger = create_enhanced_logger('PDFDownloader')
        
        with download_logger.context(operation="download_pdf", s3_url=s3_url):
            try:
                download_logger.info("=== INITIATING PDF DOWNLOAD ===", meta={
                    's3_url': s3_url,
                    'output_path': output_path,
                    'timeout_seconds': 60,
                    'download_start_time': datetime.now().isoformat(),
                    'current_directory': os.getcwd(),
                    'output_directory': os.path.dirname(output_path),
                    'output_directory_exists': os.path.exists(os.path.dirname(output_path))
                })
                
                # Add headers to handle potential authentication
                headers = {
                    'User-Agent': 'PDF-Splitting-Worker/1.0',
                    'Accept': 'application/pdf,*/*'
                }
                
                download_logger.info("Initializing HTTP session", meta={
                    'headers': headers,
                    'timeout': 60,
                    'aiohttp_version': aiohttp.__version__ if hasattr(aiohttp, '__version__') else 'unknown'
                })
                
                start_time = time.time()
                session_start = time.time()
                
                try:
                    async with aiohttp.ClientSession(headers=headers) as session:
                        session_creation_time = (time.time() - session_start) * 1000
                        download_logger.info("HTTP session created successfully", meta={
                            's3_url': s3_url,
                            'session_creation_time_ms': round(session_creation_time, 2),
                            'session_id': id(session)
                        })
                        
                        request_start = time.time()
                        download_logger.info("=== SENDING HTTP GET REQUEST ===", meta={
                            's3_url': s3_url,
                            'method': 'GET',
                            'request_start_time': datetime.now().isoformat(),
                            'timeout': 60
                        })
                        
                        # FIX: Add retry mechanism for HTTP requests
                        max_retries = 3
                        retry_delay = 1  # seconds
                        
                        for attempt in range(max_retries):
                            try:
                                download_logger.info(f"HTTP request attempt {attempt + 1}/{max_retries}", meta={
                                    's3_url': s3_url,
                                    'attempt': attempt + 1,
                                    'max_attempts': max_retries,
                                    'retry_delay': retry_delay
                                })
                                
                                # FIX: Use shorter timeout with connection and read timeouts separately
                                timeout = aiohttp.ClientTimeout(total=30, connect=10, sock_read=20)
                                async with session.get(s3_url, timeout=timeout) as response:
                                    request_time = (time.time() - request_start) * 1000
                                    download_logger.info("=== HTTP RESPONSE RECEIVED ===", meta={
                                        's3_url': s3_url,
                                        'status_code': response.status,
                                        'content_type': response.headers.get('Content-Type'),
                                        'content_length': response.headers.get('Content-Length'),
                                        'response_headers': dict(response.headers),
                                        'request_time_ms': round(request_time, 2),
                                        'response_received_at': datetime.now().isoformat()
                                    })
                                    
                                    if response.status == 200:
                                        content_start = time.time()
                                        download_logger.info("=== READING RESPONSE CONTENT ===", meta={
                                            's3_url': s3_url,
                                            'content_read_start': datetime.now().isoformat()
                                        })
                                        
                                        content = await response.read()
                                        content_time = (time.time() - content_start) * 1000
                                        download_time = (time.time() - request_start) * 1000
                                        
                                        download_logger.info("=== CONTENT DOWNLOADED SUCCESSFULLY ===", meta={
                                            's3_url': s3_url,
                                            'content_length_bytes': len(content),
                                            'content_length_mb': round(len(content) / (1024 * 1024), 2),
                                            'content_read_time_ms': round(content_time, 2),
                                            'total_download_time_ms': round(download_time, 2)
                                        })
                                        
                                        write_start_time = time.time()
                                        download_logger.info("=== WRITING CONTENT TO FILE ===", meta={
                                            's3_url': s3_url,
                                            'output_path': output_path,
                                            'write_start_time': datetime.now().isoformat(),
                                            'content_size_bytes': len(content)
                                        })
                                        
                                        async with aiofiles.open(output_path, 'wb') as f:
                                            await f.write(content)
                                        
                                        write_time = (time.time() - write_start_time) * 1000
                                        file_size = os.path.getsize(output_path)
                                        
                                        download_logger.info("=== PDF FILE SAVED SUCCESSFULLY ===", meta={
                                            's3_url': s3_url,
                                            'output_path': output_path,
                                            'file_size_bytes': file_size,
                                            'file_size_mb': round(file_size / (1024 * 1024), 2),
                                            'write_time_ms': round(write_time, 2),
                                            'total_time_ms': round(download_time + write_time, 2),
                                            'download_speed_mbps': round((file_size / (1024 * 1024)) / (download_time / 1000), 2) if download_time > 0 else 0,
                                            'file_saved_at': datetime.now().isoformat()
                                        })
                                        # Success - break out of retry loop
                                        break
                                    else:
                                        error_start = time.time()
                                        download_logger.info("=== READING ERROR RESPONSE ===", meta={
                                            's3_url': s3_url,
                                            'status_code': response.status,
                                            'error_read_start': datetime.now().isoformat()
                                        })
                                        
                                        error_text = await response.text()
                                        error_time = (time.time() - error_start) * 1000
                                        
                                        download_logger.error("=== HTTP REQUEST FAILED ===", meta={
                                            's3_url': s3_url,
                                            'status_code': response.status,
                                            'status_text': response.reason,
                                            'error_text': error_text[:500],  # Limit error text length
                                            'error_read_time_ms': round(error_time, 2),
                                            'response_headers': dict(response.headers),
                                            'total_request_time_ms': round(request_time, 2)
                                        })
                                        raise Exception(f"Failed to download PDF: HTTP {response.status} - {error_text}")
                                        
                            except asyncio.TimeoutError as timeout_error:
                                request_time = (time.time() - request_start) * 1000
                                download_logger.warning(f"HTTP request timeout on attempt {attempt + 1}/{max_retries}", meta={
                                    's3_url': s3_url,
                                    'attempt': attempt + 1,
                                    'max_attempts': max_retries,
                                    'timeout_seconds': 30,
                                    'request_time_ms': round(request_time, 2),
                                    'timeout_error': str(timeout_error),
                                    'timeout_at': datetime.now().isoformat()
                                })
                                
                                if attempt < max_retries - 1:
                                    download_logger.info(f"Retrying in {retry_delay} seconds...", meta={
                                        's3_url': s3_url,
                                        'retry_delay': retry_delay,
                                        'next_attempt': attempt + 2
                                    })
                                    await asyncio.sleep(retry_delay)
                                    retry_delay *= 2  # Exponential backoff
                                    continue
                                else:
                                    download_logger.error("=== HTTP REQUEST TIMEOUT - ALL RETRIES FAILED ===", meta={
                                        's3_url': s3_url,
                                        'max_attempts': max_retries,
                                        'total_elapsed_time_ms': round((time.time() - request_start) * 1000, 2)
                                    })
                                    raise Exception(f"Timeout downloading PDF from S3/OSS after {max_retries} attempts: {s3_url}")
                                    
                            except Exception as request_error:
                                request_time = (time.time() - request_start) * 1000
                                download_logger.warning(f"HTTP request failed on attempt {attempt + 1}/{max_retries}", meta={
                                    's3_url': s3_url,
                                    'attempt': attempt + 1,
                                    'max_attempts': max_retries,
                                    'request_error': str(request_error),
                                    'request_error_type': type(request_error).__name__,
                                    'request_time_ms': round(request_time, 2),
                                    'request_failed_at': datetime.now().isoformat()
                                })
                                
                                if attempt < max_retries - 1:
                                    download_logger.info(f"Retrying in {retry_delay} seconds...", meta={
                                        's3_url': s3_url,
                                        'retry_delay': retry_delay,
                                        'next_attempt': attempt + 2
                                    })
                                    await asyncio.sleep(retry_delay)
                                    retry_delay *= 2  # Exponential backoff
                                    continue
                                else:
                                    download_logger.error("=== HTTP REQUEST FAILED - ALL RETRIES FAILED ===", meta={
                                        's3_url': s3_url,
                                        'max_attempts': max_retries,
                                        'request_error': str(request_error),
                                        'request_error_type': type(request_error).__name__,
                                        'total_elapsed_time_ms': round((time.time() - request_start) * 1000, 2)
                                    }, exc_info=True)
                                    raise Exception(f"Failed to download PDF from S3/OSS after {max_retries} attempts: {request_error}")
                            
                except Exception as session_error:
                    session_creation_time = (time.time() - session_start) * 1000
                    download_logger.error("=== HTTP SESSION CREATION FAILED ===", meta={
                        's3_url': s3_url,
                        'session_error': str(session_error),
                        'session_error_type': type(session_error).__name__,
                        'session_creation_time_ms': round(session_creation_time, 2),
                        'session_failed_at': datetime.now().isoformat()
                    }, exc_info=True)
                    raise
                            
            except asyncio.TimeoutError:
                total_time = (time.time() - start_time) * 1000
                download_logger.error("=== DOWNLOAD TIMEOUT ===", meta={
                    's3_url': s3_url,
                    'timeout_seconds': 60,
                    'total_elapsed_time_ms': round(total_time, 2),
                    'timeout_at': datetime.now().isoformat()
                })
                raise Exception(f"Timeout downloading PDF from S3/OSS: {s3_url}")
            except Exception as e:
                total_time = (time.time() - start_time) * 1000
                download_logger.error("=== DOWNLOAD FAILED ===", meta={
                    's3_url': s3_url,
                    'output_path': output_path,
                    'error': str(e),
                    'error_type': type(e).__name__,
                    'total_elapsed_time_ms': round(total_time, 2),
                    'download_failed_at': datetime.now().isoformat()
                }, exc_info=True)
                raise
    
    async def upload_parts_to_s3(self, parts_info: List[Dict], item_id: str, temp_dir: str, progress_callback=None) -> List[Dict]:
        """Upload split parts to S3"""
        upload_logger = create_enhanced_logger('PartsUploader')
        
        with upload_logger.context(operation="upload_parts", item_id=item_id):
            uploaded_parts = []
            upload_start_time = time.time()
            
            upload_logger.info("Starting parts upload", meta={
                'item_id': item_id,
                'total_parts': len(parts_info),
                'temp_directory': temp_dir,
                'upload_strategy': 'sequential'
            })
            
            for i, part in enumerate(parts_info):
                # Calculate and report upload progress
                progress_percentage = int((i / len(parts_info)) * 100)
                if progress_callback:
                    progress_callback(
                        item_id=item_id,
                        status=MessageTypes.PROCESSING,
                        message=f"Uploading part {i + 1} of {len(parts_info)} to storage",
                        progress=progress_percentage
                    )
                part_start_time = time.time()
                
                try:
                    part_path = os.path.join(temp_dir, part['filename'])
                    
                    upload_logger.info(f"Uploading part {i + 1}/{len(parts_info)}", meta={
                        'item_id': item_id,
                        'part_index': part['part_index'],
                        'part_number': i + 1,
                        'total_parts': len(parts_info),
                        'filename': part['filename'],
                        'file_path': part_path,
                        'file_size_bytes': part['file_size_bytes'],
                        'file_size_mb': round(part['file_size_bytes'] / (1024 * 1024), 2)
                    })
                    
                    # Verify file exists before upload
                    if not os.path.exists(part_path):
                        raise Exception(f"Part file not found: {part_path}")
                    
                    upload_result = await self.s3_client.upload_part(
                        part_path, item_id, part['part_index'], progress_callback
                    )
                    
                    part_duration = (time.time() - part_start_time) * 1000
                    
                    uploaded_part = {
                        **part,
                        's3_key': upload_result['s3_key'],
                        's3_url': upload_result['s3_url'],
                        'status': MessageTypes.PART_PENDING,
                        'upload_time_ms': round(part_duration, 2),
                        'upload_speed_mbps': round((part['file_size_bytes'] / (1024 * 1024)) / (part_duration / 1000), 2) if part_duration > 0 else 0
                    }
                    
                    uploaded_parts.append(uploaded_part)
                    
                    # Report progress after each successful upload
                    if progress_callback:
                        progress_percentage = int(((i + 1) / len(parts_info)) * 100)
                        progress_callback(
                            item_id=item_id,
                            status=MessageTypes.PROCESSING,
                            message=f"Uploaded part {i + 1} of {len(parts_info)} to storage ({progress_percentage}%)",
                            progress=progress_percentage
                        )
                    
                    upload_logger.info(f"Part {i + 1} uploaded successfully", meta={
                        'item_id': item_id,
                        'part_index': part['part_index'],
                        'part_number': i + 1,
                        's3_key': upload_result['s3_key'],
                        's3_url': upload_result['s3_url'],
                        'upload_time_ms': round(part_duration, 2),
                        'upload_speed_mbps': uploaded_part['upload_speed_mbps']
                    })
                    
                except Exception as e:
                    part_duration = (time.time() - part_start_time) * 1000
                    upload_logger.error(f"Failed to upload part {i + 1}", meta={
                        'item_id': item_id,
                        'part_index': part['part_index'],
                        'part_number': i + 1,
                        'filename': part.get('filename'),
                        'file_path': part_path if 'part_path' in locals() else None,
                        'error': str(e),
                        'error_type': type(e).__name__,
                        'attempt_duration_ms': round(part_duration, 2)
                    }, exc_info=True)
                    raise
            
            total_upload_time = (time.time() - upload_start_time) * 1000
            total_size_uploaded = sum(p['file_size_bytes'] for p in uploaded_parts)
            avg_upload_speed = total_size_uploaded / (total_upload_time / 1000) / (1024 * 1024) if total_upload_time > 0 else 0
            
            upload_logger.info("All parts uploaded successfully", meta={
                'item_id': item_id,
                'total_parts_uploaded': len(uploaded_parts),
                'total_size_bytes': total_size_uploaded,
                'total_size_mb': round(total_size_uploaded / (1024 * 1024), 2),
                'total_upload_time_ms': round(total_upload_time, 2),
                'average_upload_speed_mbps': round(avg_upload_speed, 2),
                'average_part_upload_time_ms': round(total_upload_time / len(uploaded_parts), 2) if uploaded_parts else 0
            })
            
            return uploaded_parts
    
    async def send_part_conversion_requests(self, item_id: str, parts: List[Dict], original_request: Dict, progress_callback=None):
        """Send part conversion requests for each part"""
        request_logger = create_enhanced_logger('ConversionRequester')
        
        with request_logger.context(operation="send_conversion_requests", item_id=item_id):
            concurrent_limit = 3  # Process 3 parts concurrently
            total_parts = len(parts)
            request_start_time = time.time()
            
            request_logger.info("Starting part conversion requests", meta={
                'item_id': item_id,
                'total_parts': total_parts,
                'concurrent_limit': concurrent_limit,
                'batch_strategy': f'batches_of_{concurrent_limit}',
                'original_request_id': original_request.get('messageId')
            })
            
            # Process parts in batches
            batch_count = 0
            for i in range(0, total_parts, concurrent_limit):
                # Calculate overall progress for conversion requests
                progress_percentage = int((i / total_parts) * 100)
                if progress_callback:
                    progress_callback(
                        item_id=item_id,
                        status=MessageTypes.PROCESSING,
                        message=f"Sending conversion requests for parts {i + 1}-{min(i + concurrent_limit, total_parts)} of {total_parts}",
                        progress=progress_percentage
                    )
                batch_start_time = time.time()
                batch = parts[i:i + concurrent_limit]
                batch_count += 1
                
                request_logger.info(f"Processing batch {batch_count}", meta={
                    'item_id': item_id,
                    'batch_number': batch_count,
                    'batch_size': len(batch),
                    'batch_parts': f"{i + 1}-{min(i + concurrent_limit, total_parts)}/{total_parts}"
                })
                
                for j, part in enumerate(batch):
                    part_request = {
                        'messageId': str(uuid.uuid4()),
                        'timestamp': int(datetime.now().timestamp()),
                        'eventType': MessageTypes.PDF_PART_CONVERSION_REQUEST,
                        'itemId': item_id,
                        'partIndex': part['part_index'],
                        'totalParts': total_parts,
                        's3Url': part['s3_url'],
                        's3Key': part['s3_key'],
                        'fileName': f"{original_request['fileName']}_part_{part['part_index'] + 1}",
                        'startPage': part['start_page'],
                        'endPage': part['end_page'],
                        'priority': original_request.get('priority', 'normal'),
                        'retryCount': 0,
                        'maxRetries': original_request.get('maxRetries', 3),
                        'originalRequestId': original_request.get('messageId'),
                        'batchNumber': batch_count,
                        'partInBatch': j + 1
                    }
                    
                    request_logger.debug(f"Sending conversion request for part {part['part_index'] + 1}", meta={
                        'item_id': item_id,
                        'part_index': part['part_index'],
                        'part_number': part['part_index'] + 1,
                        'total_parts': total_parts,
                        'request_id': part_request['messageId'],
                        's3_key': part['s3_key'],
                        'start_page': part['start_page'],
                        'end_page': part['end_page'],
                        'priority': part_request['priority']
                    })
                    
                    self.rabbitmq_client.publish_message(
                        'pdf-part-conversion-request',
                        part_request
                    )
                    
                    # Report progress after each conversion request is sent
                    if progress_callback:
                        progress_percentage = int(((i + j + 1) / total_parts) * 100)
                        progress_callback(
                            item_id=item_id,
                            status=MessageTypes.PROCESSING,
                            message=f"Sent conversion request for part {part['part_index'] + 1} of {total_parts} ({progress_percentage}%)",
                            progress=progress_percentage
                        )
                    
                    request_logger.info(f"Conversion request sent for part {part['part_index'] + 1}", meta={
                        'item_id': item_id,
                        'part_index': part['part_index'],
                        'part_number': part['part_index'] + 1,
                        'total_parts': total_parts,
                        'request_id': part_request['messageId'],
                        's3_url': part['s3_url']
                    })
                
                batch_duration = (time.time() - batch_start_time) * 1000
                request_logger.info(f"Batch {batch_count} completed", meta={
                    'item_id': item_id,
                    'batch_number': batch_count,
                    'batch_size': len(batch),
                    'batch_duration_ms': round(batch_duration, 2),
                    'average_part_request_time_ms': round(batch_duration / len(batch), 2)
                })
                
                # Small delay between batches
                if i + concurrent_limit < total_parts:
                    request_logger.debug(f"Delaying before next batch", meta={
                        'item_id': item_id,
                        'delay_seconds': 1,
                        'completed_parts': i + concurrent_limit,
                        'remaining_parts': total_parts - (i + concurrent_limit)
                    })
                    await asyncio.sleep(1)
            
            total_request_time = (time.time() - request_start_time) * 1000
            
            request_logger.info("All conversion requests sent successfully", meta={
                'item_id': item_id,
                'total_parts': total_parts,
                'total_batches': batch_count,
                'total_request_time_ms': round(total_request_time, 2),
                'average_request_time_per_part_ms': round(total_request_time / total_parts, 2),
                'requests_per_second': round(total_parts / (total_request_time / 1000), 2) if total_request_time > 0 else 0
            })
    
    def update_item_status(self, item_id: str, status: str, message: str, progress: Optional[int] = None, error: Optional[str] = None):
        """Update item status with enhanced progress tracking"""
        status_logger = create_enhanced_logger('StatusUpdater')
        
        with status_logger.context(operation="update_status", item_id=item_id):
            try:
                # Calculate estimated completion time if progress is provided
                estimated_completion = None
                processing_rate = None
                
                if progress is not None and 0 < progress < 100:
                    # Store progress timestamp for rate calculation
                    if not hasattr(self, '_progress_tracking'):
                        self._progress_tracking = {}
                    
                    if item_id not in self._progress_tracking:
                        self._progress_tracking[item_id] = {
                            'start_time': datetime.now(),
                            'last_progress': 0,
                            'last_time': datetime.now()
                        }
                    
                    tracking = self._progress_tracking[item_id]
                    current_time = datetime.now()
                    
                    # Calculate processing rate
                    if progress > tracking['last_progress']:
                        time_diff = (current_time - tracking['last_time']).total_seconds()
                        progress_diff = progress - tracking['last_progress']
                        
                        if time_diff > 0:
                            processing_rate = progress_diff / time_diff  # progress percentage per second
                            
                            # Estimate remaining time
                            remaining_progress = 100 - progress
                            if processing_rate > 0:
                                estimated_seconds = remaining_progress / processing_rate
                                estimated_completion = (current_time + timedelta(seconds=estimated_seconds)).isoformat()
                    
                    # Update tracking
                    tracking['last_progress'] = progress
                    tracking['last_time'] = current_time
                
                # Ensure progress is within valid range
                if progress is not None:
                    progress = max(0, min(100, progress))
                
                status_update = {
                    'messageId': str(uuid.uuid4()),
                    'timestamp': int(datetime.now().timestamp()),
                    'eventType': MessageTypes.PDF_CONVERSION_PROGRESS,
                    'itemId': item_id,
                    'status': status,
                    'progress': progress,
                    'message': message,
                    'error': error,
                    'worker_type': 'pdf_splitting_worker',
                    'estimated_completion': estimated_completion,
                    'processing_rate': round(processing_rate, 2) if processing_rate else None
                }
                
                status_logger.info("Updating item status", meta={
                    'item_id': item_id,
                    'status': status,
                    'message': message,
                    'progress': progress,
                    'error': error,
                    'estimated_completion': estimated_completion,
                    'processing_rate': processing_rate,
                    'status_update_id': status_update['messageId'],
                    'queue_name': 'pdf-conversion-progress'
                })
                
                self.rabbitmq_client.publish_message('pdf-conversion-progress', status_update)
                
                status_logger.info("Status update sent successfully", meta={
                    'item_id': item_id,
                    'status': status,
                    'progress': progress,
                    'status_update_id': status_update['messageId']
                })
                
            except Exception as e:
                status_logger.error("Failed to update item status", meta={
                    'item_id': item_id,
                    'status': status,
                    'message': message,
                    'progress': progress,
                    'error': error,
                    'update_error': str(e),
                    'update_error_type': type(e).__name__
                }, exc_info=True)
                raise


async def main():
    """Main function to run the PDF splitting worker"""
    main_logger = create_enhanced_logger('PdfSplittingWorkerMain')
    
    with main_logger.context(operation="worker_main"):
        try:
            main_logger.info("Starting PDF splitting worker main function", meta={
                'python_version': f"{os.sys.version_info.major}.{os.sys.version_info.minor}.{os.sys.version_info.micro}",
                'process_id': os.getpid(),
                'working_directory': os.getcwd(),
                'start_time': datetime.now().isoformat()
            })
            
            # Import configuration
            from config import Config
            
            # Get configuration from Config class
            rabbitmq_config = Config.get_rabbitmq_config()
            s3_config = Config.get_s3_config()
            
            main_logger.info("Configuration loaded", meta={
                'rabbitmq_host': rabbitmq_config.get('host'),
                'rabbitmq_port': rabbitmq_config.get('port'),
                'rabbitmq_vhost': rabbitmq_config.get('virtual_host'),
                's3_bucket': s3_config.get('bucket'),
                's3_endpoint': s3_config.get('endpoint'),
                'has_s3_credentials': bool(s3_config.get('access_key') and s3_config.get('secret_key'))
            })
            
            # Create and start worker
            worker = PdfSplittingWorker(rabbitmq_config, s3_config)
            
            main_logger.info("Worker instance created", meta={
                'worker_id': id(worker),
                'worker_type': 'PdfSplittingWorker'
            })
            
            await worker.start()
            
            main_logger.info("PDF splitting worker is running. Press Ctrl+C to stop.", meta={
                'worker_id': id(worker),
                'status': 'running'
            })
            
            # Keep the worker running
            heartbeat_count = 0
            while worker.is_running:
                await asyncio.sleep(1)
                heartbeat_count += 1
                
                # Log heartbeat every 60 seconds
                if heartbeat_count % 60 == 0:
                    main_logger.debug("Worker heartbeat", meta={
                        'worker_id': id(worker),
                        'uptime_seconds': heartbeat_count,
                        'status': 'running'
                    })
                
        except KeyboardInterrupt:
            main_logger.info("Received interrupt signal, stopping worker...", meta={
                'worker_id': id(worker) if 'worker' in locals() else None,
                'signal': 'SIGINT'
            })
        except Exception as e:
            main_logger.error("Worker encountered an error", meta={
                'worker_id': id(worker) if 'worker' in locals() else None,
                'error': str(e),
                'error_type': type(e).__name__
            }, exc_info=True)
        finally:
            if 'worker' in locals():
                try:
                    worker.stop()
                    main_logger.info("Worker stopped successfully", meta={
                        'worker_id': id(worker),
                        'stop_time': datetime.now().isoformat()
                    })
                except Exception as stop_error:
                    main_logger.error("Error during worker shutdown", meta={
                        'worker_id': id(worker),
                        'stop_error': str(stop_error),
                        'stop_error_type': type(stop_error).__name__
                    }, exc_info=True)
            else:
                main_logger.info("Worker shutdown completed (no worker instance to stop)")


if __name__ == "__main__":
    asyncio.run(main())