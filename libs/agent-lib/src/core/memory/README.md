# Reflective Thinking and Memory System

## Overview

This module implements an enhanced thinking-action framework with persistent memory and reflective thinking capabilities. It extends the basic thinking-action pattern with:

1. **Complete Context Storage** - All workspace contexts are stored for reference
2. **Continuous Reflective Thinking** - LLM-controlled multi-round thinking
3. **Context Summarization** - Automatic compression of contexts into summaries
4. **Memory Accumulation** - Summaries are accumulated and injected into prompts
5. **Historical Recall** - LLM can recall specific historical contexts

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      ReflectiveAgent                         │
│  (Extends Agent with reflective thinking capabilities)      │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ uses
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              ReflectiveThinkingProcessor                     │
│  - Manages continuous thinking rounds                        │
│  - Generates context summaries                               │
│  - Handles context recall                                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ uses
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  ContextMemoryStore                          │
│  - Stores all context snapshots                              │
│  - Stores all summaries                                      │
│  - Provides search and retrieval                             │
└─────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. ContextMemoryStore

**Purpose**: Store and manage all historical contexts and summaries.

**Key Features**:
- Stores complete workspace context for each turn
- Stores LLM-generated summaries for each turn
- Provides retrieval by turn number, context ID, or keyword
- Supports export/import for persistence

**Data Structures**:
```typescript
ContextSnapshot {
  id: string              // Unique identifier
  turnNumber: number      // Turn in conversation
  fullContext: string     // Complete workspace context
  summary?: string        // LLM-generated summary
  tokenCount: number      // Size estimation
  toolCalls?: string[]    // Tools used in this turn
}

MemorySummary {
  id: string              // Summary identifier
  contextId: string       // Reference to context
  turnNumber: number      // Turn number
  summary: string         // Compressed summary text
  insights: string[]      // Key insights
  tokenCount: number      // Size estimation
}
```

### 2. ReflectiveThinkingProcessor

**Purpose**: Manage the reflective thinking phase with continuous rounds.

**Key Features**:
- Performs multiple thinking rounds controlled by LLM
- Generates context summaries using LLM
- Handles context recall requests
- Builds accumulated summaries for prompt injection

**Thinking Flow**:
```
1. Start thinking phase
2. For each round (up to maxThinkingRounds):
   a. Build thinking prompt with:
      - Conversation history
      - Current workspace context
      - Accumulated summaries
      - Previous thinking rounds
   b. Call LLM with thinking tools:
      - continue_thinking: Control flow
      - recall_context: Recall history
   c. Process LLM response:
      - Extract thinking content
      - Handle recall requests
      - Check continue decision
   d. If continue=false, exit loop
3. Generate summary for current turn
4. Store summary in memory
5. Return compressed history + accumulated summaries
```

**Thinking Tools**:

```typescript
// Tool 1: Control thinking flow
continue_thinking({
  continueThinking: boolean,  // Continue or proceed to action
  reason: string,             // Reason for decision
  nextFocus?: string          // What to focus on next
})

// Tool 2: Recall historical context
recall_context({
  turnNumbers?: number[],     // Recall by turn number
  contextIds?: string[],      // Recall by context ID
  keywords?: string[]         // Search by keyword
})
```

### 3. ReflectiveAgent

**Purpose**: Agent implementation with integrated reflective thinking.

**Key Features**:
- Extends base Agent class
- Integrates ReflectiveThinkingProcessor
- Manages ContextMemoryStore
- Injects accumulated summaries into prompts

**Request Loop**:
```
1. Get current workspace context
2. THINKING PHASE:
   a. Perform reflective thinking (multiple rounds)
   b. Store context snapshot
   c. Generate and store summary
   d. Get accumulated summaries
3. ACTION PHASE:
   a. Build prompt with accumulated summaries
   b. Call LLM with action tools
   c. Execute tool calls
   d. Update workspace state
4. If not completed, continue loop
```

## Usage Example

### Basic Setup

```typescript
import { ReflectiveAgent, ReflectiveAgentConfig } from './memory';

const config: ReflectiveAgentConfig = {
  // Standard agent config
  apiRequestTimeout: 40000,
  maxRetryAttempts: 3,
  consecutiveMistakeLimit: 3,

  // Reflective thinking config
  reflectiveThinking: {
    enabled: true,
    maxThinkingRounds: 5,      // Max thinking rounds per turn
    thinkingTokenBudget: 10000, // Token budget for thinking
    enableRecall: true,         // Enable context recall
    maxRecallContexts: 3,       // Max contexts per recall
  },
};

const agent = new ReflectiveAgent(
  config,
  workspace,
  agentPrompt,
  apiClient
);

await agent.start('Your task here');
```

### Accessing Memory

```typescript
// Get memory store
const memoryStore = agent.getMemoryStore();

// Get recent summaries
const recent = memoryStore.getRecentSummaries(5);

// Search by keyword
const results = memoryStore.searchSummaries('optimization');

// Get specific context
const context = memoryStore.getContextByTurn(3);

// Export for persistence
const memoryData = agent.exportMemory();
```

## Memory Flow Example

### Turn 1: Initial Analysis

**Workspace Context**:
```
Files: [main.ts, utils.ts, config.ts]
State: { initialized: true }
```

**Thinking Rounds**:
- Round 1: "Analyzing codebase structure..."
  - Decision: continue_thinking(true, "Need deeper analysis")
- Round 2: "Found 3 main modules..."
  - Decision: continue_thinking(false, "Ready to act")

**Summary Generated**:
```
"Analyzed codebase structure, identified 3 main modules: main, utils, config"
Insights: ["3 modules found", "Main entry point in main.ts", "Config uses JSON"]
```

**Stored in Memory**: Turn 1, Context ID: ctx_1_xxx

---

### Turn 2: Performance Analysis

**Workspace Context**:
```
Files: [main.ts, utils.ts, config.ts, benchmark.ts]
State: { initialized: true, benchmarkRun: true }
```

**Accumulated Summaries Injected**:
```
[Turn 1] Analyzed codebase structure, identified 3 main modules
Insights: 3 modules found; Main entry point in main.ts; Config uses JSON
```

**Thinking Rounds**:
- Round 1: "Reviewing benchmark results..."
  - Recall: recall_context({ turnNumbers: [1] })
  - Recalled: Full context from Turn 1
  - Decision: continue_thinking(true, "Need to identify bottleneck")
- Round 2: "Found bottleneck in utils.ts..."
  - Decision: continue_thinking(false, "Ready to optimize")

**Summary Generated**:
```
"Identified performance bottleneck in utils.ts, specifically in the parseData function"
Insights: ["Bottleneck in parseData", "O(n²) complexity", "Can optimize to O(n)"]
```

**Stored in Memory**: Turn 2, Context ID: ctx_2_xxx

---

### Turn 3: Optimization Implementation

**Workspace Context**:
```
Files: [main.ts, utils.ts, config.ts, benchmark.ts]
State: { initialized: true, benchmarkRun: true, optimized: true }
```

**Accumulated Summaries Injected**:
```
[Turn 1] Analyzed codebase structure, identified 3 main modules
Insights: 3 modules found; Main entry point in main.ts; Config uses JSON

[Turn 2] Identified performance bottleneck in utils.ts, specifically in parseData
Insights: Bottleneck in parseData; O(n²) complexity; Can optimize to O(n)
```

**Thinking Rounds**:
- Round 1: "Planning optimization strategy..."
  - Recall: recall_context({ keywords: ["bottleneck", "parseData"] })
  - Recalled: Context from Turn 2
  - Decision: continue_thinking(false, "Clear plan, ready to implement")

**Summary Generated**:
```
"Implemented O(n) optimization in parseData, performance improved 10x"
Insights: ["Optimization complete", "10x speedup", "Tests passing"]
```

**Stored in Memory**: Turn 3, Context ID: ctx_3_xxx

## Benefits

### 1. Complete Context History
- Every workspace state is preserved
- Can reference any historical context
- No information loss

### 2. Intelligent Compression
- LLM generates meaningful summaries
- Summaries accumulate in prompt
- Much smaller than full contexts

### 3. Flexible Recall
- Recall by turn number (temporal)
- Recall by context ID (direct)
- Recall by keyword (semantic)

### 4. Deep Thinking
- Multiple thinking rounds
- LLM controls when to act
- Better decision quality

### 5. Memory Persistence
- Export/import memory state
- Resume conversations
- Long-term memory

## Configuration

### Thinking Strategy

```typescript
reflectiveThinking: {
  maxThinkingRounds: 5,      // Balance depth vs speed
  thinkingTokenBudget: 10000, // Control thinking cost
  enableRecall: true,         // Enable/disable recall
  maxRecallContexts: 3,       // Limit recalled contexts
}
```

**Recommendations**:
- Simple tasks: 2-3 rounds, 5000 tokens
- Complex tasks: 5-7 rounds, 15000 tokens
- Research tasks: 7-10 rounds, 20000 tokens

### Memory Management

The system automatically:
- Stores all contexts (no manual management)
- Generates summaries (LLM-driven)
- Accumulates summaries (automatic injection)
- Handles recall (LLM-controlled)

## Comparison with Basic Thinking

| Feature | Basic Thinking | Reflective Thinking |
|---------|---------------|---------------------|
| Thinking rounds | 1 (fixed) | 1-N (LLM-controlled) |
| Context storage | None | Complete history |
| Summarization | Manual | LLM-generated |
| Memory accumulation | No | Yes (automatic) |
| Historical recall | No | Yes (LLM-controlled) |
| Token efficiency | Good | Better (summaries) |
| Decision quality | Good | Better (deep thinking) |

## Future Enhancements

1. **Semantic Compression**: Use embeddings for smarter compression
2. **Relevance Ranking**: Rank recalled contexts by relevance
3. **Memory Pruning**: Automatically prune less important memories
4. **Cross-Session Memory**: Share memory across agent instances
5. **Memory Visualization**: UI for exploring memory graph
6. **Adaptive Thinking**: Adjust thinking depth based on task complexity

## Implementation Notes

### Token Management

- Summaries are much smaller than full contexts (~10-20x compression)
- Accumulated summaries grow linearly with turns
- Consider pruning old summaries after N turns
- Thinking phase has separate token budget

### Performance

- Context storage is in-memory (fast)
- Summary generation requires LLM call (slower)
- Recall is instant (memory lookup)
- Export/import for persistence

### Error Handling

- If summary generation fails, use fallback summary
- If recall fails, continue without recalled context
- If thinking exceeds budget, force exit to action
- All errors are logged for debugging

## Testing

See `examples.ts` for usage examples and test scenarios.

## API Reference

See individual component files for detailed API documentation:
- `ContextMemoryStore.ts` - Memory storage
- `ReflectiveThinkingProcessor.ts` - Thinking logic
- `ReflectiveAgent.ts` - Agent integration
