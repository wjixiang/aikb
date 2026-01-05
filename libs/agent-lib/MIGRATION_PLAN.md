# Migration Plan: From Task Framework to Agent Framework

## Overview

This document outlines the migration plan from the old `Task` framework (`libs/agent-lib/src/task/task.entity.ts`) to the new `Agent` framework (`libs/agent-lib/src/agent/agent.ts`) and its application-specific implementation (`apps/medquiz-web/src/lib/agents/Agent.ts`).

## Architecture Comparison

### Old Framework (Task Entity)

**Location:** `libs/agent-lib/src/task/task.entity.ts`

**Key Characteristics:**

- Monolithic Task class with all functionality in one place
- Tool-based interaction only (no state-based workspace)
- Observer pattern for events (message added, status changed, etc.)
- Recursive request loop with stack-based retry mechanism
- Built-in error handling with retry logic
- Token usage tracking
- Tool usage tracking
- Consecutive mistake counting

**Core Components:**

- `TaskObservers` - Event notification system
- `TokenUsageTracker` - Token usage monitoring
- `ResponseProcessor` - API response parsing (native/XML protocols)
- `TaskErrorHandler` - Error handling and retry logic
- `ToolExecutor` - Tool execution with timeout handling
- `TooCallingParser` - Tool call parsing

**Main Features:**

1. **Recursive API Requests** - `recursivelyMakeClineRequests()` with stack-based retry
2. **Stream Processing** - Collects complete response from stream
3. **Tool Execution** - Executes tools and builds user message content
4. **Error Handling** - Retry mechanism with consecutive mistake tracking
5. **Message History** - Maintains conversation history with timestamps
6. **Status Management** - Idle, running, completed, aborted states
7. **Lifecycle Methods** - Start, complete, abort, dispose

### New Framework (Agent)

**Location:** `libs/agent-lib/src/agent/agent.ts`

**Key Characteristics:**

- Abstract base class for extensible agent implementations
- Workspace-based state management (EditableProps pattern)
- Component-based architecture (React-like for LLM)
- Tool execution with context support
- Simplified API with cleaner abstractions

**Core Components:**

- `AgentContext` - Context management
- `AgentTask` - Task lifecycle management
- `IWorkspace` - Workspace interface for state management
- `ToolContext` - Context passing to tools

**Main Features:**

1. **Workspace Integration** - State-based interaction through EditableProps
2. **Tool Context** - Pass workspace and other context to tools
3. **System Prompt** - Dynamic system prompt with workspace context
4. **Message Conversion** - ApiMessage to Anthropic.MessageParam conversion
5. **Timeout Handling** - API request timeout with Promise.race

### Application-Specific Agent (MedQuiz)

**Location:** `apps/medquiz-web/src/lib/agents/Agent.ts`

**Key Characteristics:**

- Node-based execution pattern
- Async generator for streaming responses
- RAG-focused implementation
- Simple task planning (hardcoded for now)

**Core Components:**

- `AgentNode` - Task execution nodes (e.g., ExecuteRAGNode)
- `AgentMessage` - Unified message types for communication
- `AgentStep` - Step information with status

**Main Features:**

1. **Node Registration** - Register and execute task nodes
2. **Async Generator** - Stream AgentMessage results
3. **Task Planning** - Select appropriate task for query
4. **Error Handling** - Basic error handling with yield

## Migration Gaps Analysis

### 1. Core Agent Framework Gaps

| Feature                      | Old Framework                              | New Framework              | Status  |
| ---------------------------- | ------------------------------------------ | -------------------------- | ------- |
| Recursive Request Loop       | ✅ Stack-based with retry                  | ❌ Not implemented         | Missing |
| Stream Processing            | ✅ Collect complete response               | ✅ Implemented             | Done    |
| Tool Execution               | ✅ With ToolExecutor                       | ✅ With ToolCallingHandler | Done    |
| Error Handling               | ✅ Retry with consecutive mistake tracking | ❌ Basic only              | Partial |
| Message History              | ✅ With timestamps                         | ✅ Basic                   | Partial |
| Status Management            | ✅ Idle/Running/Completed/Aborted          | ❌ Not implemented         | Missing |
| Lifecycle Methods            | ✅ Start/Complete/Abort                    | ❌ Not implemented         | Missing |
| Observer Pattern             | ✅ Message/Status/Task callbacks           | ❌ Not implemented         | Missing |
| Token Usage Tracking         | ✅ TokenUsageTracker                       | ❌ Not implemented         | Missing |
| Tool Usage Tracking          | ✅ ToolUsage with attempts/failures        | ❌ Not implemented         | Missing |
| Response Processing          | ✅ Native/XML protocols                    | ❌ Not implemented         | Missing |
| Message Adding               | ✅ addToConversationHistory                | ❌ Not implemented         | Missing |
| Retry Logic                  | ✅ Configurable max retry attempts         | ❌ Not implemented         | Missing |
| Abort Checking               | ✅ isAborted() checks                      | ❌ Not implemented         | Missing |
| Consecutive Mistake Tracking | ✅ Limit-based                             | ❌ Not implemented         | Missing |
| System Prompt                | ✅ With tool protocol                      | ✅ With workspace          | Done    |
| Workspace Integration        | ❌ Not available                           | ✅ EditableProps           | New     |

### 2. Application-Specific Gaps

| Feature         | Old Framework      | MedQuiz Agent     | Status  |
| --------------- | ------------------ | ----------------- | ------- |
| Task Planning   | ❌ Not applicable  | ⚠️ Hardcoded      | Partial |
| Node Pattern    | ❌ Not applicable  | ✅ AgentNode      | New     |
| Async Generator | ❌ Not applicable  | ✅ Implemented    | Done    |
| Message Types   | ❌ ApiMessage only | ✅ AgentMessage   | New     |
| RAG Integration | ❌ Not applicable  | ✅ ExecuteRAGNode | New     |
| Speech Support  | ❌ Not applicable  | ✅ speechData     | New     |
| References      | ❌ Not applicable  | ✅ references     | New     |
| CoT Support     | ❌ Not applicable  | ✅ cot            | New     |

## Migration Plan

### Phase 1: Core Agent Framework (libs/agent-lib/src/agent/agent.ts)

#### Step 1.1: Implement Status Management

- Add `_status: TaskStatus` property
- Add `status` getter
- Add `setStatus()` method
- Add `isAborted()` method

#### Step 1.2: Implement Observer Pattern

- Create `AgentObservers` class
- Add observer registration methods:
  - `onMessageAdded()`
  - `onStatusChanged()`
  - `onTaskCompleted()`
  - `onTaskAborted()`
- Add notification methods

#### Step 1.3: Implement Message History Management

- Add `addToConversationHistory()` method
- Add `addAssistantMessageToHistory()` method
- Support ExtendedApiMessage with timestamps and ThinkingBlock

#### Step 1.4: Implement Response Processing

- Create `AgentResponseProcessor` class
- Add `processCompleteResponse()` for native protocol
- Add `processXmlCompleteResponse()` for XML protocol
- Handle reasoning content
- Parse tool calls

#### Step 1.5: Implement Tool Execution

- Create `AgentToolExecutor` class
- Add `executeToolCalls()` method
- Support tool usage tracking
- Handle attempt_completion
- Parse tool call responses

#### Step 1.6: Implement Error Handling

- Create `AgentErrorHandler` class
- Add retry logic with configurable max attempts
- Add consecutive mistake tracking
- Add error formatting for LLM

#### Step 1.7: Implement Recursive Request Loop

- Implement `recursivelyMakeClineRequests()` method
- Use stack-based retry mechanism
- Check abort status
- Handle errors with retry
- Process tool calls
- Check for attempt_completion

#### Step 1.8: Implement Lifecycle Methods

- Add `start()` method
- Add `complete()` method
- Add `abort()` method
- Add lifecycle hooks

#### Step 1.9: Implement Tracking

- Create `AgentTokenUsageTracker` class
- Create `AgentToolUsageTracker` class
- Add tracking methods

#### Step 1.10: Integrate All Components

- Wire up all helper classes in constructor
- Ensure proper initialization order
- Add configuration support

### Phase 2: Application-Specific Agent (apps/medquiz-web/src/lib/agents/Agent.ts)

#### Step 2.1: Integrate Core Framework

- Extend from new Agent framework
- Remove duplicate functionality
- Use core framework features

#### Step 2.2: Implement Task Planning

- Replace hardcoded task selection
- Use BAML for task planning
- Support multiple tasks

#### Step 2.3: Enhance Node Pattern

- Add node lifecycle hooks
- Support node state management
- Add node error handling

#### Step 2.4: Add Workspace Support

- Create MedQuiz workspace
- Define EditableProps for quiz state
- Integrate with Agent framework

#### Step 2.5: Add Streaming Support

- Stream AgentMessage types
- Support CoT streaming
- Support speech streaming

#### Step 2.6: Add References Support

- Track document references
- Yield reference messages
- Support citation formatting

### Phase 3: Testing & Validation

#### Step 3.1: Unit Tests

- Test Agent framework components
- Test workspace integration
- Test tool execution
- Test error handling

#### Step 3.2: Integration Tests

- Test end-to-end workflows
- Test with real APIs
- Test with real workspaces

#### Step 3.3: Performance Tests

- Compare performance with old framework
- Test under load
- Test with large conversations

## Implementation Priority

### High Priority (Core Functionality)

1. Status Management
2. Observer Pattern
3. Message History Management
4. Recursive Request Loop
5. Tool Execution
6. Error Handling

### Medium Priority (Enhanced Features)

1. Response Processing
2. Lifecycle Methods
3. Token Usage Tracking
4. Tool Usage Tracking

### Low Priority (Nice to Have)

1. Workspace integration for MedQuiz
2. Task planning improvements
3. Enhanced node pattern
4. Streaming optimizations

## Migration Strategy

### Incremental Approach

1. Implement core features first (status, observers, message history)
2. Add tool execution and error handling
3. Implement recursive request loop
4. Add tracking and monitoring
5. Migrate application-specific features

### Backward Compatibility

- Keep old framework during migration
- Use feature flags to switch between frameworks
- Gradually migrate existing tasks

### Testing Strategy

- Unit tests for each component
- Integration tests for workflows
- Side-by-side comparison testing
- Performance benchmarks

## Risk Assessment

### High Risk

- Breaking changes to existing tasks
- Performance degradation
- Tool execution failures

### Medium Risk

- Observer pattern complexity
- Error handling edge cases
- State synchronization issues

### Low Risk

- API compatibility
- Message format changes
- Configuration changes

## Success Criteria

1. All core features from old framework are implemented
2. Performance is equal or better than old framework
3. All existing tests pass
4. New framework is easier to extend
5. Workspace integration works correctly
6. Tool execution is reliable
7. Error handling is robust

## Timeline Estimate

- Phase 1 (Core Framework): 2-3 weeks
- Phase 2 (Application-Specific): 1-2 weeks
- Phase 3 (Testing & Validation): 1 week

Total: 4-6 weeks

## Notes

- The new framework's workspace-based architecture is a significant improvement
- The component-based pattern is more maintainable
- The async generator pattern in MedQuiz agent is a good pattern to keep
- The node pattern for task execution is flexible and extensible
