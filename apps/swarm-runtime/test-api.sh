#!/bin/bash

# Swarm API Test Script
# 测试 Fastify + AgentRuntime 服务器的各个 API 端点

BASE_URL="${BASE_URL:-http://localhost:9400}"

echo "=========================================="
echo "Swarm API Test Script"
echo "=========================================="
echo ""

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ============================================================
# Health Checks
# ============================================================

echo -e "${YELLOW}1. Health Checks${NC}"
echo ""

echo -n "GET /health ... "
response=$(curl -s "$BASE_URL/health")
if echo "$response" | grep -q '"status":"ok"'; then
  echo -e "${GREEN}✓ OK${NC}"
else
  echo -e "${RED}✗ FAILED${NC}"
  echo "$response"
fi

echo -n "GET /health/ready ... "
response=$(curl -s "$BASE_URL/health/ready")
if echo "$response" | grep -q '"status":"ready"'; then
  echo -e "${GREEN}✓ OK${NC}"
else
  echo -e "${RED}✗ FAILED${NC}"
  echo "$response"
fi

echo -n "GET /health/live ... "
response=$(curl -s "$BASE_URL/health/live")
if echo "$response" | grep -q '"status":"alive"'; then
  echo -e "${GREEN}✓ OK${NC}"
else
  echo -e "${RED}✗ FAILED${NC}"
  echo "$response"
fi

echo ""

# ============================================================
# Runtime Stats
# ============================================================

echo -e "${YELLOW}2. Runtime Statistics${NC}"
echo ""

echo "GET /api/runtime/stats"
curl -s "$BASE_URL/api/runtime/stats" | jq '.'
echo ""

# ============================================================
# List Agents
# ============================================================

echo -e "${YELLOW}3. List Agents${NC}"
echo ""

echo "GET /api/runtime/agents"
curl -s "$BASE_URL/api/runtime/agents" | jq '.'
echo ""

# ============================================================
# Create Agent
# ============================================================

echo -e "${YELLOW}4. Create Agent${NC}"
echo ""

echo "POST /api/runtime/agents"
create_response=$(curl -s -X POST "$BASE_URL/api/runtime/agents" \
  -H "Content-Type: application/json" \
  -d '{
    "agent": {
      "name": "Test Agent",
      "type": "router",
      "description": "A test agent for API testing"
    }
  }')

echo "$create_response" | jq '.'

instance_id=$(echo "$create_response" | jq -r '.data.instanceId // empty')

if [ "$instance_id" != "null" ] && [ -n "$instance_id" ]; then
  echo -e "${GREEN}Agent created: $instance_id${NC}"
else
  echo -e "${RED}Failed to create agent${NC}"
  instance_id=""
fi

echo ""

# ============================================================
# Get Agent Details
# ============================================================

if [ -n "$instance_id" ]; then
  echo -e "${YELLOW}5. Get Agent Details${NC}"
  echo ""

  echo "GET /api/agents/$instance_id"
  curl -s "$BASE_URL/api/agents/$instance_id" | jq '.'
  echo ""

  # ============================================================
  # List Child Agents
  # ============================================================

  echo "GET /api/agents/$instance_id/children"
  curl -s "$BASE_URL/api/agents/$instance_id/children" | jq '.'
  echo ""
fi

# ============================================================
# A2A Communication
# ============================================================

if [ -n "$instance_id" ]; then
  echo -e "${YELLOW}6. A2A Communication${NC}"
  echo ""

  echo "POST /api/a2a/query"
  curl -s -X POST "$BASE_URL/api/a2a/query" \
    -H "Content-Type: application/json" \
    -d "{
      \"targetAgentId\": \"$instance_id\",
      \"query\": \"What is your current status?\"
    }" | jq '.'
  echo ""
fi

# ============================================================
# Topology
# ============================================================

echo -e "${YELLOW}7. Topology${NC}"
echo ""

echo "GET /api/runtime/topology"
curl -s "$BASE_URL/api/runtime/topology" | jq '.'
echo ""

echo "GET /api/runtime/topology/stats"
curl -s "$BASE_URL/api/runtime/topology/stats" | jq '.'
echo ""

# ============================================================
# Metrics
# ============================================================

echo -e "${YELLOW}8. Server Metrics${NC}"
echo ""

echo "GET /health/metrics"
curl -s "$BASE_URL/health/metrics" | jq '.'
echo ""

echo "=========================================="
echo -e "${GREEN}Test Complete!${NC}"
echo "=========================================="
