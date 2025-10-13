"""
Unified logging module for PDF processing workers
Supports console, file, and Elasticsearch logging
"""

import logging
import logging.handlers
import json
import os
from datetime import datetime
from typing import Dict, Any, Optional
from config import Config


class ElasticsearchTransport(logging.Handler):
    """
    Elasticsearch transport for Python logging
    Similar to the TypeScript ElasticsearchTransport
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
                # Create index with mappings
                mappings = {
                    "properties": {
                        "timestamp": {"type": "date"},
                        "level": {"type": "keyword"},
                        "message": {"type": "text", "analyzer": "standard"},
                        "label": {"type": "keyword"},
                        "meta": {"type": "object"},
                        "service": {"type": "keyword"},
                        "environment": {"type": "keyword"}
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
            
            # Prepare document
            document = {
                "timestamp": datetime.fromtimestamp(record.created).isoformat(),
                "level": record.levelname.lower(),
                "message": record.getMessage(),
                "label": getattr(record, 'label', 'unknown'),
                "meta": getattr(record, 'meta', {}),
                "service": self.config.get('service_name', 'pdf-splitting-worker'),
                "environment": self.config.get('environment', 'development')
            }
            
            # Add exception info if present
            if record.exc_info:
                document['meta']['exception'] = self.format(record)
            
            # Index the document
            index_name = self._get_index_name()
            self.client.index(
                index=index_name,
                body=document
            )
            
        except Exception as e:
            # Don't let logging errors break the application
            print(f"Warning: Failed to log to Elasticsearch: {e}")


class JSONFormatter(logging.Formatter):
    """JSON formatter for structured logging"""
    
    def format(self, record):
        # Set label on the record if not already set
        if not hasattr(record, 'label'):
            record.label = record.name
            
        log_entry = {
            'timestamp': datetime.fromtimestamp(record.created).isoformat(),
            'level': record.levelname.lower(),
            'message': record.getMessage(),
            'label': record.label,
        }
        
        # Add extra fields
        if hasattr(record, 'meta') and record.meta:
            log_entry['meta'] = record.meta
        
        if record.exc_info:
            log_entry['exception'] = self.formatException(record.exc_info)
        
        return json.dumps(log_entry)


class ConsoleFormatter(logging.Formatter):
    """Console formatter with label prefix"""
    
    def format(self, record):
        # Set label on the record if not already set
        if not hasattr(record, 'label'):
            record.label = record.name
        return f"[{record.label}] {record.getMessage()}"


def create_logger_with_prefix(prefix: str) -> logging.Logger:
    """
    Create a logger with the specified prefix
    Similar to the TypeScript createLoggerWithPrefix function
    """
    # Get configuration
    es_config = Config.get_elasticsearch_config()
    log_level = getattr(logging, Config.LOG_LEVEL.upper(), logging.INFO)
    
    # Create logger
    logger = logging.getLogger(prefix)
    logger.setLevel(log_level)
    
    # Clear existing handlers to avoid duplicates
    logger.handlers.clear()
    
    # Console handler
    console_handler = logging.StreamHandler()
    console_handler.setLevel(log_level)
    console_formatter = ConsoleFormatter()
    console_handler.setFormatter(console_formatter)
    logger.addHandler(console_handler)
    
    # File handler
    try:
        file_handler = logging.handlers.RotatingFileHandler(
            'combined.log',
            maxBytes=10*1024*1024,  # 10MB
            backupCount=5
        )
        file_handler.setLevel(log_level)
        file_formatter = JSONFormatter()
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


# Create a default logger for backward compatibility
default_logger = create_logger_with_prefix('PdfSplittingWorker')


def getLogger(name: str) -> logging.Logger:
    """
    Get a logger with the specified name
    This function provides a simple interface similar to logging.getLogger
    but with our unified configuration
    """
    return create_logger_with_prefix(name)