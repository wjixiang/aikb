# Expert Architecture Diagrams

## 1. Current Skills Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Agent                                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    VirtualWorkspace                        │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │              SkillManager                          │  │  │
│  │  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │  │  │
│  │  │  │  Skill A   │  │  Skill B   │  │  Skill C   │ │  │  │
│  │  │  └─────────────┘  └─────────────┘  └─────────────┘ │  │  │
│  │  │         ↓              ↓              ↓            │  │  │
│  │  │  ┌──────────────────────────────────────────┐   │  │  │
│  │  │  │         Active Skill (only one)          │   │  │  │
│  │  │  └──────────────────────────────────────────┘   │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │              ToolManager                          │  │  │
│  │  │  Global Tools + Active Skill's Component Tools    │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │              Components                            │  │  │
│  │  │  Active Skill's Components (registered here)       │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │              MemoryModule                          │  │  │
│  │  │  Shared conversation history                        │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              ThinkingModule / ActionModule               │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Characteristics:
- **Single Active Skill**: Only one skill can be active at a time
- **Shared Context**: All components share the same workspace and memory
- **Sequential Execution**: Tasks are executed sequentially within the single agent
- **Manual Orchestration**: LLM decides which skill to activate and when

---

## 2. New Expert Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    ExpertOrchestrator                            │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              ExpertRegistry                              │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │  │
│  │  │ Expert A    │  │ Expert B    │  │ Expert C    │ ...  │  │
│  │  │ (Config)    │  │ (Config)    │  │ (Config)    │      │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                        ↓                                        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              ExpertExecutor                              │  │
│  │  Creates and manages Expert instances                    │  │
│  └──────────────────────────────────────────────────────────┘  │
│                        ↓                                        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │         Multiple Expert Instances (can coexist)          │  │
│  │  ┌─────────────────┐  ┌─────────────────┐               │  │
│  │  │ ExpertInstance A│  │ ExpertInstance B│               │  │
│  │  │ ┌─────────────┐ │  │ ┌─────────────┐ │               │  │
│  │  │ │    Agent    │ │  │ │    Agent    │ │               │  │
│  │  │ └─────────────┘ │  │ └─────────────┘ │               │  │
│  │  │ ┌─────────────┐ │  │ ┌─────────────┐ │               │  │
│  │  │ │VirtualWorkspace│ │  │VirtualWorkspace│               │  │
│  │  │ │  - Components│ │  │ │  - Components│ │               │  │
│  │  │ │  - Tools    │ │  │ │  - Tools    │ │               │  │
│  │  │ └─────────────┘ │  │ └─────────────┘ │               │  │
│  │  │ ┌─────────────┐ │  │ ┌─────────────┐ │               │  │
│  │  │ │MemoryModule │ │  │ │MemoryModule │ │               │  │
│  │  │ │(Independent)│ │  │ │(Independent)│ │               │  │
│  │  │ └─────────────┘ │  │ └─────────────┘ │               │  │
│  │  └─────────────────┘  └─────────────────┘               │  │
│  │         ↓                    ↓                           │  │
│  │  ┌─────────────────────────────────────────────┐       │  │
│  │  │         Artifacts (shareable)               │       │  │
│  │  └─────────────────────────────────────────────┘       │  │
│  └──────────────────────────────────────────────────────────┘  │
│                        ↓                                        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Result Aggregation                           │  │
│  │  Combines outputs from all experts                        │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Characteristics:
- **Multiple Experts**: Multiple experts can coexist and execute simultaneously
- **Independent Contexts**: Each expert has its own workspace, memory, and components
- **Parallel/Sequential Execution**: Flexible execution strategies
- **Built-in Orchestration**: ExpertOrchestrator handles task decomposition and result aggregation

---

## 3. Execution Flow Comparison

### Skills Execution Flow

```
User Request
    ↓
Agent receives request
    ↓
LLM decides which skill to activate
    ↓
SkillManager.activateSkill(skillName)
    ↓
SkillManager deactivates current skill (if any)
    ↓
SkillManager activates new skill
    ↓
Components are registered in VirtualWorkspace
    ↓
Agent executes task with active skill's tools
    ↓
Result returned to user
```

### Expert Execution Flow

```
User Request
    ↓
ExpertOrchestrator receives request
    ↓
Task decomposition (if needed)
    ↓
ExpertExecutor creates Expert instances
    ↓
┌─────────────────────────────────────────┐
│ Execution Strategy                      │
│ ┌─────────────┐ ┌─────────────┐        │
│ │ Sequential  │ │  Parallel   │        │
│ └─────────────┘ └─────────────┘        │
│ ┌─────────────┐ ┌─────────────┐        │
│ │Depend. Ord. │ │ Conditional │        │
│ └─────────────┘ └─────────────┘        │
└─────────────────────────────────────────┘
    ↓
Each Expert executes its task
    ↓
Experts produce artifacts (some shareable)
    ↓
ExpertOrchestrator aggregates results
    ↓
Final result returned to user
```

---

## 4. Orchestration Strategies

### Sequential Execution

```
Task: "Complete meta-analysis article retrieval"

┌─────────────────────────────────────────────────────────────┐
│ Expert 1: Question Decomposition                            │
│ Input: "Effect of ACE inhibitors on cardiovascular outcomes"│
│ Output: Sub-questions for each drug class                   │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Expert 2: Search Strategy Development                        │
│ Input: Sub-questions from Expert 1                          │
│ Output: PubMed search formulas for each sub-question        │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Expert 3: Article Retrieval                                 │
│ Input: Search formulas from Expert 2                        │
│ Output: Complete article lists                              │
└─────────────────────────────────────────────────────────────┘
```

### Parallel Execution

```
Task: "Analyze multiple papers"

┌─────────────────────────────────────────────────────────────┐
│ Expert 1: Analyze Paper A                                   │
│ Input: Paper A content                                      │
│ Output: Complexity score, key citations                      │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Expert 2: Analyze Paper B                                   │
│ Input: Paper B content                                      │
│ Output: Complexity score, key citations                      │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Expert 3: Analyze Paper C                                   │
│ Input: Paper C content                                      │
│ Output: Complexity score, key citations                      │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Result Aggregation                                          │
│ Combine all paper analyses into a single report             │
└─────────────────────────────────────────────────────────────┘
```

### Dependency-Ordered Execution

```
Task: "Build and test a software component"

┌─────────────────────────────────────────────────────────────┐
│ Expert 1: Code Generation (No dependencies)                │
│ Output: Source code                                         │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Expert 2: Code Review (Depends on Expert 1)                │
│ Input: Source code from Expert 1                           │
│ Output: Review feedback                                     │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Expert 3: Testing (Depends on Expert 1 & 2)                │
│ Input: Source code and review feedback                     │
│ Output: Test results                                       │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Expert 4: Documentation (Depends on Expert 1, 2, 3)       │
│ Input: Code, review, and test results                      │
│ Output: Documentation                                       │
└─────────────────────────────────────────────────────────────┘
```

### Conditional Execution

```
Task: "Process user request"

┌─────────────────────────────────────────────────────────────┐
│ Expert 1: Request Classification                            │
│ Input: User request                                         │
│ Output: Request type (query, command, error)                │
└─────────────────────────────────────────────────────────────┘
                          ↓
            ┌───────────────┼───────────────┐
            ↓               ↓               ↓
┌─────────────────────┐ ┌─────────────┐ ┌─────────────────┐
│ Expert 2a: Query    │ │ Expert 2b:   │ │ Expert 2c:      │
│ Processing          │ │ Command     │ │ Error Handling  │
│ (if type=query)     │ │ Processing  │ │ (if type=error) │
│                     │ │ (if type=   │ │                 │
│                     │ │ command)    │ │                 │
└─────────────────────┘ └─────────────┘ └─────────────────┘
```

---

## 5. Migration Phases

### Phase 1: Coexistence

```
┌─────────────────────────────────────────────────────────────┐
│                    VirtualWorkspace                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              SkillManager                            │  │
│  │  Existing skills continue to work                     │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              ExpertRegistry (NEW)                     │  │
│  │  New experts registered here                          │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              ExpertExecutor (NEW)                    │  │
│  │  Creates and manages expert instances                 │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              ExpertOrchestrator (NEW)                │  │
│  │  Orchestrates multiple experts                       │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Phase 2: Skill-to-Expert Adapter

```
┌─────────────────────────────────────────────────────────────┐
│              SkillToExpertAdapter (NEW)                     │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  convertSkillToExpert(skill: Skill): ExpertConfig   │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│                    ExpertRegistry                           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Native Experts + Converted Skills                    │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Phase 3: Expert-First

```
┌─────────────────────────────────────────────────────────────┐
│                    ExpertRegistry                           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  All functionality as Experts                        │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  SkillManager (deprecated, thin wrapper)              │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Phase 4: Complete Migration

```
┌─────────────────────────────────────────────────────────────┐
│                    ExpertRegistry                           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  All functionality as Experts                        │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. Component Lifecycle

### Skill Component Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│ Skill Activation                                             │
│  1. SkillManager.activateSkill(skillName)                   │
│  2. Deactivate current skill (if any)                        │
│     - Call onComponentDeactivate for each component         │
│     - Call component.onDeactivate()                          │
│  3. Activate new skill                                       │
│     - Call skill.onActivate()                               │
│     - Create component instances                            │
│     - Call component.onActivate()                           │
│     - Call skill.onComponentActivate(component)              │
│  4. Register components in VirtualWorkspace                  │
│  5. Register component tools in ToolManager                 │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Skill Deactivation                                           │
│  1. SkillManager.deactivateSkill()                          │
│  2. Call onComponentDeactivate for each component           │
│  3. Call component.onDeactivate()                           │
│  4. Call skill.onDeactivate()                               │
│  5. Unregister components from VirtualWorkspace             │
│  6. Unregister component tools from ToolManager            │
└─────────────────────────────────────────────────────────────┘
```

### Expert Component Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│ Expert Creation                                              │
│  1. ExpertExecutor.createExpert(expertId)                   │
│  2. Create VirtualWorkspace with expert's components       │
│  3. Create Agent with workspace                             │
│  4. Create ExpertInstance                                   │
│  5. Call expert.onActivate()                                │
│  6. Activate components                                     │
│     - Call component.onActivate()                           │
│     - Call expert.onComponentActivate(component)            │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Expert Execution                                             │
│  1. ExpertInstance.execute(task, context)                    │
│  2. Build task prompt with expert's system prompt           │
│  3. Agent.start(taskPrompt)                                 │
│  4. Agent executes task with its tools                      │
│  5. Collect artifacts                                        │
│  6. Return result                                            │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Expert Disposal                                              │
│  1. ExpertInstance.dispose()                                 │
│  2. Abort agent if running                                   │
│  3. Call onComponentDeactivate for each component           │
│  4. Call component.onDeactivate()                           │
│  5. Call expert.onDeactivate()                               │
│  6. Clear artifacts                                          │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. Data Flow

### Skills Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│ User Input                                                   │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Agent (with active skill)                                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ MemoryModule (shared conversation history)            │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ VirtualWorkspace                                      │  │
│  │  - Active Skill's Components (state)                 │  │
│  │  - Global Tools + Skill Tools                        │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Tool Execution                                               │
│  - Tool modifies component state                           │
│  - State persists in shared workspace                      │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Output                                                       │
│  - Component states                                          │
│  - Conversation history                                      │
└─────────────────────────────────────────────────────────────┘
```

### Experts Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│ User Input                                                   │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ ExpertOrchestrator                                           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Task Decomposition                                    │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Global Context (shared across experts)               │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Expert 1                                                     │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ MemoryModule (independent)                            │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ VirtualWorkspace (independent)                       │  │
│  │  - Components (independent state)                    │  │
│  │  - Tools                                             │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Expert 2                                                     │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ MemoryModule (independent)                            │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ VirtualWorkspace (independent)                       │  │
│  │  - Components (independent state)                    │  │
│  │  - Tools                                             │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Artifacts (shareable)                                        │
│  - Data artifacts                                            │
│  - Document artifacts                                       │
│  - Model output artifacts                                   │
│  - State artifacts                                          │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Result Aggregation                                           │
│  - Combine outputs from all experts                         │
│  - Merge artifacts                                           │
│  - Generate final summary                                    │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Output                                                       │
│  - Aggregated results                                       │
│  - Expert summaries                                          │
│  - Artifacts                                                 │
└─────────────────────────────────────────────────────────────┘
```
