# Enhanced Logging for PDF Processing Microservice

This document describes the enhanced logging capabilities added to the PDF processing microservice to improve debugging and monitoring.

## Overview

The enhanced logging system provides:
- **Structured Logging**: JSON-formatted logs with rich metadata
- **Context Tracking**: Request tracing across the entire workflow
- **Performance Metrics**: Automatic timing and performance tracking
- **Debug Mode**: Detailed logging for development and troubleshooting
- **Multiple Outputs**: Console, file, and Elasticsearch logging
- **Error Enhancement**: Detailed error logging with stack traces and context

## Features

### 1. Context Tracking

Track requests across the entire processing pipeline with correlation IDs and context information:

```python
from enhanced_logger import create_enhanced_logger

logger = create_enhanced_logger('MyService')

# Set context for the current request
logger.set_context(
    correlation_id='req-123',
    item_id='pdf-456',
    operation='pdf_splitting'
)

# All subsequent logs will include this context
logger.info("Processing started")

# Use context manager for temporary context
with logger.context(step='download', phase='processing'):
    logger.info("Downloading PDF file")
```

### 2. Performance Tracking

Automatically track operation performance with decorators and context managers:

```python
# Method 1: Using performance timer
with logger.performance_timer('pdf_download', tags={'source': 's3'}):
    # Your code here
    download_pdf()

# Method 2: Using decorators
from enhanced_logger import log_performance, log_async_performance

@log_performance('pdf_processing', tags={'type': 'large'})
def process_pdf():
    # Your code here
    pass

@log_async_performance('async_upload', tags={'destination': 'oss'})
async def upload_file():
    # Your async code here
    pass
```

### 3. Structured Logging

Add rich metadata to log messages:

```python
logger.info("PDF processing completed", 
           meta={
               'item_id': 'pdf-123',
               'pages_processed': 50,
               'file_size_mb': 25.5,
               'processing_time_ms': 1250
           },
           performance={
               'download_time_ms': 500,
               'split_time_ms': 750
           })
```

### 4. Enhanced Error Logging

Detailed error logging with context and stack traces:

```python
try:
    risky_operation()
except Exception as e:
    logger.exception("Operation failed", 
                   meta={
                       'item_id': 'pdf-123',
                       'operation': 'pdf_split',
                       'error_code': 'SPLIT_FAILED'
                   })
```

## Configuration

### Environment Variables

Add these to your `.env` file to configure enhanced logging:

```bash
# Enhanced Logging Configuration
DEBUG_MODE=false                    # Enable debug mode with additional context
DEBUG_LOG_LEVEL=DEBUG              # Debug log level (DEBUG, INFO, WARNING, ERROR)
INCLUDE_CONTEXT_IN_CONSOLE=true     # Include context info in console output
PERFORMANCE_TRACKING=true           # Enable performance tracking
LOG_PERFORMANCE_THRESHOLD=1000.0   # Log operations taking longer than this (ms)
```

### Log Levels

- **DEBUG**: Detailed information for debugging
- **INFO**: General information about processing
- **WARNING**: Warning messages for potential issues
- **ERROR**: Error messages with full context
- **CRITICAL**: Critical errors that may cause failures

## Log Outputs

### Console Output

Enhanced console formatting with context information:

```
15:30:45.123 [INFO    ] [PdfSplittingWorker] [CID:req-123 | Item:pdf-456 | Thread:MainThread] Processing PDF splitting request
15:30:45.456 [DEBUG   ] [PDFSplitter] [CID:req-123] Starting PDF split [pdf_split_operation:250.5ms]
15:30:45.789 [INFO    ] [S3StorageClient] [CID:req-123 | Item:pdf-456] OSS upload successful [Performance: upload_time_ms=180.2]
```

### File Output

Structured JSON logging to `enhanced.log`:

```json
{
  "timestamp": "2025-10-13T15:30:45.123456",
  "level": "info",
  "message": "PDF splitting request processed",
  "label": "PdfSplittingWorker",
  "module": "pdf_splitting_worker",
  "function": "handle_pdf_splitting_request",
  "line": 492,
  "thread_id": 12345,
  "thread_name": "MainThread",
  "process_id": 6789,
  "correlation_id": "req-123",
  "request_id": "req-123",
  "item_id": "pdf-456",
  "meta": {
    "operation": "pdf_splitting",
    "pages_processed": 50,
    "file_size_bytes": 26738688
  },
  "performance": {
    "total_processing_time_ms": 1250.5,
    "download_time_ms": 500.2,
    "split_time_ms": 750.3
  }
}
```

### Elasticsearch Output

Enhanced Elasticsearch indexing with additional fields:

- `correlation_id`: Request tracking ID
- `request_id`: Individual request identifier
- `item_id`: PDF item being processed
- `performance`: Performance metrics dictionary
- `thread_id`/`thread_name`: Threading information
- `process_id`: Process identifier

## Performance Metrics

The system automatically tracks performance metrics:

### Available Metrics

- `rabbitmq_connect_duration`: Time to connect to RabbitMQ
- `pdf_split_operation`: Time to split PDF files
- `s3_upload_part_duration`: Time to upload individual parts
- `part_N_creation`: Time to create each PDF part
- `oss_upload`: Time for OSS uploads
- `mock_upload`: Time for mock uploads

### Performance Dashboard

Access performance metrics through the performance tracker:

```python
from enhanced_logger import performance_tracker

# Get all metrics
all_metrics = performance_tracker.get_metrics()

# Get specific operation metrics
split_metrics = performance_tracker.get_metrics('pdf_split_operation')

# Latest metric for an operation
latest_split = split_metrics[-1] if split_metrics else None
```

## Debugging with Enhanced Logging

### 1. Enable Debug Mode

Set `DEBUG_MODE=true` in your environment to enable detailed logging:

```bash
export DEBUG_MODE=true
python start_pdf_splitting_worker.py
```

### 2. Trace Requests

Follow a single request through the entire system using correlation IDs:

```bash
# Filter logs by correlation ID
grep "CID:req-123" enhanced.log

# Search for specific item
grep "Item:pdf-456" enhanced.log
```

### 3. Performance Analysis

Identify performance bottlenecks:

```bash
# Find slow operations
jq 'select(.performance.total_processing_time_ms > 1000)' enhanced.log

# Analyze PDF splitting performance
jq 'select(.label == "PDFSplitter") | .performance' enhanced.log
```

### 4. Error Investigation

Detailed error information with context:

```bash
# Find all errors
jq 'select(.level == "error")' enhanced.log

# Investigate specific error
grep "SPLIT_FAILED" enhanced.log | jq '.'
```

## Testing Enhanced Logging

Run the test suite to verify enhanced logging functionality:

```bash
# Run enhanced logging tests
python test_enhanced_logging.py

# Run with debug mode
DEBUG_MODE=true python test_enhanced_logging.py
```

## Integration with Existing Code

The enhanced logging system is designed to be a drop-in replacement for the existing logging system:

```python
# Old way
from logger import create_logger_with_prefix
logger = create_logger_with_prefix('MyService')

# New way
from enhanced_logger import create_enhanced_logger
logger = create_enhanced_logger('MyService', debug_mode=True)
```

## Best Practices

### 1. Context Management
- Set context at the beginning of request processing
- Use context managers for temporary context changes
- Clear context when request processing completes

### 2. Performance Tracking
- Use performance timers for significant operations
- Add relevant tags to performance metrics
- Monitor performance thresholds

### 3. Error Handling
- Always include relevant context in error logs
- Use `logger.exception()` for caught exceptions
- Add error codes for categorization

### 4. Metadata
- Include relevant business metadata (item IDs, file sizes, etc.)
- Add technical metadata (thread info, processing times)
- Keep metadata structured and queryable

## Troubleshooting

### Common Issues

1. **Missing context in logs**
   - Ensure context is set before logging
   - Check if context is being cleared prematurely

2. **Performance metrics not appearing**
   - Verify performance tracking is enabled
   - Check if operations are using performance timers

3. **Elasticsearch logs not appearing**
   - Verify Elasticsearch configuration
   - Check network connectivity to Elasticsearch

4. **Log file permissions**
   - Ensure write permissions to log directory
   - Check disk space availability

### Debug Mode Checklist

When enabling debug mode, verify:

- [ ] `DEBUG_MODE=true` in environment
- [ ] Log level set to DEBUG
- [ ] Context information appears in console
- [ ] Performance tracking is active
- [ ] Detailed error information is available

## Migration Guide

### From Basic Logger

1. Replace imports:
   ```python
   # Old
   from logger import create_logger_with_prefix
   
   # New
   from enhanced_logger import create_enhanced_logger
   ```

2. Update logger creation:
   ```python
   # Old
   logger = create_logger_with_prefix('MyService')
   
   # New
   logger = create_enhanced_logger('MyService', debug_mode=True)
   ```

3. Add context tracking:
   ```python
   # Add context for requests
   logger.set_context(correlation_id=message_id, item_id=item_id)
   ```

4. Add performance tracking:
   ```python
   # Use performance timers
   with logger.performance_timer('operation_name'):
       # Your code
   ```

### Gradual Migration

You can gradually migrate by using both logging systems simultaneously:

```python
from logger import create_logger_with_prefix
from enhanced_logger import create_enhanced_logger

# Keep existing logger for compatibility
old_logger = create_logger_with_prefix('MyService')

# Add enhanced logger for new features
new_logger = create_enhanced_logger('MyService')