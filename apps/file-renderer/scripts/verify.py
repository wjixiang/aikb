#!/usr/bin/env python3
"""
Verification script to check if all modules can be imported
"""

import sys

def verify_imports():
    """Verify all core modules can be imported"""
    print("Verifying BibMax Document Processing Service...")

    try:
        print("✓ Importing config...")
        from config import settings

        print("✓ Importing models...")
        from models import ConversionRequest, ConversionResponse, ChunkingRequest

        print("✓ Importing services...")
        from services import ConversionService, ChunkingService, FileService

        print("✓ Importing routers...")
        from routers import conversion_router, chunking_router, health_router

        print("✓ Importing lib...")
        from lib import setup_logging, get_logger

        print("✓ Importing main...")
        from main import app

        print("\n✅ All imports successful!")
        print(f"   Service: {settings.app_name}")
        print(f"   Version: {settings.app_version}")
        print(f"   Port: {settings.server.port}")

        return True

    except Exception as e:
        print(f"\n❌ Import failed: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = verify_imports()
    sys.exit(0 if success else 1)
