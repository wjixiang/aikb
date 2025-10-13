#!/usr/bin/env python3
"""
Integration test for the Python PDF Splitting Worker
This script tests the integration between the Python PDF splitter and the existing RabbitMQ system.
"""

import asyncio
import json
import os
import tempfile
import time
import uuid
from pathlib import Path
from typing import Dict, Any

import pika
from PyPDF2 import PdfReader, PdfWriter
from logger import create_logger_with_prefix

# Create logger with unified configuration
logger = create_logger_with_prefix('PdfSplittingIntegrationTest')


class PDFSplittingIntegrationTest:
    """Integration test class for PDF splitting"""
    
    def __init__(self):
        self.rabbitmq_config = {
            'host': os.getenv('RABBITMQ_HOSTNAME', 'localhost'),
            'port': int(os.getenv('RABBITMQ_PORT', 5672)),
            'username': os.getenv('RABBITMQ_USERNAME', 'admin'),
            'password': os.getenv('RABBITMQ_PASSWORD', 'admin123'),
            'virtual_host': os.getenv('RABBITMQ_VHOST', 'my_vhost'),
        }
        self.connection = None
        self.channel = None
        self.test_results = []
        
    def create_test_pdf(self, num_pages: int, output_path: str) -> None:
        """Create a test PDF with specified number of pages"""
        writer = PdfWriter()
        
        for i in range(num_pages):
            # Create a simple page
            page = PdfReader(
                BytesIO(
                    b'%PDF-1.4\n1 0 obj\n<<\n/Type /Page\n/MediaBox [0 0 612 792]\n/Contents 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Length 44\n>>\nstream\nBT\n/F1 12 Tf\n72 720 Td\n(Page %d) Tj\nET\nendstream\nendobj\nxref\n0 3\n0000000000 65535 f\n0000000010 00000 n\n0000000079 00000 n\ntrailer\n<<\n/Size 3\n/Root 1 0 R\n>>\nstartxref\n164\n%%EOF' % (i + 1)
                )
            ).pages[0]
            writer.add_page(page)
        
        with open(output_path, 'wb') as f:
            writer.write(f)
    
    def connect_to_rabbitmq(self):
        """Connect to RabbitMQ"""
        try:
            url = f"amqp://{self.rabbitmq_config['username']}:{self.rabbitmq_config['password']}@{self.rabbitmq_config['host']}:{self.rabbitmq_config['port']}/{self.rabbitmq_config['virtual_host']}"
            self.connection = pika.BlockingConnection(pika.URLParameters(url))
            self.channel = self.connection.channel()
            
            # Declare queues
            self.channel.queue_declare(queue='pdf-splitting-request', durable=True)
            self.channel.queue_declare(queue='pdf-conversion-progress', durable=True)
            self.channel.queue_declare(queue='pdf-part-conversion-request', durable=True)
            
            logger.info("Connected to RabbitMQ successfully")
            return True
        except Exception as e:
            logger.error(f"Failed to connect to RabbitMQ: {e}")
            return False
    
    def disconnect_from_rabbitmq(self):
        """Disconnect from RabbitMQ"""
        if self.connection and not self.connection.is_closed:
            self.connection.close()
            logger.info("Disconnected from RabbitMQ")
    
    def send_splitting_request(self, test_data: Dict[str, Any]) -> str:
        """Send a PDF splitting request"""
        try:
            message_id = str(uuid.uuid4())
            message = {
                'messageId': message_id,
                'timestamp': int(time.time()),
                'eventType': 'PDF_SPLITTING_REQUEST',
                'itemId': test_data['item_id'],
                's3Url': test_data['s3_url'],
                's3Key': test_data['s3_key'],
                'fileName': test_data['file_name'],
                'pageCount': test_data['page_count'],
                'splitSize': test_data.get('split_size', 25),
                'priority': 'normal',
                'retryCount': 0,
                'maxRetries': 3,
            }
            
            self.channel.basic_publish(
                exchange='',
                routing_key='pdf-splitting-request',
                body=json.dumps(message),
                properties=pika.BasicProperties(
                    delivery_mode=2,  # Make message persistent
                    message_id=message_id,
                    timestamp=int(time.time())
                )
            )
            
            logger.info(f"Sent splitting request: {message_id}")
            return message_id
        except Exception as e:
            logger.error(f"Failed to send splitting request: {e}")
            raise
    
    def listen_for_responses(self, timeout: int = 60) -> Dict[str, Any]:
        """Listen for responses from the worker"""
        responses = {}
        start_time = time.time()
        
        def callback(ch, method, properties, body):
            try:
                message = json.loads(body.decode('utf-8'))
                message_id = message.get('messageId')
                event_type = message.get('eventType')
                
                logger.info(f"Received message: {event_type} - {message_id}")
                
                if message_id not in responses:
                    responses[message_id] = []
                
                responses[message_id].append(message)
                
                # Acknowledge the message
                ch.basic_ack(delivery_tag=method.delivery_tag)
            except Exception as e:
                logger.error(f"Error processing message: {e}")
                ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)
        
        # Start consuming
        self.channel.basic_consume(
            queue='pdf-conversion-progress',
            on_message_callback=callback,
            auto_ack=False
        )
        
        self.channel.basic_consume(
            queue='pdf-part-conversion-request',
            on_message_callback=callback,
            auto_ack=False
        )
        
        # Wait for responses or timeout
        while time.time() - start_time < timeout:
            if self.connection and not self.connection.is_closed:
                self.connection.process_data_events(time_limit=1)
            else:
                break
        
        return responses
    
    def run_test(self, test_name: str, num_pages: int, split_size: int = 25) -> bool:
        """Run a single integration test"""
        logger.info(f"Running test: {test_name}")
        
        try:
            # Create test PDF
            with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp_file:
                self.create_test_pdf(num_pages, tmp_file.name)
                pdf_path = tmp_file.name
            
            # Prepare test data
            test_data = {
                'item_id': f"test-{uuid.uuid4()}",
                's3_url': f"file://{pdf_path}",  # Use file:// for local testing
                's3_key': f"test/{os.path.basename(pdf_path)}",
                'file_name': f"{test_name}.pdf",
                'page_count': num_pages,
                'split_size': split_size,
            }
            
            # Send splitting request
            message_id = self.send_splitting_request(test_data)
            
            # Listen for responses
            responses = self.listen_for_responses(timeout=30)
            
            # Analyze results
            if message_id in responses:
                messages = responses[message_id]
                progress_messages = [m for m in messages if m.get('eventType') == 'PDF_CONVERSION_PROGRESS']
                part_requests = [m for m in messages if m.get('eventType') == 'PDF_PART_CONVERSION_REQUEST']
                
                # Check if we received progress updates
                if progress_messages:
                    # Check if processing completed or failed
                    final_status = progress_messages[-1].get('status')
                    
                    if final_status == 'processing':
                        expected_parts = (num_pages + split_size - 1) // split_size
                        actual_parts = len(part_requests)
                        
                        if actual_parts == expected_parts:
                            logger.info(f"✅ Test '{test_name}' PASSED: {actual_parts} parts created")
                            result = True
                        else:
                            logger.error(f"❌ Test '{test_name}' FAILED: Expected {expected_parts} parts, got {actual_parts}")
                            result = False
                    elif final_status == 'failed':
                        logger.error(f"❌ Test '{test_name}' FAILED: Processing failed - {progress_messages[-1].get('error', 'Unknown error')}")
                        result = False
                    else:
                        logger.error(f"❌ Test '{test_name}' FAILED: Unexpected final status: {final_status}")
                        result = False
                else:
                    logger.error(f"❌ Test '{test_name}' FAILED: No progress messages received")
                    result = False
            else:
                logger.error(f"❌ Test '{test_name}' FAILED: No responses received")
                result = False
            
            # Cleanup
            os.unlink(pdf_path)
            self.test_results.append({'test': test_name, 'passed': result})
            return result
            
        except Exception as e:
            logger.error(f"❌ Test '{test_name}' ERROR: {e}")
            self.test_results.append({'test': test_name, 'passed': False, 'error': str(e)})
            return False
    
    def run_all_tests(self) -> bool:
        """Run all integration tests"""
        logger.info("Starting PDF Splitting Integration Tests")
        
        if not self.connect_to_rabbitmq():
            logger.error("Cannot connect to RabbitMQ, aborting tests")
            return False
        
        try:
            # Test cases
            test_cases = [
                ("Small PDF", 10, 5),
                ("Medium PDF", 50, 25),
                ("Large PDF", 100, 25),
                ("Very Large PDF", 200, 25),
            ]
            
            all_passed = True
            for test_name, num_pages, split_size in test_cases:
                passed = self.run_test(test_name, num_pages, split_size)
                all_passed = all_passed and passed
                time.sleep(2)  # Small delay between tests
            
            # Print summary
            logger.info("\n=== Test Summary ===")
            passed_count = sum(1 for result in self.test_results if result['passed'])
            total_count = len(self.test_results)
            
            for result in self.test_results:
                status = "✅ PASSED" if result['passed'] else "❌ FAILED"
                error_info = f" - {result.get('error', '')}" if not result['passed'] and 'error' in result else ""
                logger.info(f"{result['test']}: {status}{error_info}")
            
            logger.info(f"\nOverall: {passed_count}/{total_count} tests passed")
            
            return all_passed
            
        finally:
            self.disconnect_from_rabbitmq()


def main():
    """Main function"""
    test = PDFSplittingIntegrationTest()
    success = test.run_all_tests()
    
    if success:
        logger.info("🎉 All integration tests passed!")
        return 0
    else:
        logger.error("💥 Some integration tests failed!")
        return 1


if __name__ == "__main__":
    import sys
    from io import BytesIO
    sys.exit(main())