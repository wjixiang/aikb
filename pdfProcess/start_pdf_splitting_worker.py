#!/usr/bin/env python3
"""
Startup script for the PDF Splitting Worker
"""

import asyncio
import logging
import signal
import sys
from pathlib import Path

# Add the current directory to Python path
sys.path.insert(0, str(Path(__file__).parent))

from config import Config
from pdf_splitting_worker import PdfSplittingWorker


def setup_logging():
    """Setup logging configuration"""
    log_level = getattr(logging, Config.LOG_LEVEL.upper(), logging.INFO)
    
    logging.basicConfig(
        level=log_level,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.StreamHandler(sys.stdout),
            logging.FileHandler(f'/tmp/{Config.WORKER_ID}.log')
        ]
    )


class WorkerManager:
    """Manager class for the PDF splitting worker"""
    
    def __init__(self):
        self.worker = None
        self.is_running = False
        self.shutdown_event = asyncio.Event()
        
    async def start(self):
        """Start the worker"""
        setup_logging()
        logger = logging.getLogger('WorkerManager')
        
        try:
            logger.info(f"Starting PDF Splitting Worker {Config.WORKER_ID}")
            
            # Create worker instance
            self.worker = PdfSplittingWorker(
                Config.get_rabbitmq_config(),
                Config.get_s3_config()
            )
            
            # Setup signal handlers
            self.setup_signal_handlers()
            
            # Start the worker
            await self.worker.start()
            self.is_running = True
            
            logger.info("PDF Splitting Worker started successfully")
            
            # Wait for shutdown signal
            await self.shutdown_event.wait()
            
        except Exception as e:
            logger.error(f"Failed to start worker: {e}")
            raise
        finally:
            await self.stop()
    
    async def stop(self):
        """Stop the worker"""
        if not self.is_running:
            return
            
        logger = logging.getLogger('WorkerManager')
        logger.info("Stopping PDF Splitting Worker...")
        
        try:
            if self.worker:
                self.worker.stop()
            self.is_running = False
            logger.info("PDF Splitting Worker stopped successfully")
        except Exception as e:
            logger.error(f"Error stopping worker: {e}")
    
    def setup_signal_handlers(self):
        """Setup signal handlers for graceful shutdown"""
        def signal_handler(signum, frame):
            logger = logging.getLogger('WorkerManager')
            logger.info(f"Received signal {signum}, initiating shutdown...")
            self.shutdown_event.set()
        
        signal.signal(signal.SIGINT, signal_handler)
        signal.signal(signal.SIGTERM, signal_handler)


async def main():
    """Main function"""
    manager = WorkerManager()
    
    try:
        await manager.start()
    except KeyboardInterrupt:
        print("\nReceived keyboard interrupt, shutting down...")
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())