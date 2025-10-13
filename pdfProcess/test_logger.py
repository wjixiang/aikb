#!/usr/bin/env python3
"""
Test script for the unified logging module
Tests console, file, and Elasticsearch logging
"""

import os
import sys
import time
from pathlib import Path

# Add the current directory to the Python path
sys.path.insert(0, str(Path(__file__).parent))

from logger import create_logger_with_prefix
from config import Config


def test_basic_logging():
    """Test basic logging functionality"""
    print("🧪 Testing basic logging functionality...")
    
    # Create a test logger
    logger = create_logger_with_prefix('TestLogger')
    
    # Test different log levels
    logger.debug("This is a debug message")
    logger.info("This is an info message")
    logger.warning("This is a warning message")
    logger.error("This is an error message")
    
    # Test logging with metadata
    logger.info("Test message with metadata", extra={'meta': {'test_id': '123', 'component': 'test'}})
    
    print("✅ Basic logging test completed")


def test_elasticsearch_logging():
    """Test Elasticsearch logging if enabled"""
    print("🧪 Testing Elasticsearch logging...")
    
    # Get Elasticsearch configuration
    es_config = Config.get_elasticsearch_config()
    
    if not es_config.get('enabled', False):
        print("⚠️  Elasticsearch logging is disabled. Skipping test.")
        return
    
    print(f"📡 Elasticsearch URL: {es_config.get('url')}")
    print(f"📝 Index pattern: {es_config.get('index_pattern')}")
    
    # Create a test logger
    logger = create_logger_with_prefix('ElasticsearchTest')
    
    # Test logging to Elasticsearch
    logger.info("Test message for Elasticsearch", extra={'meta': {'test_type': 'elasticsearch'}})
    logger.warning("Warning message for Elasticsearch")
    logger.error("Error message for Elasticsearch")
    
    # Give some time for async logging to complete
    time.sleep(2)
    
    print("✅ Elasticsearch logging test completed")


def test_file_logging():
    """Test file logging"""
    print("🧪 Testing file logging...")
    
    # Check if log file was created
    log_file = Path('combined.log')
    if log_file.exists():
        print(f"✅ Log file found: {log_file.absolute()}")
        
        # Read and display some log entries
        try:
            with open(log_file, 'r') as f:
                lines = f.readlines()
                print(f"📄 Log file contains {len(lines)} lines")
                
                # Show last few lines
                for line in lines[-3:]:
                    print(f"   {line.strip()}")
        except Exception as e:
            print(f"❌ Error reading log file: {e}")
    else:
        print("⚠️  Log file not found")


def test_configuration():
    """Test logging configuration"""
    print("🧪 Testing logging configuration...")
    
    # Display configuration
    print(f"📋 Log level: {Config.LOG_LEVEL}")
    print(f"🔧 Service name: {Config.SERVICE_NAME}")
    print(f"🌍 Environment: {Config.ENVIRONMENT}")
    
    es_config = Config.get_elasticsearch_config()
    print(f"📡 Elasticsearch enabled: {es_config.get('enabled')}")
    print(f"📡 Elasticsearch URL: {es_config.get('url')}")
    print(f"📡 Elasticsearch log level: {es_config.get('log_level')}")
    
    print("✅ Configuration test completed")


def main():
    """Main test function"""
    print("🚀 Unified Logging Test Suite")
    print("=" * 50)
    
    try:
        # Test configuration
        test_configuration()
        print()
        
        # Test basic logging
        test_basic_logging()
        print()
        
        # Test file logging
        test_file_logging()
        print()
        
        # Test Elasticsearch logging
        test_elasticsearch_logging()
        print()
        
        print("🎉 All logging tests completed successfully!")
        return 0
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())