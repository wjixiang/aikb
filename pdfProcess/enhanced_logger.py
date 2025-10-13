"""
Enhanced logging module for PDF processing workers with debugging capabilities
Supports console, file, Elasticsearch logging with context tracking and performance metrics
"""

import logging
import logging.handlers
import json
import os
import time
import traceback
import threading
from datetime import datetime
from typing import Dict, Any, Optional, Union
from contextlib import contextmanager
from functools import wraps
from config import Config


class ContextFilter(logging.Filter):
    """Filter to add context information to log records"""
    
    def filter(self, record):
        # Add thread information
        record.thread_id = threading.get_ident()
        record.thread_name = threading.current_thread().name
        
        # Add process information
        record.process_id = os.getpid()
        
        # Add correlation ID if available in context
        if hasattr(ContextLogger, '_context') and ContextLogger._context:
            record.correlation_id = ContextLogger._context.get('correlation_id')
            record.request_id = ContextLogger._context.get('request_id')
            record.item_id = ContextLogger._context.get('item_id')
        
        return True


class PerformanceTracker:
    """Track performance metrics for operations"""
    
    def __init__(self):
        self.metrics = {}
        self._lock = threading.Lock()
    
    def record_metric(self, name: str, value: float, unit: str = 'ms', tags: Dict[str, str] = None):
        """Record a performance metric"""
        with self._lock:
            if name not in self.metrics:
                self.metrics[name] = []
            
            metric_entry = {
                'value': value,
                'unit': unit,
                'timestamp': datetime.now().isoformat(),
                'tags': tags or {}
            }
            self.metrics[name].append(metric_entry)
            
            # Keep only last 100 entries per metric
            if len(self.metrics[name]) > 100:
                self.metrics[name] = self.metrics[name][-100:]
    
    def get_metrics(self, name: str = None) -> Dict[str, Any]:
        """Get recorded metrics"""
        with self._lock:
            if name:
                return self.metrics.get(name, [])
            return self.metrics.copy()


# Global performance tracker
performance_tracker = PerformanceTracker()


class DebugJSONFormatter(logging.Formatter):
    """Enhanced JSON formatter with debugging information"""
    
    def format(self, record):
        # Set label on the record if not already set
        if not hasattr(record, 'label'):
            record.label = record.name
            
        log_entry = {
            'timestamp': datetime.fromtimestamp(record.created).isoformat(),
            'level': record.levelname.lower(),
            'message': record.getMessage(),
            'label': record.label,
            'module': record.module,
            'function': record.funcName,
            'line': record.lineno,
            'thread_id': getattr(record, 'thread_id', 'unknown'),
            'thread_name': getattr(record, 'thread_name', 'unknown'),
            'process_id': getattr(record, 'process_id', 'unknown'),
        }
        
        # Add context information if available
        if hasattr(record, 'correlation_id') and record.correlation_id:
            log_entry['correlation_id'] = record.correlation_id
        if hasattr(record, 'request_id') and record.request_id:
            log_entry['request_id'] = record.request_id
        if hasattr(record, 'item_id') and record.item_id:
            log_entry['item_id'] = record.item_id
        
        # Add extra fields
        if hasattr(record, 'meta') and record.meta:
            log_entry['meta'] = record.meta
        
        # Add performance metrics if available
        if hasattr(record, 'performance') and record.performance:
            log_entry['performance'] = record.performance
        
        # Add exception info if present
        if record.exc_info:
            log_entry['exception'] = {
                'type': record.exc_info[0].__name__,
                'message': str(record.exc_info[1]),
                'traceback': self.formatException(record.exc_info)
            }
        
        return json.dumps(log_entry, default=str)


class DebugConsoleFormatter(logging.Formatter):
    """Enhanced console formatter with debugging information"""
    
    def __init__(self, include_context: bool = True):
        super().__init__()
        self.include_context = include_context
    
    def format(self, record):
        # Set label on the record if not already set
        if not hasattr(record, 'label'):
            record.label = record.name
            
        # Base format with timestamp and level
        base_format = f"{datetime.fromtimestamp(record.created).strftime('%H:%M:%S.%f')[:-3]} [{record.levelname:8}] [{record.label}]"
        
        # Add context information if available and enabled
        context_info = []
        if self.include_context:
            if hasattr(record, 'correlation_id') and record.correlation_id:
                context_info.append(f"CID:{record.correlation_id[:8]}")
            if hasattr(record, 'item_id') and record.item_id:
                context_info.append(f"Item:{record.item_id}")
            if hasattr(record, 'thread_name') and record.thread_name:
                context_info.append(f"Thread:{record.thread_name}")
        
        if context_info:
            base_format += f" [{' | '.join(context_info)}]"
        
        # Add function and line info for debug level
        if record.levelno <= logging.DEBUG:
            base_format += f" [{record.funcName}:{record.lineno}]"
        
        # Add the message
        formatted_message = f"{base_format} {record.getMessage()}"
        
        # Add exception info if present
        if record.exc_info:
            formatted_message += f"\n{self.formatException(record.exc_info)}"
        
        # Add performance metrics if available
        if hasattr(record, 'performance') and record.performance:
            perf_info = []
            for name, value in record.performance.items():
                perf_info.append(f"{name}={value}")
            formatted_message += f" [Performance: {', '.join(perf_info)}]"
        
        return formatted_message


class ElasticsearchTransport(logging.Handler):
    """
    Enhanced Elasticsearch transport for Python logging with debugging information
    """
    
    def __init__(self, config: Dict[str, Any]):
        super().__init__()
        self.config = config
        self.client = None
        self._index_initialized = False
        self._initialize_client()
    
    def _initialize_client(self):
        """Initialize Elasticsearch client"""
        try:
            from elasticsearch import Elasticsearch
            from elasticsearch.exceptions import ConnectionError, RequestError
            
            # Configure authentication
            auth = None
            if self.config.get('api_key'):
                auth = (self.config.get('api_key'),)
            elif self.config.get('username') and self.config.get('password'):
                auth = (self.config.get('username'), self.config.get('password'))
            
            # Create Elasticsearch client
            self.client = Elasticsearch(
                [self.config.get('url', 'http://localhost:9200')],
                http_auth=auth,
                verify_certs=self.config.get('verify_ssl', True),
                ssl_show_warn=False
            )
            
            # Test connection
            if not self.client.ping():
                print(f"Warning: Could not connect to Elasticsearch at {self.config.get('url')}")
                self.client = None
                
        except ImportError:
            print("Warning: elasticsearch package not installed. Elasticsearch logging disabled.")
            self.client = None
        except Exception as e:
            print(f"Warning: Failed to initialize Elasticsearch client: {e}")
            self.client = None
    
    def _get_index_name(self) -> str:
        """Get the appropriate index name based on the pattern"""
        pattern = self.config.get('index_pattern', 'logs-YYYY.MM.DD')
        if 'YYYY' in pattern or 'MM' in pattern or 'DD' in pattern:
            now = datetime.now()
            return pattern.replace('YYYY', now.strftime('%Y')).replace('MM', now.strftime('%m')).replace('DD', now.strftime('%d'))
        return pattern
    
    def _initialize_index(self):
        """Initialize the log index with proper mappings"""
        if not self.client or self._index_initialized:
            return
            
        try:
            index_name = self._get_index_name()
            
            # Check if index exists
            if not self.client.indices.exists(index=index_name):
                # Create index with enhanced mappings
                mappings = {
                    "properties": {
                        "timestamp": {"type": "date"},
                        "level": {"type": "keyword"},
                        "message": {"type": "text", "analyzer": "standard"},
                        "label": {"type": "keyword"},
                        "module": {"type": "keyword"},
                        "function": {"type": "keyword"},
                        "line": {"type": "integer"},
                        "thread_id": {"type": "long"},
                        "thread_name": {"type": "keyword"},
                        "process_id": {"type": "long"},
                        "correlation_id": {"type": "keyword"},
                        "request_id": {"type": "keyword"},
                        "item_id": {"type": "keyword"},
                        "meta": {"type": "object"},
                        "performance": {"type": "object"},
                        "service": {"type": "keyword"},
                        "environment": {"type": "keyword"},
                        "exception": {
                            "properties": {
                                "type": {"type": "keyword"},
                                "message": {"type": "text"},
                                "traceback": {"type": "text"}
                            }
                        }
                    }
                }
                
                try:
                    self.client.indices.create(
                        index=index_name,
                        mappings=mappings
                    )
                except Exception as create_error:
                    # If index already exists (race condition), just continue
                    if "resource_already_exists_exception" in str(create_error):
                        pass
                    else:
                        print(f"Warning: Failed to create Elasticsearch index: {create_error}")
            
            self._index_initialized = True
            
        except Exception as e:
            print(f"Warning: Failed to initialize Elasticsearch index: {e}")
    
    def emit(self, record):
        """Emit a log record to Elasticsearch"""
        if not self.client:
            return
            
        try:
            # Initialize index if needed
            self._initialize_index()
            
            # Prepare document with enhanced fields
            document = {
                "timestamp": datetime.fromtimestamp(record.created).isoformat(),
                "level": record.levelname.lower(),
                "message": record.getMessage(),
                "label": getattr(record, 'label', 'unknown'),
                "module": getattr(record, 'module', 'unknown'),
                "function": getattr(record, 'funcName', 'unknown'),
                "line": getattr(record, 'lineno', 0),
                "thread_id": getattr(record, 'thread_id', 0),
                "thread_name": getattr(record, 'thread_name', 'unknown'),
                "process_id": getattr(record, 'process_id', 0),
                "service": self.config.get('service_name', 'pdf-splitting-worker'),
                "environment": self.config.get('environment', 'development')
            }
            
            # Add context information if available
            if hasattr(record, 'correlation_id') and record.correlation_id:
                document['correlation_id'] = record.correlation_id
            if hasattr(record, 'request_id') and record.request_id:
                document['request_id'] = record.request_id
            if hasattr(record, 'item_id') and record.item_id:
                document['item_id'] = record.item_id
            
            # Add extra fields
            if hasattr(record, 'meta') and record.meta:
                document['meta'] = record.meta
            
            # Add performance metrics if available
            if hasattr(record, 'performance') and record.performance:
                document['performance'] = record.performance
            
            # Add exception info if present
            if record.exc_info:
                document['exception'] = {
                    'type': record.exc_info[0].__name__,
                    'message': str(record.exc_info[1]),
                    'traceback': self.format(record)
                }
            
            # Index the document
            index_name = self._get_index_name()
            self.client.index(
                index=index_name,
                body=document
            )
            
        except Exception as e:
            # Don't let logging errors break the application
            print(f"Warning: Failed to log to Elasticsearch: {e}")


class ContextLogger:
    """Enhanced logger with context tracking and debugging capabilities"""
    
    _context = {}
    _context_lock = threading.Lock()
    
    def __init__(self, prefix: str, debug_mode: bool = False):
        self.prefix = prefix
        self.debug_mode = debug_mode
        self.logger = self._create_logger()
    
    def _create_logger(self) -> logging.Logger:
        """Create logger with enhanced configuration"""
        # Get configuration
        es_config = Config.get_elasticsearch_config()
        log_level = getattr(logging, Config.LOG_LEVEL.upper(), logging.INFO)
        
        # Adjust log level based on debug mode
        if self.debug_mode:
            log_level = logging.DEBUG
        
        # Create logger
        logger = logging.getLogger(f"{self.prefix}_enhanced")
        logger.setLevel(log_level)
        
        # Clear existing handlers to avoid duplicates
        logger.handlers.clear()
        
        # Add context filter
        context_filter = ContextFilter()
        logger.addFilter(context_filter)
        
        # Console handler with enhanced formatting
        console_handler = logging.StreamHandler()
        console_handler.setLevel(log_level)
        console_formatter = DebugConsoleFormatter(include_context=self.debug_mode)
        console_handler.setFormatter(console_formatter)
        logger.addHandler(console_handler)
        
        # File handler with enhanced JSON formatting
        try:
            file_handler = logging.handlers.RotatingFileHandler(
                'enhanced.log',
                maxBytes=10*1024*1024,  # 10MB
                backupCount=5
            )
            file_handler.setLevel(log_level)
            file_formatter = DebugJSONFormatter()
            file_handler.setFormatter(file_formatter)
            logger.addHandler(file_handler)
        except Exception as e:
            print(f"Warning: Failed to create file handler: {e}")
        
        # Elasticsearch handler (if enabled)
        if es_config.get('enabled', False):
            try:
                es_handler = ElasticsearchTransport(es_config)
                es_handler.setLevel(getattr(logging, es_config.get('log_level', 'info').upper(), logging.INFO))
                logger.addHandler(es_handler)
            except Exception as e:
                print(f"Warning: Failed to create Elasticsearch handler: {e}")
        
        # Prevent propagation to root logger
        logger.propagate = False
        
        return logger
    
    @classmethod
    def set_context(cls, **kwargs):
        """Set context information for all log messages"""
        with cls._context_lock:
            cls._context.update(kwargs)
    
    @classmethod
    def get_context(cls) -> Dict[str, Any]:
        """Get current context information"""
        with cls._context_lock:
            return cls._context.copy()
    
    @classmethod
    def clear_context(cls):
        """Clear all context information"""
        with cls._context_lock:
            cls._context.clear()
    
    @contextmanager
    def context(self, **kwargs):
        """Context manager for temporary context"""
        old_context = self.get_context()
        self.set_context(**kwargs)
        try:
            yield
        finally:
            self.clear_context()
            self.set_context(**old_context)
    
    def debug(self, message: str, **kwargs):
        """Log debug message with optional metadata"""
        extra = self._prepare_extra(kwargs)
        self.logger.debug(message, extra=extra)
    
    def info(self, message: str, **kwargs):
        """Log info message with optional metadata"""
        extra = self._prepare_extra(kwargs)
        self.logger.info(message, extra=extra)
    
    def warning(self, message: str, **kwargs):
        """Log warning message with optional metadata"""
        extra = self._prepare_extra(kwargs)
        self.logger.warning(message, extra=extra)
    
    def error(self, message: str, **kwargs):
        """Log error message with optional metadata"""
        extra = self._prepare_extra(kwargs)
        self.logger.error(message, extra=extra)
    
    def critical(self, message: str, **kwargs):
        """Log critical message with optional metadata"""
        extra = self._prepare_extra(kwargs)
        self.logger.critical(message, extra=extra)
    
    def exception(self, message: str, **kwargs):
        """Log exception with traceback"""
        extra = self._prepare_extra(kwargs)
        self.logger.exception(message, extra=extra)
    
    def _prepare_extra(self, kwargs: Dict[str, Any]) -> Dict[str, Any]:
        """Prepare extra fields for log record"""
        extra = {}
        
        # Add metadata
        if 'meta' in kwargs:
            extra['meta'] = kwargs.pop('meta')
        
        # Add performance metrics
        if 'performance' in kwargs:
            extra['performance'] = kwargs.pop('performance')
        
        # Add any remaining kwargs to meta
        if kwargs:
            if 'meta' not in extra:
                extra['meta'] = {}
            extra['meta'].update(kwargs)
        
        return extra
    
    @contextmanager
    def performance_timer(self, operation_name: str, tags: Dict[str, str] = None):
        """Context manager for timing operations"""
        start_time = time.time()
        self.debug(f"Starting operation: {operation_name}", meta={'operation': operation_name, 'status': 'started'})
        
        try:
            yield
        except Exception as e:
            duration = (time.time() - start_time) * 1000  # Convert to milliseconds
            performance_tracker.record_metric(f"{operation_name}_duration", duration, 'ms', tags)
            self.error(f"Operation failed: {operation_name}", 
                      meta={'operation': operation_name, 'status': 'failed', 'duration_ms': duration},
                      performance={'duration_ms': duration})
            raise
        else:
            duration = (time.time() - start_time) * 1000  # Convert to milliseconds
            performance_tracker.record_metric(f"{operation_name}_duration", duration, 'ms', tags)
            self.info(f"Operation completed: {operation_name}", 
                     meta={'operation': operation_name, 'status': 'completed', 'duration_ms': duration},
                     performance={'duration_ms': duration})


def create_enhanced_logger(prefix: str, debug_mode: bool = False) -> ContextLogger:
    """
    Create an enhanced logger with debugging capabilities
    
    Args:
        prefix: Logger prefix/name
        debug_mode: Enable debug mode with additional context information
    
    Returns:
        ContextLogger instance
    """
    return ContextLogger(prefix, debug_mode)


def log_performance(operation_name: str, tags: Dict[str, str] = None):
    """Decorator for logging function performance"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            logger = create_enhanced_logger(func.__module__)
            with logger.performance_timer(operation_name, tags):
                return func(*args, **kwargs)
        return wrapper
    return decorator


def log_async_performance(operation_name: str, tags: Dict[str, str] = None):
    """Decorator for logging async function performance"""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            logger = create_enhanced_logger(func.__module__)
            with logger.performance_timer(operation_name, tags):
                return await func(*args, **kwargs)
        return wrapper
    return decorator


# Create default enhanced logger
default_logger = create_enhanced_logger('PdfSplittingWorker')