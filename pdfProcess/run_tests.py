#!/usr/bin/env python3
"""
Test runner script for PDF splitting worker tests
"""

import os
import sys
import subprocess
from pathlib import Path

def run_tests():
    """Run the comprehensive test suite"""
    print("🧪 Running PDF Splitting Worker Test Suite")
    print("=" * 50)
    
    # Change to the pdfProcess directory
    script_dir = Path(__file__).parent
    os.chdir(script_dir)
    
    # Set the root directory for tests
    root_dir = script_dir.parent
    
    # Run pytest with the comprehensive test file
    cmd = [
        sys.executable, "-m", "pytest",
        "test_pdf_splitting_comprehensive.py",
        "-v",
        "--tb=short",
        "--rootdir", str(root_dir),
        "-p", "no:warnings"
    ]
    
    print(f"Running command: {' '.join(cmd)}")
    print()
    
    try:
        result = subprocess.run(cmd, check=True)
        print("\n✅ All tests passed!")
        return 0
    except subprocess.CalledProcessError as e:
        print(f"\n❌ Tests failed with exit code: {e.returncode}")
        return e.returncode
    except FileNotFoundError:
        print("\n❌ pytest not found. Please install pytest: pip install pytest")
        return 1

if __name__ == "__main__":
    sys.exit(run_tests())