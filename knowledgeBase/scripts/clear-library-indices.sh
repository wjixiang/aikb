#!/bin/bash

# 简单脚本：删除所有Library相关的Elasticsearch索引
# 使用curl命令直接与Elasticsearch API交互

# Elasticsearch配置
ELASTICSEARCH_URL=${ELASTICSEARCH_URL:-"http://elasticsearch:9200"}
ELASTICSEARCH_USER=${ELASTICSEARCH_USER:-""}
ELASTICSEARCH_PASSWORD=${ELASTICSEARCH_PASSWORD:-""}
ELASTICSEARCH_API_KEY=${ELASTICSEARCH_API_KEY:-""}

# Library相关的索引列表
LIBRARY_INDICES=(
    "library_metadata"
    "library_collections"
    "library_citations"
)

echo "连接到Elasticsearch: $ELASTICSEARCH_URL"

# 构建认证头
AUTH_HEADER=""
if [ -n "$ELASTICSEARCH_API_KEY" ]; then
    AUTH_HEADER="-H 'Authorization: ApiKey $ELASTICSEARCH_API_KEY'"
elif [ -n "$ELASTICSEARCH_USER" ] && [ -n "$ELASTICSEARCH_PASSWORD" ]; then
    AUTH_HEADER="-u $ELASTICSEARCH_USER:$ELASTICSEARCH_PASSWORD"
fi

# 获取所有索引
echo "获取现有索引..."
INDICES_RESPONSE=$(curl -s $AUTH_HEADER "$ELASTICSEARCH_URL/_cat/indices?format=json")

if [ $? -ne 0 ]; then
    echo "错误: 无法连接到Elasticsearch"
    exit 1
fi

# 提取索引名称
EXISTING_INDICES=$(echo "$INDICES_RESPONSE" | jq -r '.[].index' 2>/dev/null || echo "$INDICES_RESPONSE" | grep -o '"index":"[^"]*"' | sed 's/"index":"\([^"]*\)"/\1/')

if [ -z "$EXISTING_INDICES" ]; then
    echo "没有找到任何索引"
    exit 0
fi

echo "现有索引: $EXISTING_INDICES"

# 找出需要删除的Library索引
INDICES_TO_DELETE=""
for index in "${LIBRARY_INDICES[@]}"; do
    if echo "$EXISTING_INDICES" | grep -q "^$index$"; then
        INDICES_TO_DELETE="$INDICES_TO_DELETE $index"
    fi
done

if [ -z "$INDICES_TO_DELETE" ]; then
    echo "没有找到Library相关的索引"
    exit 0
fi

echo "将删除以下Library索引:$INDICES_TO_DELETE"

# 删除索引
for index in $INDICES_TO_DELETE; do
    echo "删除索引: $index"
    RESPONSE=$(curl -s -X DELETE $AUTH_HEADER "$ELASTICSEARCH_URL/$index")
    
    if echo "$RESPONSE" | grep -q '"acknowledged":true'; then
        echo "✓ 成功删除索引: $index"
    else
        echo "✗ 删除索引失败: $index"
        echo "响应: $RESPONSE"
    fi
done

echo "Library索引删除完成"