# Migration Guide: Research Agents Integration

This guide helps you integrate the new multi-step autonomous research agents with your existing chatbot API at `/api/chatbot/route.ts`.

## 🎯 **Quick Migration Options**

### Option 1: New Research Endpoint (Recommended)

**File**: `/api/chatbot/research.ts`
**Usage**: `POST /api/chatbot/research`

```typescript
// Frontend usage
const response = await fetch('/api/chatbot/research', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: 'diabetes complications',
    mode: 'basic',
    config: { topK: 15, maxIterations: 3 },
  }),
});
```

### Option 2: Compatible Research Endpoint

**File**: `/api/chatbot/compatible-research.ts`
**Usage**: `POST /api/chatbot/compatible-research`

```typescript
// Compatible with existing format
const response = await fetch('/api/chatbot/compatible-research', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: 'diabetes complications',
    rag_config: { topK: 15, maxIterations: 3 },
  }),
});
```

### Option 3: Extend Existing API

**File**: Modify `/api/chatbot/route.ts`

## 📋 **API Endpoints Summary**

| Endpoint                           | Purpose                         | Compatible |
| ---------------------------------- | ------------------------------- | ---------- |
| `/api/chatbot/research`            | New research API                | ❌         |
| `/api/chatbot/compatible-research` | Compatible with existing format | ✅         |
| `/api/chatbot/route.ts`            | Your existing API               | ✅         |

## 🔧 **Integration Examples**

### 1. Using New Research API

```typescript
// POST /api/chatbot/research
{
  "query": "diabetes complications",
  "mode": "basic",
  "config": {
    "useHyDE": true,
    "topK": 15,
    "maxIterations": 3
  }
}
```

### 2. Using Compatible API (Same as your existing format)

```typescript
// POST /api/chatbot/compatible-research
{
  "query": "diabetes complications",
  "rag_config": {
    "useHyDE": true,
    "topK": 15,
    "maxIterations": 3
  }
}
```

### 3. Streaming Research (Compatible)

```typescript
// POST /api/chatbot/compatible-research
{
  "query": "diabetes complications",
  "stream": true,
  "rag_config": { "topK": 10 }
}
```

## 🔄 **Frontend Integration Examples**

### React Hook (Compatible)

```typescript
// hooks/useResearch.ts
import { useState } from 'react';

export function useResearch() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const research = async (query: string, config?: any) => {
    setLoading(true);
    try {
      const response = await fetch('/api/chatbot/compatible-research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          rag_config: config,
        }),
      });

      const data = await response.json();
      setResult(data);
      return data;
    } finally {
      setLoading(false);
    }
  };

  return { research, loading, result };
}
```

### Streaming with EventSource

```typescript
// Streaming research
const eventSource = new EventSource('/api/chatbot/compatible-research');
eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log(data.type, data.content);
};
```

## 📊 **Response Format Comparison**

### Your Existing API Response

```json
{
  "type": "response",
  "content": "Generated response..."
}
```

### New Research API Response

```json
{
  "type": "research_result",
  "content": "Comprehensive research report...",
  "metadata": {
    "sources": 12,
    "processingTime": 3456
  },
  "sources": [...]
}
```

### Compatible Response (Same format)

```json
{
  "type": "research_result",
  "content": "Research report...",
  "metadata": {...}
}
```

## 🚀 **Migration Steps**

### Step 1: Test New Endpoints

```bash
# Test basic research
curl -X POST http://localhost:3000/api/chatbot/research \
  -H "Content-Type: application/json" \
  -d '{"query":"diabetes complications"}'

# Test compatible endpoint
curl -X POST http://localhost:3000/api/chatbot/compatible-research \
  -H "Content-Type: application/json" \
  -d '{"query":"diabetes complications","rag_config":{"topK":10}}'
```

### Step 2: Update Frontend

```typescript
// Before (using old Agent)
const response = await fetch('/api/chatbot', {
  method: 'POST',
  body: JSON.stringify({ query, rag_config }),
});

// After (using new research agents)
const response = await fetch('/api/chatbot/compatible-research', {
  method: 'POST',
  body: JSON.stringify({ query, rag_config }),
});
```

### Step 3: Gradual Migration

1. **Phase 1**: Use `/api/chatbot/compatible-research` (no code changes needed)
2. **Phase 2**: Migrate to `/api/chatbot/research` (new features)
3. **Phase 3**: Update `/api/chatbot/route.ts` if desired

## 🔧 **Configuration Compatibility**

Your existing `rag_config` is fully supported:

```typescript
// Your existing config works unchanged
const config = {
  useHyDE: true,
  useHybrid: true,
  topK: 15,
  language: 'zh',
  maxIterations: 3,
  minRelevanceScore: 0.7,
};
```

## 📋 **Testing Migration**

### Quick Test

```bash
# Test with CLI
npx tsx src/test_script/test_research_agents.ts --basic "test query"

# Test API endpoints
npx tsx src/test_script/test_research_agents.ts --Agent "test query"
```

### Integration Test

```bash
# Test with your existing frontend
curl -X POST http://localhost:3000/api/chatbot/compatible-research \
  -H "Content-Type: application/json" \
  -d '{"query":"diabetes complications","rag_config":{"topK":15}}'
```

## 🎯 **Recommended Migration Path**

1. **Start with `/api/chatbot/compatible-research`** - Zero code changes needed
2. **Test thoroughly** with your existing frontend
3. **Gradually migrate** to `/api/chatbot/research` for new features
4. **Eventually update** `/api/chatbot/route.ts` if desired

## 📞 **Support**

All new research agents are fully integrated and ready to use. The compatible endpoints ensure zero breaking changes to your existing system.
