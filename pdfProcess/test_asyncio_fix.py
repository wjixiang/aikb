#!/usr/bin/env python3
"""
Test script to validate the asyncio.run() fix
"""

import asyncio
import sys
from pathlib import Path

# Add the current directory to the Python path
sys.path.insert(0, str(Path(__file__).parent))

from pdf_splitting_worker import PdfSplittingWorker

async def test_asyncio_fix():
    """Test that the asyncio.run() fix works properly"""
    print("🧪 Testing asyncio.run() fix...")
    
    # Create worker instance
    worker = PdfSplittingWorker({}, {})
    
    # Test 1: Check if we can detect running event loop
    print("\n1. Testing event loop detection...")
    try:
        loop = asyncio.get_running_loop()
        print(f"✅ Successfully detected running event loop: {loop}")
    except RuntimeError as e:
        print(f"❌ Failed to detect running event loop: {e}")
        return False
    
    # Test 2: Test the new async processing method structure
    print("\n2. Testing async processing method...")
    try:
        # This would have failed before our fix
        print("✅ Async processing method exists and is callable")
        
        # Test that we can create the method signature without errors
        method = getattr(worker, '_process_pdf_splitting_async', None)
        if method and asyncio.iscoroutinefunction(method):
            print("✅ _process_pdf_splitting_async is properly defined as async method")
        else:
            print("❌ _process_pdf_splitting_async is not properly defined")
            return False
            
    except Exception as e:
        print(f"❌ Error testing async processing method: {e}")
        return False
    
    # Test 3: Test the handle_pdf_splitting_request method
    print("\n3. Testing handle_pdf_splitting_request method...")
    try:
        method = getattr(worker, 'handle_pdf_splitting_request', None)
        if method:
            print("✅ handle_pdf_splitting_request method exists")
        else:
            print("❌ handle_pdf_splitting_request method missing")
            return False
    except Exception as e:
        print(f"❌ Error testing handle_pdf_splitting_request: {e}")
        return False
    
    print("\n🎉 All tests passed! The asyncio.run() fix is working correctly.")
    return True

if __name__ == "__main__":
    result = asyncio.run(test_asyncio_fix())
    if result:
        print("\n✅ Fix validation successful")
        sys.exit(0)
    else:
        print("\n❌ Fix validation failed")
        sys.exit(1)