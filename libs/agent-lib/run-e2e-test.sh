#!/bin/bash

# GLM API E2E Test Runner
# This script helps you run the E2E tests with proper environment setup

echo "=== GLM API Tool Calling E2E Test ==="
echo ""

# Check if GLM_API_KEY is set
if [ -z "$GLM_API_KEY" ]; then
    echo "❌ GLM_API_KEY environment variable is not set"
    echo ""
    echo "Please set it using one of these methods:"
    echo "  1. Export in terminal: export GLM_API_KEY='your_key_here'"
    echo "  2. Create .env.test file with: GLM_API_KEY=your_key_here"
    echo ""
    echo "Get your API key from: https://open.bigmodel.cn/"
    exit 1
fi

echo "✓ GLM_API_KEY is set"
echo ""

# Run the tests
echo "Running E2E tests..."
echo ""

npm test -- src/api-client/__tests__/ToolCallConvert.e2e.test.ts

echo ""
echo "=== Test Complete ==="
