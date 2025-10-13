#!/usr/bin/env python3
"""
Startup script for the PDF Splitting Worker
This script starts the Python-based PDF splitting worker that replaces the TypeScript version.
"""

import asyncio
import signal
import sys
from pathlib import Path

# Add the current directory to the Python path
sys.path.insert(0, str(Path(__file__).parent))

from pdf_splitting_worker import PdfSplittingWorker
from config import Config
from logger import create_logger_with_prefix

# Create logger with unified configuration
logger = create_logger_with_prefix('PdfSplittingWorkerStarter')


def signal_handler(signum, frame):
    """Handle shutdown signals"""
    logger.info(f"Received signal {signum}, initiating graceful shutdown...")
    # The main loop will check the worker's is_running flag


async def main():
    """Main function to start and run the PDF splitting worker"""
    logger.info("Starting PDF Splitting Worker...")
    
    # Get configuration
    rabbitmq_config = Config.get_rabbitmq_config()
    s3_config = Config.get_s3_config()
    
    # Create worker instance
    worker = PdfSplittingWorker(rabbitmq_config, s3_config)
    
    # Set up signal handlers
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    try:
        # Start the worker
        await worker.start()
        logger.info("PDF Splitting Worker started successfully")
        
        # Keep the worker running
        while worker.is_running:
            await asyncio.sleep(1)
            
    except KeyboardInterrupt:
        logger.info("Received keyboard interrupt, stopping worker...")
    except Exception as e:
        logger.error(f"Worker error: {e}")
        return 1
    finally:
        # Stop the worker
        worker.stop()
        logger.info("PDF Splitting Worker stopped")
    
    return 0


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)