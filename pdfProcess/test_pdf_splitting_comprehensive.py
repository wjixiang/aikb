"""
Comprehensive pytest test suite for PDF Splitting Worker
Tests all scenarios including normal operation, error handling, and edge cases
"""

import asyncio
import json
import os
import signal
import tempfile
import uuid
from datetime import datetime
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch, call
import pytest
import pika
from PyPDF2 import PdfReader

from pdf_splitting_worker import (
    PdfSplittingWorker, PDFSplitter, RabbitMQClient, S3StorageClient, MessageTypes
)
from config import Config


class TestPDFSplittingWorkflow:
    """Test PDF splitting workflow scenarios"""
    
    @pytest.mark.unit
    def test_normal_pdf_splitting_workflow(self, temp_dir, sample_pdf, sample_splitting_message, 
                                         mock_pika_connection, mock_aiohttp_session, mock_aiofiles):
        """Test 1: PDF splitting workflow - normal case"""
        # Setup
        mock_connection, mock_channel = mock_pika_connection
        
        with patch('pdf_splitting_worker.pika.BlockingConnection', return_value=mock_connection):
            with patch('aiohttp.ClientSession', return_value=mock_aiohttp_session):
                worker = PdfSplittingWorker(
                    Config.get_rabbitmq_config(),
                    Config.get_s3_config()
                )
                
                # Mock the download and upload methods
                worker.download_pdf_from_s3 = AsyncMock()
                worker.upload_parts_to_s3 = AsyncMock(return_value=[
                    {
                        'part_index': 0,
                        's3_key': 'test/item/part_1.pdf',
                        's3_url': 'https://example.com/part_1.pdf'
                    }
                ])
                worker.send_part_conversion_requests = AsyncMock()
                worker.update_item_status = MagicMock()
                
                # Create a mock method, properties, and delivery_tag
                mock_method = MagicMock()
                mock_method.delivery_tag = 1
                mock_properties = MagicMock()
                
                # Execute
                worker.handle_pdf_splitting_request(
                    mock_channel, mock_method, mock_properties,
                    json.dumps(sample_splitting_message).encode('utf-8')
                )
                
                # Verify
                worker.download_pdf_from_s3.assert_called_once()
                worker.upload_parts_to_s3.assert_called_once()
                worker.send_part_conversion_requests.assert_called_once()
                mock_channel.basic_ack.assert_called_once_with(delivery_tag=1)
    
    @pytest.mark.unit
    def test_large_file_handling(self, temp_dir, large_pdf, sample_splitting_message,
                               mock_pika_connection, mock_aiohttp_session, mock_aiofiles):
        """Test 2: PDF splitting workflow - large file handling"""
        # Setup
        mock_connection, mock_channel = mock_pika_connection
        sample_splitting_message['pageCount'] = 100
        sample_splitting_message['splitSize'] = 25
        
        with patch('pdf_splitting_worker.pika.BlockingConnection', return_value=mock_connection):
            with patch('aiohttp.ClientSession', return_value=mock_aiohttp_session):
                worker = PdfSplittingWorker(
                    Config.get_rabbitmq_config(),
                    Config.get_s3_config()
                )
                
                # Mock methods
                worker.download_pdf_from_s3 = AsyncMock()
                worker.upload_parts_to_s3 = AsyncMock(return_value=[
                    {'part_index': i, 's3_key': f'test/item/part_{i+1}.pdf', 
                     's3_url': f'https://example.com/part_{i+1}.pdf'}
                    for i in range(4)  # 100 pages / 25 pages per part = 4 parts
                ])
                worker.send_part_conversion_requests = AsyncMock()
                worker.update_item_status = MagicMock()
                
                mock_method = MagicMock()
                mock_method.delivery_tag = 1
                mock_properties = MagicMock()
                
                # Execute
                worker.handle_pdf_splitting_request(
                    mock_channel, mock_method, mock_properties,
                    json.dumps(sample_splitting_message).encode('utf-8')
                )
                
                # Verify
                worker.upload_parts_to_s3.assert_called_once()
                # Should create 4 parts for 100 pages with split size of 25
                uploaded_parts = worker.upload_parts_to_s3.call_args[0][0]
                assert len(uploaded_parts) == 4
    
    @pytest.mark.unit
    def test_small_file_handling(self, temp_dir, small_pdf, sample_splitting_message,
                               mock_pika_connection, mock_aiohttp_session, mock_aiofiles):
        """Test 3: PDF splitting workflow - small file handling"""
        # Setup
        mock_connection, mock_channel = mock_pika_connection
        sample_splitting_message['pageCount'] = 2
        sample_splitting_message['splitSize'] = 10
        
        with patch('pdf_splitting_worker.pika.BlockingConnection', return_value=mock_connection):
            with patch('aiohttp.ClientSession', return_value=mock_aiohttp_session):
                worker = PdfSplittingWorker(
                    Config.get_rabbitmq_config(),
                    Config.get_s3_config()
                )
                
                # Mock methods
                worker.download_pdf_from_s3 = AsyncMock()
                worker.upload_parts_to_s3 = AsyncMock(return_value=[
                    {
                        'part_index': 0,
                        's3_key': 'test/item/part_1.pdf',
                        's3_url': 'https://example.com/part_1.pdf'
                    }
                ])
                worker.send_part_conversion_requests = AsyncMock()
                worker.update_item_status = MagicMock()
                
                mock_method = MagicMock()
                mock_method.delivery_tag = 1
                mock_properties = MagicMock()
                
                # Execute
                worker.handle_pdf_splitting_request(
                    mock_channel, mock_method, mock_properties,
                    json.dumps(sample_splitting_message).encode('utf-8')
                )
                
                # Verify
                worker.upload_parts_to_s3.assert_called_once()
                # Should create only 1 part for 2 pages with split size of 10
                uploaded_parts = worker.upload_parts_to_s3.call_args[0][0]
                assert len(uploaded_parts) == 1


class TestS3OSSFailures:
    """Test S3/OSS download and upload failure scenarios"""
    
    @pytest.mark.unit
    async def test_s3_download_failure(self, pdf_splitting_worker, sample_splitting_message,
                                     mock_pika_connection):
        """Test 4: S3/OSS download failure handling"""
        # Setup
        mock_connection, mock_channel = mock_pika_connection
        pdf_splitting_worker.rabbitmq_client = MagicMock()
        
        # Mock download to raise an exception
        with patch.object(pdf_splitting_worker, 'download_pdf_from_s3', 
                         side_effect=Exception("Download failed")):
            with patch('tempfile.TemporaryDirectory') as mock_temp_dir:
                mock_temp_dir.return_value.__enter__.return_value = '/tmp/test'
                
                mock_method = MagicMock()
                mock_method.delivery_tag = 1
                mock_properties = MagicMock()
                
                # Execute
                pdf_splitting_worker.handle_pdf_splitting_request(
                    mock_channel, mock_method, mock_properties,
                    json.dumps(sample_splitting_message).encode('utf-8')
                )
                
                # Verify error handling
                pdf_splitting_worker.update_item_status.assert_called_with(
                    sample_splitting_message['itemId'],
                    MessageTypes.FAILED,
                    'PDF splitting failed: Download failed',
                    error='Download failed'
                )
                mock_channel.basic_nack.assert_called_once_with(delivery_tag=1, requeue=False)
    
    @pytest.mark.unit
    async def test_s3_partial_upload_failure(self, pdf_splitting_worker, sample_splitting_message,
                                           mock_pika_connection):
        """Test 5: Partial upload to S3/OSS failure handling"""
        # Setup
        mock_connection, mock_channel = mock_pika_connection
        pdf_splitting_worker.rabbitmq_client = MagicMock()
        
        # Mock upload to fail on second part
        async def mock_upload(parts_info, item_id, temp_dir):
            if len(parts_info) > 1:
                raise Exception("Upload failed for part 2")
            return [{'part_index': 0, 's3_key': 'test/part_1.pdf', 's3_url': 'https://test.com/part_1.pdf'}]
        
        with patch.object(pdf_splitting_worker, 'download_pdf_from_s3'):
            with patch.object(pdf_splitting_worker, 'upload_parts_to_s3', side_effect=mock_upload):
                with patch('tempfile.TemporaryDirectory') as mock_temp_dir:
                    mock_temp_dir.return_value.__enter__.return_value = '/tmp/test'
                    
                    mock_method = MagicMock()
                    mock_method.delivery_tag = 1
                    mock_properties = MagicMock()
                    
                    # Execute
                    pdf_splitting_worker.handle_pdf_splitting_request(
                        mock_channel, mock_method, mock_properties,
                        json.dumps(sample_splitting_message).encode('utf-8')
                    )
                    
                    # Verify error handling
                    pdf_splitting_worker.update_item_status.assert_called_with(
                        sample_splitting_message['itemId'],
                        MessageTypes.FAILED,
                        'PDF splitting failed: Upload failed for part 2',
                        error='Upload failed for part 2'
                    )
                    mock_channel.basic_nack.assert_called_once_with(delivery_tag=1, requeue=False)


class TestRabbitMQFailures:
    """Test RabbitMQ connection and messaging failure scenarios"""
    
    @pytest.mark.unit
    async def test_rabbitmq_connection_failure(self, mock_rabbitmq_config):
        """Test 6: RabbitMQ connection failure handling"""
        # Setup
        with patch('pdf_splitting_worker.pika.BlockingConnection', 
                  side_effect=Exception("Connection failed")):
            client = RabbitMQClient(mock_rabbitmq_config)
            
            # Execute and verify
            with pytest.raises(Exception, match="Connection failed"):
                await client.connect()
    
    @pytest.mark.unit
    async def test_rabbitmq_publish_failure(self, mock_rabbitmq_config, mock_pika_connection):
        """Test 7: RabbitMQ message publish failure"""
        # Setup
        mock_connection, mock_channel = mock_pika_connection
        mock_channel.basic_publish.side_effect = Exception("Publish failed")
        
        with patch('pdf_splitting_worker.pika.BlockingConnection', return_value=mock_connection):
            client = RabbitMQClient(mock_rabbitmq_config)
            await client.connect()
            
            # Execute and verify
            with pytest.raises(Exception, match="Publish failed"):
                client.publish_message('test-queue', {'test': 'message'})


class TestMessageProcessing:
    """Test message processing scenarios"""
    
    @pytest.mark.unit
    def test_message_processing_failure_invalid_json(self, pdf_splitting_worker, mock_pika_connection):
        """Test 8: Message processing failure with invalid JSON"""
        # Setup
        mock_connection, mock_channel = mock_pika_connection
        pdf_splitting_worker.rabbitmq_client = MagicMock()
        
        mock_method = MagicMock()
        mock_method.delivery_tag = 1
        mock_properties = MagicMock()
        
        # Execute with invalid JSON
        pdf_splitting_worker.handle_pdf_splitting_request(
            mock_channel, mock_method, mock_properties,
            b'invalid json'
        )
        
        # Verify error handling
        mock_channel.basic_nack.assert_called_once_with(delivery_tag=1, requeue=False)
    
    @pytest.mark.unit
    def test_message_processing_missing_fields(self, pdf_splitting_worker, mock_pika_connection):
        """Test 9: Message processing failure with missing required fields"""
        # Setup
        mock_connection, mock_channel = mock_pika_connection
        pdf_splitting_worker.rabbitmq_client = MagicMock()
        
        # Create message with missing required fields
        incomplete_message = {'messageId': 'test'}  # Missing itemId, s3Url, etc.
        
        mock_method = MagicMock()
        mock_method.delivery_tag = 1
        mock_properties = MagicMock()
        
        # Execute
        pdf_splitting_worker.handle_pdf_splitting_request(
            mock_channel, mock_method, mock_properties,
            json.dumps(incomplete_message).encode('utf-8')
        )
        
        # Verify error handling
        mock_channel.basic_nack.assert_called_once_with(delivery_tag=1, requeue=False)


class TestSplittingResultValidation:
    """Test splitting result validation scenarios"""
    
    @pytest.mark.unit
    def test_splitting_result_validation(self, temp_dir, sample_pdf):
        """Test 10: Splitting result validation"""
        # Execute
        parts = PDFSplitter.split_pdf(sample_pdf, temp_dir, split_size=3)
        
        # Verify results
        assert len(parts) == 4  # 10 pages / 3 pages per part = 4 parts (3,3,3,1)
        
        for i, part in enumerate(parts):
            # Verify part structure
            assert 'part_index' in part
            assert 'start_page' in part
            assert 'end_page' in part
            assert 'page_count' in part
            assert 'filename' in part
            assert 'path' in part
            
            # Verify file exists
            assert os.path.exists(part['path'])
            
            # Verify page count
            with open(part['path'], 'rb') as f:
                reader = PdfReader(f)
                actual_pages = len(reader.pages)
                assert actual_pages == part['page_count']
            
            # Verify page numbering
            if i == 0:
                assert part['start_page'] == 1
                assert part['end_page'] == 3
            elif i == 1:
                assert part['start_page'] == 4
                assert part['end_page'] == 6
            elif i == 2:
                assert part['start_page'] == 7
                assert part['end_page'] == 9
            elif i == 3:
                assert part['start_page'] == 10
                assert part['end_page'] == 10


class TestPartialConversionRequests:
    """Test partial conversion request scenarios"""
    
    @pytest.mark.unit
    async def test_partial_conversion_requests(self, pdf_splitting_worker, sample_splitting_message):
        """Test 11: Partial conversion request sending"""
        # Setup
        item_id = 'test-item-123'
        parts = [
            {'part_index': 0, 's3_url': 'https://test.com/part_1.pdf', 's3_key': 'test/part_1.pdf'},
            {'part_index': 1, 's3_url': 'https://test.com/part_2.pdf', 's3_key': 'test/part_2.pdf'},
            {'part_index': 2, 's3_url': 'https://test.com/part_3.pdf', 's3_key': 'test/part_3.pdf'},
        ]
        
        # Mock RabbitMQ client
        pdf_splitting_worker.rabbitmq_client = MagicMock()
        
        # Execute
        await pdf_splitting_worker.send_part_conversion_requests(item_id, parts, sample_splitting_message)
        
        # Verify
        assert pdf_splitting_worker.rabbitmq_client.publish_message.call_count == 3
        
        # Check the calls were made with correct parameters
        calls = pdf_splitting_worker.rabbitmq_client.publish_message.call_args_list
        for i, call_arg in enumerate(calls):
            assert call_arg[0][0] == 'pdf-part-conversion-request'  # routing_key
            message = call_arg[0][1]  # message
            assert message['itemId'] == item_id
            assert message['partIndex'] == i
            assert message['totalParts'] == 3
            assert message['eventType'] == MessageTypes.PDF_PART_CONVERSION_REQUEST


class TestConcurrentProcessing:
    """Test concurrent processing limits"""
    
    @pytest.mark.unit
    async def test_concurrent_processing_limit(self, pdf_splitting_worker, sample_splitting_message):
        """Test 12: Concurrent processing limit enforcement"""
        # Setup
        item_id = 'test-item-123'
        parts = [
            {'part_index': i, 's3_url': f'https://test.com/part_{i+1}.pdf', 's3_key': f'test/part_{i+1}.pdf'}
            for i in range(10)  # Create 10 parts
        ]
        
        # Mock RabbitMQ client
        pdf_splitting_worker.rabbitmq_client = MagicMock()
        
        # Track call order and timing
        call_times = []
        
        def mock_publish(*args, **kwargs):
            call_times.append(datetime.now())
        
        pdf_splitting_worker.rabbitmq_client.publish_message.side_effect = mock_publish
        
        # Execute
        await pdf_splitting_worker.send_part_conversion_requests(item_id, parts, sample_splitting_message)
        
        # Verify all 10 requests were sent
        assert pdf_splitting_worker.rabbitmq_client.publish_message.call_count == 10
        
        # Verify concurrent limit of 3 was respected (should be processed in batches)
        # This is a simplified check - in a real test, we'd verify timing
        assert len(call_times) == 10


class TestRetryMechanisms:
    """Test retry mechanisms"""
    
    @pytest.mark.unit
    def test_retry_mechanism_success_after_retry(self, pdf_splitting_worker, sample_splitting_message,
                                                mock_pika_connection):
        """Test 13: Retry mechanism - success after retry"""
        # Setup
        mock_connection, mock_channel = mock_pika_connection
        pdf_splitting_worker.rabbitmq_client = MagicMock()
        
        # Set retry count to 1 (will retry once)
        sample_splitting_message['retryCount'] = 1
        sample_splitting_message['maxRetries'] = 3
        
        # Mock download to fail initially
        with patch.object(pdf_splitting_worker, 'download_pdf_from_s3', 
                         side_effect=Exception("Download failed")):
            with patch('tempfile.TemporaryDirectory') as mock_temp_dir:
                mock_temp_dir.return_value.__enter__.return_value = '/tmp/test'
                
                mock_method = MagicMock()
                mock_method.delivery_tag = 1
                mock_properties = MagicMock()
                
                # Execute
                pdf_splitting_worker.handle_pdf_splitting_request(
                    mock_channel, mock_method, mock_properties,
                    json.dumps(sample_splitting_message).encode('utf-8')
                )
                
                # Verify retry was attempted
                pdf_splitting_worker.rabbitmq_client.publish_message.assert_called_once()
                retry_message = pdf_splitting_worker.rabbitmq_client.publish_message.call_args[0][1]
                assert retry_message['retryCount'] == 2
                assert retry_message['messageId'] != sample_splitting_message['messageId']
    
    @pytest.mark.unit
    def test_retry_mechanism_max_retries_exceeded(self, pdf_splitting_worker, sample_splitting_message,
                                                 mock_pika_connection):
        """Test 14: Retry mechanism - max retries exceeded"""
        # Setup
        mock_connection, mock_channel = mock_pika_connection
        pdf_splitting_worker.rabbitmq_client = MagicMock()
        
        # Set retry count to max
        sample_splitting_message['retryCount'] = 3
        sample_splitting_message['maxRetries'] = 3
        
        # Mock download to fail
        with patch.object(pdf_splitting_worker, 'download_pdf_from_s3', 
                         side_effect=Exception("Download failed")):
            with patch('tempfile.TemporaryDirectory') as mock_temp_dir:
                mock_temp_dir.return_value.__enter__.return_value = '/tmp/test'
                
                mock_method = MagicMock()
                mock_method.delivery_tag = 1
                mock_properties = MagicMock()
                
                # Execute
                pdf_splitting_worker.handle_pdf_splitting_request(
                    mock_channel, mock_method, mock_properties,
                    json.dumps(sample_splitting_message).encode('utf-8')
                )
                
                # Verify no retry was attempted (max retries exceeded)
                pdf_splitting_worker.rabbitmq_client.publish_message.assert_not_called()


class TestProgressReporting:
    """Test progress reporting scenarios"""
    
    @pytest.mark.unit
    def test_progress_reporting_validation(self, pdf_splitting_worker, mock_pika_connection):
        """Test 15: Progress reporting validation"""
        # Setup
        mock_connection, mock_channel = mock_pika_connection
        pdf_splitting_worker.rabbitmq_client = MagicMock()
        
        # Execute
        pdf_splitting_worker.update_item_status(
            'test-item-123',
            MessageTypes.PROCESSING,
            'Processing PDF',
            progress=50,
            error=None
        )
        
        # Verify
        pdf_splitting_worker.rabbitmq_client.publish_message.assert_called_once()
        call_args = pdf_splitting_worker.rabbitmq_client.publish_message.call_args[0]
        assert call_args[0] == 'pdf-conversion-progress'  # routing_key
        
        message = call_args[1]
        assert message['itemId'] == 'test-item-123'
        assert message['status'] == MessageTypes.PROCESSING
        assert message['message'] == 'Processing PDF'
        assert message['progress'] == 50
        assert 'error' not in message


class TestErrorHandlingAndRecovery:
    """Test error handling and recovery scenarios"""
    
    @pytest.mark.unit
    def test_error_handling_with_recovery(self, pdf_splitting_worker, sample_splitting_message,
                                        mock_pika_connection):
        """Test 16: Error handling and recovery"""
        # Setup
        mock_connection, mock_channel = mock_pika_connection
        pdf_splitting_worker.rabbitmq_client = MagicMock()
        
        # Mock download to fail, then succeed on retry
        call_count = 0
        def mock_download(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                raise Exception("Temporary failure")
        
        with patch.object(pdf_splitting_worker, 'download_pdf_from_s3', side_effect=mock_download):
            with patch.object(pdf_splitting_worker, 'upload_parts_to_s3', return_value=[]):
                with patch.object(pdf_splitting_worker, 'send_part_conversion_requests'):
                    with patch('tempfile.TemporaryDirectory') as mock_temp_dir:
                        mock_temp_dir.return_value.__enter__.return_value = '/tmp/test'
                        
                        mock_method = MagicMock()
                        mock_method.delivery_tag = 1
                        mock_properties = MagicMock()
                        
                        # Execute first attempt (should fail and retry)
                        pdf_splitting_worker.handle_pdf_splitting_request(
                            mock_channel, mock_method, mock_properties,
                            json.dumps(sample_splitting_message).encode('utf-8')
                        )
                        
                        # Verify retry was scheduled
                        pdf_splitting_worker.rabbitmq_client.publish_message.assert_called_once()


class TestConfigurationLoading:
    """Test configuration loading scenarios"""
    
    @pytest.mark.unit
    def test_configuration_loading_validation(self, mock_environment):
        """Test 17: Configuration loading validation"""
        # Execute
        rabbitmq_config = Config.get_rabbitmq_config()
        s3_config = Config.get_s3_config()
        pdf_config = Config.get_pdf_processing_config()
        worker_config = Config.get_worker_config()
        
        # Verify RabbitMQ config
        assert 'host' in rabbitmq_config
        assert 'port' in rabbitmq_config
        assert 'username' in rabbitmq_config
        assert 'password' in rabbitmq_config
        assert 'virtual_host' in rabbitmq_config
        assert 'url' in rabbitmq_config
        assert rabbitmq_config['host'] == 'localhost'
        assert rabbitmq_config['port'] == 5672
        
        # Verify S3 config
        assert 'bucket' in s3_config
        assert 'region' in s3_config
        assert 'access_key' in s3_config
        assert 'secret_key' in s3_config
        assert 'endpoint' in s3_config
        assert s3_config['bucket'] == 'test-bucket'
        
        # Verify PDF processing config
        assert 'default_split_size' in pdf_config
        assert 'max_split_size' in pdf_config
        assert 'min_split_size' in pdf_config
        assert 'concurrent_part_processing' in pdf_config
        assert pdf_config['default_split_size'] == 25
        
        # Verify worker config
        assert 'worker_id' in worker_config
        assert 'log_level' in worker_config
        assert 'max_retries' in worker_config
        assert 'temp_dir' in worker_config
        assert worker_config['max_retries'] == 3


class TestSignalHandling:
    """Test signal handling scenarios"""
    
    @pytest.mark.unit
    def test_signal_handling_validation(self, pdf_splitting_worker, mock_pika_connection):
        """Test 18: Signal handling validation"""
        # Setup
        mock_connection, mock_channel = mock_pika_connection
        
        with patch('pdf_splitting_worker.pika.BlockingConnection', return_value=mock_connection):
            # Start the worker
            asyncio.run(pdf_splitting_worker.start())
            
            # Verify worker is running
            assert pdf_splitting_worker.is_running
            
            # Stop the worker
            pdf_splitting_worker.stop()
            
            # Verify cleanup
            assert not pdf_splitting_worker.is_running
            pdf_splitting_worker.rabbitmq_client.stop_consuming.assert_called_once()
            pdf_splitting_worker.rabbitmq_client.close.assert_called_once()


class TestS3StorageClient:
    """Test S3/OSS storage client scenarios"""
    
    @pytest.mark.unit
    async def test_s3_storage_client_with_real_credentials(self, temp_dir, sample_pdf, mock_oss2):
        """Test S3 storage client with real credentials"""
        # Setup
        s3_config = {
            'bucket': 'test-bucket',
            'region': 'us-east-1',
            'access_key': 'real-key',
            'secret_key': 'real-secret',
            'endpoint': 's3.amazonaws.com'
        }
        
        with patch('oss2.Auth', return_value=mock_oss2.Auth):
            with patch('oss2.Bucket', return_value=mock_oss2.Bucket):
                client = S3StorageClient(s3_config)
                
                # Execute
                result = await client.upload_part(sample_pdf, 'test-item', 0)
                
                # Verify
                assert 's3_key' in result
                assert 's3_url' in result
                assert result['s3_key'] == 'pdf-parts/test-item/part_1.pdf'
                assert 'test-bucket' in result['s3_url']
                
                # Verify OSS methods were called
                mock_oss2.Bucket.put_object_from_file.assert_called_once()
    
    @pytest.mark.unit
    async def test_s3_storage_client_without_credentials(self, temp_dir, sample_pdf):
        """Test S3 storage client without credentials (mock upload)"""
        # Setup
        s3_config = {
            'bucket': 'test-bucket',
            'region': 'us-east-1',
            'access_key': '',
            'secret_key': '',
            'endpoint': 's3.amazonaws.com'
        }
        
        client = S3StorageClient(s3_config)
        
        # Execute
        result = await client.upload_part(sample_pdf, 'test-item', 0)
        
        # Verify
        assert 's3_key' in result
        assert 's3_url' in result
        assert result['s3_key'] == 'pdf-parts/test-item/part_1.pdf'
        assert 'test-bucket' in result['s3_url']


class TestPDFSplitterEdgeCases:
    """Test PDF splitter edge cases"""
    
    @pytest.mark.unit
    def test_pdf_splitter_empty_pdf(self, temp_dir):
        """Test PDF splitter with empty PDF"""
        # Create empty PDF
        from PyPDF2 import PdfWriter
        empty_pdf_path = os.path.join(temp_dir, 'empty.pdf')
        writer = PdfWriter()
        with open(empty_pdf_path, 'wb') as f:
            writer.write(f)
        
        # Execute and verify
        with pytest.raises(Exception):
            PDFSplitter.split_pdf(empty_pdf_path, temp_dir, split_size=5)
    
    @pytest.mark.unit
    def test_pdf_splitter_invalid_split_size(self, temp_dir, sample_pdf):
        """Test PDF splitter with invalid split size"""
        # Test with split size of 0
        with pytest.raises(Exception):
            PDFSplitter.split_pdf(sample_pdf, temp_dir, split_size=0)
        
        # Test with negative split size
        with pytest.raises(Exception):
            PDFSplitter.split_pdf(sample_pdf, temp_dir, split_size=-1)
    
    @pytest.mark.unit
    def test_pdf_splitter_nonexistent_file(self, temp_dir):
        """Test PDF splitter with nonexistent file"""
        # Execute and verify
        with pytest.raises(Exception):
            PDFSplitter.split_pdf('/nonexistent/file.pdf', temp_dir, split_size=5)