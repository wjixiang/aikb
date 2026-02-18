# Agent Thinking Cycle Proposal: Analysis and Design

## Current Architecture Analysis

### Current Flow: Tool Call → Tool Execution → Tool Call

The current [`Agent`](libs/agent-lib/src/agent/agent.ts:78) class implements a direct tool-calling loop:

```
User Query → API Request → Tool Calls → Tool Execution → API Request → Tool Calls → ...
```

### Current Workspace Context Handling Issue

**Critical Problem**: The current implementation injects Workspace Context into conversation history on **every cycle**, causing token explosion:

```typescript
// In agent.ts:333 - After tool execution
this.addSystemMessageToHistory(oldWorkspaceContext);  // ❌ Adds full workspace to history EVERY cycle
```

**Current flow:**
1. [`attemptApiRequest()`](libs/agent-lib/src/agent/agent.ts:598) gets fresh workspace context via [`workspace.render()`](libs/agent-lib/src/statefulContext/virtualWorkspace.ts:355)
2. [`PromptBuilder`](libs/agent-lib/src/prompts/PromptBuilder.ts:55) separates:
   - `systemPrompt` - Agent instructions
   - `workspaceContext` - **Current** workspace state (passed separately)
   - `memoryContext` - Conversation history
3. After tool execution, [`addSystemMessageToHistory()`](libs/agent-lib/src/agent/agent.ts:477) **adds the workspace context to history**
4. Next cycle: History contains **all previous workspace contexts** + current one

**Result**: After N cycles, conversation history contains N copies of workspace state, each potentially thousands of tokens.

**Key implementation details:**

1. **[`requestLoop()`](libs/agent-lib/src/agent/agent.ts:254)**: Main recursive loop that:
   - Sends current context to LLM via [`attemptApiRequest()`](libs/agent-lib/src/agent/agent.ts:598)
   - Receives [`ApiResponse`](libs/agent-lib/src/api-client/ApiClient.interface.ts:34) with tool calls
   - Executes tools via [`executeToolCalls()`](libs/agent-lib/src/agent/agent.ts:518)
   - Updates workspace state
   - Adds results to conversation history
   - Recurses until `attempt_completion` is called

2. **Context Management**: 
   - [`VirtualWorkspace.render()`](libs/agent-lib/src/statefulContext/virtualWorkspace.ts:355) provides workspace context
   - [`_conversationHistory`](libs/agent-lib/src/agent/agent.ts:82) stores message history
   - No explicit context compression between cycles

3. **Message Flow**:
   - System prompt + workspace context + conversation history → LLM
   - LLM returns tool calls (via [`ApiResponse`](libs/agent-lib/src/api-client/ApiClient.interface.ts:34))
   - Tool results added as user messages
   - **Workspace context added to conversation history** ❌
   - Loop continues

4. **Token Explosion Problem**:
   - Each cycle adds full workspace context to history
   - After 10 cycles: 10× workspace tokens in history
   - Current workspace is also sent separately (double counting)

---

## Proposed Architecture: Thinking → Tool Call → Tool Execution → Thinking

### New Flow

```
User Query → Thinking Phase → Tool Call → Tool Execution → Thinking Phase → Tool Call → ...
```

### 🎯 Key Insight: Thinking Phase Solves Workspace Context Problem

**YES!** The thinking phase can **completely eliminate** the current workspace context duplication issue:

**Current problematic pattern:**
```typescript
// Every cycle adds workspace to history
this.addSystemMessageToHistory(oldWorkspaceContext);  // ❌
```

**Proposed solution with thinking phase:**
```typescript
// Thinking phase manages workspace context separately
// NEVER adds full workspace to conversation history
// Only adds summaries/deltas when necessary
```

### How Thinking Phase Avoids Workspace Context Duplication

1. **Workspace as Separate Context Layer**
   - Workspace context is **always** passed fresh via `workspaceContext` parameter
   - Never added to `conversationHistory`
   - Each API request sees current workspace state without historical copies

2. **Thinking Phase Tracks State Changes**
   - Analyzes what changed since last cycle
   - Stores only **deltas** or **summaries** in thinking context
   - Conversation history remains focused on dialogue, not state

3. **Clean Separation of Concerns**
   ```
   ┌─────────────────────────────────────────┐
   │ API Request Components                  │
   ├─────────────────────────────────────────┤
   │ systemPrompt    │ Agent instructions    │
   │ workspaceContext│ CURRENT workspace     │ ← Always fresh, never in history
   │ memoryContext   │ Conversation history  │ ← User/assistant dialogue only
   │ thinkingContext │ State changes summary │ ← Optional, compressed
   └─────────────────────────────────────────┘
   ```

4. **Token Savings**
   - Before: N cycles × workspace tokens (exponential growth)
   - After: 1× workspace tokens per request (constant)
   - Example: 5000-token workspace × 10 cycles = **50,000 → 5,000 tokens saved**

### Design Specification

#### 1. Thinking Phase Interface

```typescript
interface ThinkingPhase {
    /**
     * Perform context analysis and compression
     * @param conversationHistory - Full conversation history
     * @param workspaceContext - Current workspace state
     * @param lastToolResults - Results from most recent tool executions
     * @returns Thinking result with compressed context
     */
    performThinking(
        conversationHistory: ApiMessage[],
        workspaceContext: string,
        lastToolResults?: ToolResult[]
    ): Promise<ThinkingResult>;
}

interface ThinkingResult {
    /** Summary of what has been accomplished */
    summary: string;
    /** Current state and context */
    currentState: string;
    /** Compressed/filtered conversation history */
    compressedHistory: ApiMessage[];
    /** Key insights from tool results */
    insights: string[];
    /** Next action plan */
    nextActions: string;
    /** Token usage for this thinking phase */
    thinkingTokens: number;
}
```

#### 2. Modified Request Loop

```typescript
protected async requestLoop(query: string): Promise<boolean> {
    // ... initialization ...
    
    while (stack.length > 0) {
        // ... existing code ...
        
        // NEW: Thinking phase BEFORE API request
        const thinkingResult = await this.performThinkingPhase(
            this._conversationHistory,
            oldWorkspaceContext,
            lastToolResults
        );
        
        // Use compressed history for API request
        const effectiveHistory = thinkingResult.compressedHistory;
        
        // API request with thinking context
        const response = await this.attemptApiRequest(thinkingResult);
        
        // Execute tools
        const executionResult = await this.executeToolCalls(response);
        
        // Store tool results for next thinking phase
        lastToolResults = executionResult.toolResults;
        
        // ... rest of loop ...
    }
}
```

#### 3. Context Compression Strategies

**Strategy A: Sliding Window with Summary**
```typescript
class SlidingWindowCompressor {
    compress(history: ApiMessage[], windowSize: number): ApiMessage[] {
        // Keep last N messages + summary of earlier messages
        const recent = history.slice(-windowSize);
        const older = history.slice(0, -windowSize);
        
        if (older.length > 0) {
            const summary = this.summarizeMessages(older);
            return [MessageBuilder.system(summary), ...recent];
        }
        return recent;
    }
}
```

**Strategy B: Semantic Relevance Filtering**
```typescript
class SemanticCompressor {
    compress(history: ApiMessage[], currentGoal: string): ApiMessage[] {
        // Use embedding similarity to filter relevant messages
        // Keep high-relevance messages, summarize low-relevance
    }
}
```

**Strategy C: Token Budget Management**
```typescript
class TokenBudgetCompressor {
    compress(history: ApiMessage[], maxTokens: number): ApiMessage[] {
        // Iteratively remove/summarize oldest messages until under budget
    }
}
```

---

## Feasibility Analysis

### ✅ Advantages

1. **🎯 Eliminates Workspace Context Duplication** (CRITICAL)
   - **Current bug**: Workspace added to history every cycle
   - **Fix**: Workspace always fresh, never duplicated
   - **Impact**: Massive token savings for long-running tasks
   - **Example**: 10 cycles × 5000 tokens = **50,000 tokens saved**

2. **Better Context Management**
   - Explicit control over context growth
   - Prevents token explosion in conversation history
   - Maintains focus on current goal

2. **Improved Reasoning**
   - Thinking phase allows explicit reflection
   - Can track progress and adjust strategy
   - Better error recovery through analysis

3. **Cost Optimization**
   - Proactive context compression reduces API costs
   - Can summarize intermediate steps
   - Better token budget management

4. **Observability**
   - Thinking results are inspectable
   - Clear audit trail of decision-making
   - Easier debugging

5. **Flexibility**
   - Pluggable compression strategies
   - Can adapt to different task types
   - Supports custom thinking logic

### ⚠️ Disadvantages

1. **Additional API Calls** (Mitigated by token savings)
   - Thinking phase may require LLM calls (unless using rule-based)
   - **BUT**: Token savings from workspace fix often outweigh thinking cost
   - Example: Thinking costs 500 tokens, saves 5000+ workspace tokens
   - Net benefit even with additional LLM call

2. **Complexity**
   - More moving parts in the agent loop
   - Harder to reason about behavior
   - More testing surface area

3. **State Management**
   - Need to track compressed vs. full history
   - Risk of losing important context
   - Compression may introduce errors

4. **Compatibility**
   - Current [`ApiClient`](libs/agent-lib/src/api-client/ApiClient.interface.ts:63) interface doesn't support thinking
   - May need interface changes
   - Existing tests may break

### 🔧 Implementation Challenges

1. **Compression Quality**
   - Poor compression loses critical information
   - Need robust summarization
   - May require fine-tuned models

2. **Timing**
   - When to compress? Every cycle? Every N cycles?
   - Adaptive thresholds needed
   - Risk of premature compression

3. **Token Counting**
   - Need accurate token estimation
   - Different models have different limits
   - Streaming responses complicate counting

4. **Error Recovery**
   - What if thinking phase fails?
   - Fallback to original behavior?
   - Error propagation in thinking

---

## Recommended Implementation Approach

### Phase 1: Minimal Viable Implementation

1. **Add Thinking Phase as Optional Feature**
   ```typescript
   export interface AgentConfig {
       apiRequestTimeout: number;
       maxRetryAttempts: number;
       consecutiveMistakeLimit: number;
       // NEW: Enable thinking phase
       enableThinkingPhase: boolean;
       // NEW: When to compress (token threshold)
       compressionThreshold: number;
   }
   ```

2. **Simple Rule-Based Thinking**
   - Token counting using existing [`TokenUsageTracker`](libs/agent-lib/src/task/token-usage/TokenUsageTracker.ts)
   - Sliding window compression
   - No additional LLM calls

3. **Preserve Current Behavior**
   - Default to `enableThinkingPhase: false`
   - Existing tests pass unchanged
   - Gradual migration path

### Phase 2: Enhanced Thinking

1. **LLM-Powered Thinking**
   - Use separate, cheaper model for summarization
   - Structured thinking output
   - Progress tracking

2. **Adaptive Compression**
   - Semantic relevance filtering
   - Task-specific strategies
   - Dynamic threshold adjustment

3. **Observability Features**
   - Thinking history logging
   - Compression metrics
   - Debug visualization

### Phase 3: Advanced Features

1. **Multi-Level Thinking**
   - Short-term vs. long-term memory
   - Hierarchical context organization
   - Goal decomposition

2. **Learning from History**
   - Pattern recognition in tool usage
   - Optimization of action sequences
   - Predictive context loading

---

## Proposed Code Changes

### 1. Extend AgentConfig

```typescript
// In libs/agent-lib/src/agent/agent.ts
export interface AgentConfig {
    apiRequestTimeout: number;
    maxRetryAttempts: number;
    consecutiveMistakeLimit: number;
    // NEW: Thinking phase configuration
    enableThinkingPhase?: boolean;
    thinkingStrategy?: 'sliding-window' | 'semantic' | 'token-budget';
    compressionThreshold?: number; // tokens
    thinkingModel?: string; // separate model for thinking
}
```

### 2. Add ThinkingProcessor Class

```typescript
// New file: libs/agent-lib/src/agent/ThinkingProcessor.ts
export class ThinkingProcessor {
    constructor(
        private config: AgentConfig,
        private apiClient: ApiClient
    ) {}
    
    async performThinking(
        conversationHistory: ApiMessage[],
        workspaceContext: string,
        lastToolResults?: ToolResult[]
    ): Promise<ThinkingResult> {
        // Implementation based on strategy
    }
    
    private compressSlidingWindow(history: ApiMessage[]): ApiMessage[] {
        // Sliding window implementation
    }
    
    private compressSemantic(history: ApiMessage[], goal: string): ApiMessage[] {
        // Semantic compression implementation
    }
}
```

### 3. Modify Agent.requestLoop() - Remove Workspace from History

```typescript
// In libs/agent-lib/src/agent/agent.ts
protected async requestLoop(query: string): Promise<boolean> {
    // ... existing initialization ...
    
    // NEW: Initialize thinking processor if enabled
    const thinkingProcessor = this.config.enableThinkingPhase
        ? new ThinkingProcessor(this.config, this.apiClient)
        : null;
    
    let lastToolResults: ToolResult[] = [];
    
    while (stack.length > 0) {
        const currentItem = stack.pop()!;
        const currentUserContent = currentItem.content;
        
        // ... existing code for adding user message ...
        
        const currentWorkspaceContext = await this.workspace.render();
        
        try {
            this.resetMessageState();
            
            // NEW: Optional thinking phase
            let effectiveHistory = this._conversationHistory;
            let thinkingContext: string | undefined;
            
            if (thinkingProcessor) {
                const thinkingResult = await thinkingProcessor.performThinking(
                    this._conversationHistory,
                    currentWorkspaceContext,
                    lastToolResults
                );
                effectiveHistory = thinkingResult.compressedHistory;
                thinkingContext = thinkingResult.summary;
                
                // Track thinking tokens
                this._tokenUsage.contextTokens += thinkingResult.thinkingTokens;
            }
            
            // API request with compressed history and FRESH workspace
            const response = await this.attemptApiRequest(
                retryAttempt,
                effectiveHistory,
                currentWorkspaceContext,  // Always fresh, never from history
                thinkingContext
            );
            
            // Execute tools
            const executionResult = await this.executeToolCalls(response);
            
            // Add assistant message
            await this.addAssistantMessageToHistory();
            
            // Add tool results
            if (executionResult.userMessageContent.length > 0) {
                await this.addToConversationHistory(
                    MessageBuilder.custom('user', executionResult.userMessageContent)
                );
            }
            
            // ❌ REMOVE: Never add workspace to history
            // this.addSystemMessageToHistory(oldWorkspaceContext);
            
            // ✅ NEW: Optionally add thinking summary instead
            if (thinkingProcessor && thinkingContext) {
                // Add concise thinking summary, not full workspace
                await this.addToConversationHistory(
                    MessageBuilder.system(`[Thinking] ${thinkingContext}`)
                );
            }
            
            lastToolResults = executionResult.toolResults;
            
            // ... rest of loop ...
        }
    }
}
```

### 4. Remove addSystemMessageToHistory() or Repurpose

```typescript
// Option A: Remove the method entirely
// It's no longer needed if we don't add workspace to history

// Option B: Repurpose for thinking summaries
addSystemMessageToHistory(message: string): void {
    this.addToConversationHistory(
        MessageBuilder.system(message)
    );
}
```

---

## Migration Strategy

### Step 1: Add Feature Flag
- Add `enableThinkingPhase` to config (default: `false`)
- No behavior change when disabled
- All existing tests pass

### Step 2: Implement Basic Thinking
- Add `ThinkingProcessor` class
- Implement sliding window compression
- Add unit tests for compression logic

### Step 3: Integration Testing
- Enable thinking phase in new tests
- Compare behavior with/without thinking
- Validate context preservation

### Step 4: Gradual Rollout
- Enable in specific agent types first
- Monitor metrics (tokens, cost, success rate)
- Iterate based on real-world usage

---

## Testing Considerations

### Unit Tests
```typescript
describe('ThinkingProcessor', () => {
    it('should compress history using sliding window', () => {
        // Test compression logic
    });
    
    it('should preserve critical messages', () => {
        // Test message importance
    });
    
    it('should handle empty history', () => {
        // Edge case testing
    });
});
```

### Integration Tests
```typescript
describe('Agent with Thinking Phase', () => {
    it('should complete task with compressed context', () => {
        // End-to-end test
    });
    
    it('should fall back gracefully on thinking failure', () => {
        // Error handling test
    });
});
```

### Comparison Tests
```typescript
describe('Thinking Phase Comparison', () => {
    it('should produce same results with/without thinking', () => {
        // A/B testing
    });
    
    it('should reduce token usage', () => {
        // Metric validation
    });
});
```

---

## Metrics to Track

1. **Token Usage**
   - Before/after compression
   - Thinking phase overhead
   - Total cost per task

2. **Performance**
   - Latency per cycle
   - Total task completion time
   - API call count

3. **Quality**
   - Task success rate
   - Error recovery rate
   - Context loss incidents

4. **Compression**
   - Compression ratio
   - Information preservation
   - Strategy effectiveness

---

## Critical Fix: Remove Workspace Context from History

**Even without implementing the full thinking phase, we can fix the immediate bug:**

### Quick Win: Remove Line 333

```typescript
// In libs/agent-lib/src/agent/agent.ts:333
// REMOVE THIS LINE:
// this.addSystemMessageToHistory(oldWorkspaceContext);
```

**Impact:**
- ✅ Eliminates token explosion immediately
- ✅ No behavior change (workspace already sent fresh each request)
- ✅ Safe to remove (workspace state is always current)
- ✅ Massive token savings for multi-step tasks

**Why this is safe:**
1. [`attemptApiRequest()`](libs/agent-lib/src/agent/agent.ts:598) always calls [`workspace.render()`](libs/agent-lib/src/statefulContext/virtualWorkspace.ts:355) for fresh state
2. [`PromptBuilder`](libs/agent-lib/src/prompts/PromptBuilder.ts:55) passes workspace separately from history
3. Adding workspace to history duplicates what's already in `workspaceContext` parameter
4. LLM sees current workspace state without needing historical copies

## Conclusion

The proposed thinking phase architecture is **feasible and offers significant benefits** for long-running agent tasks. The **workspace context duplication bug** is a critical issue that should be fixed immediately, regardless of thinking phase implementation.

**Priority Order:**
1. **🔴 CRITICAL**: Remove workspace context from conversation history (1 line change)
2. **🟡 HIGH**: Implement basic thinking phase with sliding window compression
3. **🟢 MEDIUM**: Add LLM-powered thinking and advanced features

However, it should be implemented **incrementally** with:

1. **Feature flag control** for easy rollback
2. **Simple initial implementation** (sliding window)
3. **Comprehensive testing** before enabling by default
4. **Metrics collection** to validate benefits

The key is to start simple and add complexity only when justified by real-world usage data.

---

## Next Steps

1. **🔴 IMMEDIATE**: Fix workspace context duplication bug
   - Remove [`addSystemMessageToHistory(oldWorkspaceContext)`](libs/agent-lib/src/agent/agent.ts:333)
   - Test to ensure no behavior change
   - Measure token savings

2. **Review this analysis** with the team
3. **Decide on Phase 1 scope** (minimal implementation)
4. **Create detailed task list** for implementation
5. **Set up metrics collection** infrastructure
6. **Begin implementation** with feature flag

Would you like me to proceed with:
- **Option A**: Fix the workspace context bug first (quick win, high impact)
- **Option B**: Implement full Phase 1 with thinking phase
- **Option C**: Both (fix bug + add thinking phase)
