# Sequential Thinking Implementation

## Overview

This document describes the implementation of Sequential Thinking mode in the ThinkingModule, inspired by the Sequential Thinking MCP server pattern. Sequential Thinking provides a dynamic and reflective problem-solving approach that allows LLMs to break down complex problems into manageable steps, revise previous thoughts, and generate/verify hypotheses.

## Architecture

### Key Components

1. **ThinkingModule** ([`libs/agent-lib/src/thinking/ThinkingModule.ts`](../libs/agent-lib/src/thinking/ThinkingModule.ts))
   - Core thinking orchestration with Sequential Thinking support
   - Manages thinking state across multiple rounds
   - Provides both standard and sequential thinking modes

2. **ThinkingRound** ([`libs/agent-lib/src/memory/Turn.ts`](../libs/agent-lib/src/memory/Turn.ts))
   - Enhanced to include Sequential Thinking properties
   - Tracks thought numbers, revisions, branches, and hypotheses

3. **Thinking Types** ([`libs/agent-lib/src/thinking/types.ts`](../libs/agent-lib/src/thinking/types.ts))
   - Defines ThinkingMode enum (STANDARD, SEQUENTIAL)
   - Configuration and result types for Sequential Thinking

## Sequential Thinking Features

### Core Capabilities

1. **Dynamic Thought Progression**
   - Each thought has a thoughtNumber and totalThoughts estimate
   - Estimates can be adjusted up or down as thinking progresses
   - Thoughts can be added even after reaching what seemed like the end

2. **Revision and Branching**
   - `isRevision`: Marks thoughts that revise previous thinking
   - `revisesThought`: Specifies which thought number is being reconsidered
   - `branchFromThought`: Indicates the branching point
   - `branchId`: Identifier for the current branch

3. **Hypothesis Generation and Verification**
   - `hypothesis`: Solution hypothesis generated during thinking
   - `hypothesisVerified`: Whether the hypothesis has been verified
   - Supports iterative hypothesis refinement

4. **Flexible Control Flow**
   - `nextThoughtNeeded`: Controls whether to continue thinking
   - `needsMoreThoughts`: Flag for realizing more thoughts are needed at the end
   - LLM has full control over when to stop thinking

### Tool Parameters

The `continue_thinking` tool now supports these Sequential Thinking parameters:

```typescript
{
  continueThinking: boolean;      // Whether to continue thinking
  reason: string;                 // Reason for the decision
  thoughtNumber: number;          // Current thought number (required)
  totalThoughts: number;          // Estimated total thoughts (required)
  isRevision?: boolean;           // Whether this revises previous thinking
  revisesThought?: number;        // Which thought is being reconsidered
  branchFromThought?: number;     // Branching point thought number
  branchId?: string;              // Branch identifier
  needsMoreThoughts?: boolean;    // If more thoughts are needed
  hypothesis?: string;            // Solution hypothesis
  hypothesisVerified?: boolean;   // Whether hypothesis is verified
  nextFocus?: string;             // What to focus on next
  summary?: string;               // Detailed summary (required when stopping)
}
```

## Configuration

### ThinkingModuleConfig

```typescript
interface ThinkingModuleConfig {
  maxThinkingRounds: number;        // Maximum thinking rounds (default: 10)
  thinkingTokenBudget: number;      // Token budget (default: 15000)
  enableSummarization: boolean;     // Enable summarization (default: true)
  apiRequestTimeout: number;        // API timeout (default: 40000)
  thinkingMode: ThinkingMode;       // STANDARD or SEQUENTIAL (default: STANDARD)
}
```

### Default Configuration

```typescript
const defaultThinkingConfig: ThinkingModuleConfig = {
  maxThinkingRounds: 10,
  thinkingTokenBudget: 15000,
  enableSummarization: true,
  apiRequestTimeout: 40000,
  thinkingMode: ThinkingMode.STANDARD,
};
```

## Usage

### Basic Sequential Thinking

```typescript
// Configure ThinkingModule for Sequential Thinking
const config: Partial<ThinkingModuleConfig> = {
  thinkingMode: ThinkingMode.SEQUENTIAL,
  maxThinkingRounds: 15,
};

// Create ThinkingModule
const thinkingModule = new ThinkingModule(
  apiClient,
  logger,
  config,
  turnMemoryStore
);

// Perform Sequential Thinking phase
const result = await thinkingModule.performSequentialThinkingPhase(
  workspaceContext,
  taskContext
);

// Access Sequential Thinking state
console.log('Thoughts:', result.sequentialState.thoughtNumber);
console.log('Total estimated:', result.sequentialState.totalThoughts);
console.log('Branches:', result.sequentialState.branches);
```

### Standard Thinking (Backward Compatible)

```typescript
// Standard thinking mode (default)
const result = await thinkingModule.performThinkingPhase(
  workspaceContext,
  taskContext
);
```

## Sequential Thinking Process

### 1. Initialization

```typescript
private resetSequentialState(): void {
  this.sequentialState = {
    thoughtNumber: 1,
    totalThoughts: this.config.maxThinkingRounds,
    branches: new Map(),
  };
}
```

### 2. Thought Execution

Each thinking round:
1. LLM provides thought content as text
2. LLM calls `continue_thinking` with Sequential Thinking parameters
3. System updates sequential state based on parameters
4. Process repeats until `continueThinking = false`

### 3. State Tracking

```typescript
private updateSequentialState(round: ThinkingRound): void {
  // Update thought number
  this.sequentialState.thoughtNumber = round.thoughtNumber;
  
  // Update total thoughts estimate
  if (round.totalThoughts > 0) {
    this.sequentialState.totalThoughts = round.totalThoughts;
  }
  
  // Handle branching
  if (round.branchId && round.branchFromThought) {
    if (!this.sequentialState.branches.has(round.branchId)) {
      this.sequentialState.branches.set(round.branchId, []);
    }
    this.sequentialState.branches.get(round.branchId)!.push(round.thoughtNumber);
    this.sequentialState.activeBranchId = round.branchId;
  }
}
```

## Prompt Engineering

The system prompt includes comprehensive Sequential Thinking guidance:

```
🧠 SEQUENTIAL THINKING MODE 🧠
You are using Sequential Thinking - a dynamic and reflective problem-solving approach.

Key Principles:
- Break down complex problems into manageable steps
- Each thought can build on, question, or revise previous insights
- You can adjust your estimate of total thoughts as you progress
- Generate and verify hypotheses before reaching conclusions
- Feel free to branch into alternative approaches
- Express uncertainty when present
- Don't hesitate to add more thoughts even when you think you're done
```

## Benefits

1. **Enhanced Problem Solving**
   - Systematic breakdown of complex problems
   - Ability to revise and refine thoughts
   - Hypothesis-driven approach

2. **Better Traceability**
   - Each thought is numbered and tracked
   - Revisions and branches are explicitly marked
   - Complete audit trail of reasoning

3. **Improved Flexibility**
   - Dynamic adjustment of thought estimates
   - Support for branching exploration
   - No rigid commitment to initial plans

4. **Backward Compatibility**
   - Standard thinking mode remains unchanged
   - Sequential Thinking is opt-in via configuration
   - Existing code continues to work without modification

## Migration Guide

### For Existing Code

No changes required! Standard thinking mode works as before.

### To Enable Sequential Thinking

1. Update configuration:
```typescript
const config = {
  thinkingMode: ThinkingMode.SEQUENTIAL,
  // ... other config
};
```

2. Use `performSequentialThinkingPhase()` instead of `performThinkingPhase()`:
```typescript
const result = await thinkingModule.performSequentialThinkingPhase(
  workspaceContext,
  taskContext
);
```

3. Access Sequential Thinking state:
```typescript
const { sequentialState } = result;
console.log(`Thought ${sequentialState.thoughtNumber}/${sequentialState.totalThoughts}`);
```

## Future Enhancements

Potential improvements to consider:

1. **Visualization**
   - Thought tree visualization
   - Branch exploration UI
   - Hypothesis verification tracking

2. **Analytics**
   - Thought pattern analysis
   - Branch success metrics
   - Hypothesis accuracy tracking

3. **Optimization**
   - Thought caching for similar problems
   - Branch pruning strategies
   - Adaptive thought estimation

## References

- Sequential Thinking MCP Server: [Original implementation](https://github.com/modelcontextprotocol/servers/tree/main/src/sequentialthinking)
- Thinking Module Design: [`plans/thinking-module-refactoring-design.md`](../plans/thinking-module-refactoring-design.md)
- Agent Architecture: [`docs/agent-thinking-cycle-implementation.md`](agent-thinking-cycle-implementation.md)
