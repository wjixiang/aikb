#!/usr/bin/env python3
"""
Simple script to run the PDF splitting worker with proper environment loading
"""

import os
import sys
from pathlib import Path

# Load environment variables from .env file
env_file = Path(__file__).parent.parent / '.env'
if env_file.exists():
    print(f"📋 Loading environment variables from {env_file}")
    with open(env_file) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ[key] = value
else:
    print("⚠️  .env file not found, using default values")

# Import and run the worker
import asyncio
from start_pdf_splitting_worker import main

if __name__ == "__main__":
    print("🚀 Starting PDF Splitting Worker...")
    asyncio.run(main())