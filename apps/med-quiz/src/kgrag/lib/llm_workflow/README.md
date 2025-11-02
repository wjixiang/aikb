# RAG Workflow with Reasoning Support

This directory contains enhanced RAG workflows that support reasoning content from deepseek-reasoner.

## Files

1. **rag_workflow.ts** - Original workflow with optional reasoning support
2. **rag_workflow_with_reasoning.ts** - Advanced workflow using BAML Modular API for full reasoning content access

## Usage

### Basic Usage (Updated rag_workflow.ts)

```typescript
import rag_workflow from "./rag_workflow";

const response = await rag_workflow("What is machine learning?", {
  useHyDE: true,
  useHybrid: true,
  topK: 10,
  language: "zh",
  useReasoning: true, // Enable reasoning model
});

// Use the stream as before
for await (const chunk of response.stream) {
  console.log(chunk);
}
```

### Advanced Usage (rag_workflow_with_reasoning.ts)

```typescript
import { rag_workflow_with_reasoning } from "./rag_workflow_with_reasoning";

const response = await rag_workflow_with_reasoning(
  "What is machine learning?",
  {
    useHyDE: true,
    useHybrid: true,
    topK: 10,
    language: "zh",
  },
);

console.log("Reasoning:", response.reasoning);
console.log("Content:", response.content);
console.log("Documents:", response.bamlDocuments);
```

### Streaming with Reasoning

```typescript
import { create_reasoning_stream } from "./rag_workflow_with_reasoning";

const { stream, bamlDocuments } = await create_reasoning_stream(
  "What is machine learning?",
  {
    useHyDE: true,
    useHybrid: true,
    topK: 10,
    language: "zh",
  },
);

// Process the stream
for await (const chunk of stream) {
  const delta = chunk.choices[0]?.delta;
  if (delta?.reasoning_content) {
    console.log("Reasoning:", delta.reasoning_content);
  }
  if (delta?.content) {
    console.log("Content:", delta.content);
  }
}
```

## Environment Variables

Make sure to set the following environment variables:

```bash
# For deepseek-reasoner
export DEEPSEEK_API_KEY=your_deepseek_api_key

# For other services (existing)
export QINIU_DEEPSEEK_FREE_API_KEY=your_qiniu_key
```

## BAML Configuration

The following BAML clients have been added:

1. **DeepseekReasoner** - Uses deepseek-reasoner model for reasoning content
2. **GenerateAnswerWithReasoning** - New BAML function that uses the reasoning model

## Implementation Details

### BAML Modular API Usage

The advanced workflow uses BAML's Modular API to:

1. Get the HTTP request object using `b.request.GenerateAnswerWithReasoning()`
2. Use the OpenAI SDK directly to make requests to deepseek-reasoner
3. Access the `reasoning_content` field in the response
4. Handle both streaming and non-streaming responses

### Response Structure

When using reasoning models, the response includes:

- **content**: The final answer content
- **reasoning**: The Chain of Thought reasoning content
- **bamlDocuments**: The retrieved documents used for generation

## Migration Guide

To migrate existing code:

1. Update imports if using the advanced workflow
2. Add `useReasoning: true` to config for basic usage
3. Handle the new response structure for advanced usage
4. Ensure DEEPSEEK_API_KEY is set in environment

## Testing

Test the implementation with:

```typescript
// Test basic reasoning
const result = await rag_workflow("Test query", {
  useHyDE: false,
  useHybrid: false,
  topK: 5,
  language: "en",
  useReasoning: true,
});

// Test advanced reasoning
const advanced = await rag_workflow_with_reasoning("Test query", {
  useHyDE: false,
  useHybrid: false,
  topK: 5,
  language: "en",
});
```
