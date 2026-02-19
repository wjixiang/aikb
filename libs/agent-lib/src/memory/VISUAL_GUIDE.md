# Reflective Thinking and Memory System - Visual Guide

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         User Query                                   │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      ReflectiveAgent                                 │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  Request Loop (for each turn)                                 │  │
│  │                                                                │  │
│  │  1. Get current workspace context                             │  │
│  │  2. THINKING PHASE ──────────────────────┐                    │  │
│  │  3. ACTION PHASE                         │                    │  │
│  │  4. Update workspace                     │                    │  │
│  │  5. Continue if not completed            │                    │  │
│  └───────────────────────────────────────────┼────────────────────┘  │
└────────────────────────────────────────────┼───────────────────────┘
                                             │
                                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│              ReflectiveThinkingProcessor                             │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  Thinking Phase (continuous rounds)                           │  │
│  │                                                                │  │
│  │  Round 1:                                                      │  │
│  │    ├─ Analyze situation                                       │  │
│  │    ├─ Review accumulated summaries                            │  │
│  │    ├─ Optionally recall historical context                    │  │
│  │    └─ Decide: continue_thinking(true/false)                   │  │
│  │                                                                │  │
│  │  Round 2 (if continue=true):                                  │  │
│  │    ├─ Deeper analysis                                         │  │
│  │    ├─ Use recalled context                                    │  │
│  │    └─ Decide: continue_thinking(true/false)                   │  │
│  │                                                                │  │
│  │  Round N:                                                      │  │
│  │    └─ Final decision: continue_thinking(false)                │  │
│  │                                                                │  │
│  │  After thinking:                                               │  │
│  │    ├─ Generate summary for this turn                          │  │
│  │    ├─ Store in ContextMemoryStore                             │  │
│  │    └─ Return compressed history + accumulated summaries       │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    ContextMemoryStore                                │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  Storage Structure                                            │  │
│  │                                                                │  │
│  │  contexts: Map<id, ContextSnapshot>                           │  │
│  │    ├─ Turn 1: { id, fullContext, summary, ... }              │  │
│  │    ├─ Turn 2: { id, fullContext, summary, ... }              │  │
│  │    └─ Turn N: { id, fullContext, summary, ... }              │  │
│  │                                                                │  │
│  │  summaries: Map<id, MemorySummary>                            │  │
│  │    ├─ Turn 1: { summary, insights, ... }                     │  │
│  │    ├─ Turn 2: { summary, insights, ... }                     │  │
│  │    └─ Turn N: { summary, insights, ... }                     │  │
│  │                                                                │  │
│  │  Operations:                                                   │  │
│  │    ├─ Store context                                           │  │
│  │    ├─ Store summary                                           │  │
│  │    ├─ Retrieve by turn/id                                     │  │
│  │    ├─ Search by keyword                                       │  │
│  │    └─ Export/import                                           │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

## Thinking Phase Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│  Start Thinking Phase                                                │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Build Thinking Prompt                                               │
│  ├─ System prompt: "You are in THINKING phase..."                   │
│  ├─ Conversation history                                             │
│  ├─ Current workspace context                                        │
│  ├─ Accumulated summaries from previous turns                        │
│  └─ Previous thinking rounds (if any)                                │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Call LLM with Thinking Tools                                        │
│  ├─ continue_thinking(continueThinking, reason, nextFocus?)         │
│  └─ recall_context(turnNumbers?, contextIds?, keywords?)            │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Process LLM Response                                                │
│  ├─ Extract thinking content                                         │
│  ├─ Extract control decision (continue_thinking)                     │
│  └─ Extract recall request (recall_context)                          │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
                    ┌───────────┴───────────┐
                    │  Recall requested?    │
                    └───────────┬───────────┘
                                │
                    ┌───────────┴───────────┐
                    │ Yes                   │ No
                    ▼                       ▼
        ┌─────────────────────┐    ┌─────────────────┐
        │  Handle Recall      │    │  Skip recall    │
        │  ├─ By turn number  │    └─────────────────┘
        │  ├─ By context ID   │
        │  └─ By keyword      │
        └─────────────────────┘
                    │
                    └───────────┬───────────┘
                                ▼
                    ┌───────────────────────┐
                    │  Continue thinking?   │
                    └───────────┬───────────┘
                                │
                    ┌───────────┴───────────┐
                    │ Yes                   │ No
                    ▼                       ▼
        ┌─────────────────────┐    ┌─────────────────────┐
        │  Next round         │    │  Exit thinking      │
        │  (increment round)  │    │  Generate summary   │
        └─────────────────────┘    └─────────────────────┘
                    │                       │
                    └───────────┬───────────┘
                                ▼
                    ┌───────────────────────┐
                    │  Check limits         │
                    │  ├─ Max rounds?       │
                    │  └─ Token budget?     │
                    └───────────┬───────────┘
                                │
                    ┌───────────┴───────────┐
                    │ Within limits         │ Exceeded
                    ▼                       ▼
        ┌─────────────────────┐    ┌─────────────────────┐
        │  Continue loop      │    │  Force exit         │
        │  (back to top)      │    │  Generate summary   │
        └─────────────────────┘    └─────────────────────┘
```

## Memory Accumulation Flow

```
Turn 1:
┌─────────────────────────────────────────────────────────────────────┐
│  Workspace Context                                                   │
│  ├─ Files: [main.ts, utils.ts]                                      │
│  └─ State: { initialized: true }                                    │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Thinking Phase                                                      │
│  └─ 2 rounds of thinking                                             │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Summary Generated                                                   │
│  ├─ "Analyzed codebase structure, found 2 modules"                  │
│  └─ Insights: ["2 modules", "Main entry in main.ts"]                │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Stored in Memory                                                    │
│  └─ Turn 1, Context ID: ctx_1_xxx                                    │
└─────────────────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════════

Turn 2:
┌─────────────────────────────────────────────────────────────────────┐
│  Workspace Context (updated)                                         │
│  ├─ Files: [main.ts, utils.ts, config.ts]                           │
│  └─ State: { initialized: true, configured: true }                  │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Accumulated Summaries (injected into prompt)                        │
│  └─ [Turn 1] Analyzed codebase structure, found 2 modules           │
│      Insights: 2 modules; Main entry in main.ts                     │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Thinking Phase                                                      │
│  ├─ Round 1: Review previous work                                   │
│  ├─ Recall: recall_context({ turnNumbers: [1] })                    │
│  └─ Round 2: Plan next steps                                        │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Summary Generated                                                   │
│  ├─ "Added configuration module, integrated with main"              │
│  └─ Insights: ["Config module added", "JSON-based config"]          │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Stored in Memory                                                    │
│  └─ Turn 2, Context ID: ctx_2_xxx                                    │
└─────────────────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════════

Turn 3:
┌─────────────────────────────────────────────────────────────────────┐
│  Workspace Context (updated)                                         │
│  ├─ Files: [main.ts, utils.ts, config.ts, test.ts]                  │
│  └─ State: { initialized: true, configured: true, tested: true }    │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Accumulated Summaries (injected into prompt)                        │
│  ├─ [Turn 1] Analyzed codebase structure, found 2 modules           │
│  │   Insights: 2 modules; Main entry in main.ts                     │
│  └─ [Turn 2] Added configuration module, integrated with main       │
│      Insights: Config module added; JSON-based config               │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Thinking Phase                                                      │
│  ├─ Round 1: Review all previous work                               │
│  ├─ Recall: recall_context({ keywords: ["config"] })                │
│  └─ Round 2: Verify testing strategy                                │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Summary Generated                                                   │
│  ├─ "Added comprehensive tests, all passing"                        │
│  └─ Insights: ["Tests added", "100% coverage", "All green"]         │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Stored in Memory                                                    │
│  └─ Turn 3, Context ID: ctx_3_xxx                                    │
└─────────────────────────────────────────────────────────────────────┘
```

## Context Recall Mechanism

```
┌─────────────────────────────────────────────────────────────────────┐
│  LLM in Thinking Phase                                               │
│  "I need to recall the configuration details from earlier..."       │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Tool Call: recall_context                                           │
│  {                                                                   │
│    "keywords": ["configuration", "config"]                           │
│  }                                                                   │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  ContextMemoryStore.searchSummaries("configuration")                 │
│  └─ Returns: [MemorySummary from Turn 2]                             │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Get Full Context                                                    │
│  └─ ContextMemoryStore.getContext(ctx_2_xxx)                         │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Recalled Context Injected into Next Thinking Round                  │
│  ├─ Full workspace context from Turn 2                               │
│  ├─ Files: [main.ts, utils.ts, config.ts]                           │
│  └─ State: { initialized: true, configured: true }                  │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  LLM Uses Recalled Context                                           │
│  "Based on the recalled context, I can see the config uses JSON..." │
└─────────────────────────────────────────────────────────────────────┘
```

## Token Efficiency Comparison

```
Without Memory System:
┌─────────────────────────────────────────────────────────────────────┐
│  Turn 1: Workspace Context (5000 tokens)                             │
│  Turn 2: Workspace Context (5000 tokens) ← Duplicated!              │
│  Turn 3: Workspace Context (5000 tokens) ← Duplicated!              │
│  ...                                                                 │
│  Total: N × 5000 tokens (grows linearly, lots of duplication)       │
└─────────────────────────────────────────────────────────────────────┘

With Memory System:
┌─────────────────────────────────────────────────────────────────────┐
│  Turn 1: Summary (200 tokens)                                        │
│  Turn 2: Summary (200 tokens)                                        │
│  Turn 3: Summary (200 tokens)                                        │
│  ...                                                                 │
│  Total: N × 200 tokens (grows linearly, but 25x smaller!)           │
│                                                                      │
│  Full contexts stored separately (not in prompt)                     │
│  Recalled only when needed (selective, not automatic)                │
└─────────────────────────────────────────────────────────────────────┘

Savings: ~96% token reduction for accumulated context!
```

## Data Flow Summary

```
User Query
    │
    ▼
ReflectiveAgent.start()
    │
    ▼
requestLoop() ─────────────────────────────────────┐
    │                                               │
    ├─ Get workspace context                       │
    │                                               │
    ▼                                               │
ReflectiveThinkingProcessor                         │
    │                                               │
    ├─ performReflectiveThinking()                 │
    │   ├─ Round 1: Analyze                        │
    │   ├─ Round 2: Deeper analysis                │
    │   └─ Round N: Final decision                 │
    │                                               │
    ├─ generateContextSummary()                    │
    │                                               │
    ▼                                               │
ContextMemoryStore                                  │
    │                                               │
    ├─ storeContext(fullContext)                   │
    ├─ storeSummary(summary, insights)             │
    │                                               │
    ▼                                               │
Back to ReflectiveAgent                             │
    │                                               │
    ├─ Get accumulated summaries                   │
    ├─ Build prompt with summaries                 │
    │                                               │
    ▼                                               │
ACTION PHASE                                        │
    │                                               │
    ├─ Call LLM with action tools                  │
    ├─ Execute tools                               │
    ├─ Update workspace                            │
    │                                               │
    └─ If not completed, loop back ────────────────┘
```
