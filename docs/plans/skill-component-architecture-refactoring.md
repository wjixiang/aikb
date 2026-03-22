# Skill-Component Architecture Refactoring Plan

## Executive Summary

This document outlines a comprehensive refactoring plan to restructure the `libs/agent-lib` module's architecture. The key change is making `ToolComponent` a component of `Skill`, enabling skills to control multiple components directly and manage their tools.

## Current Architecture Analysis

### Current Structure

```
VirtualWorkspace
├── ToolComponent[] (independent components)
├── SkillManager
│   └── Skill[] (with tools[] array)
└── ToolManager
    ├── GlobalToolProvider
    └── ComponentToolProvider[] (wraps ToolComponents)
```

### Key Characteristics

1. **VirtualWorkspace** manages both `ToolComponent` instances and `SkillManager` independently
2. **ToolComponent** is a standalone abstract class with its own `toolSet`
3. **Skill** has a `tools[]` array but these are separate from component tools
4. **ToolManager** uses providers to manage tools from different sources
5. **ComponentToolProvider** wraps `ToolComponent` to expose its tools to the system

### Current Limitations

1. **No Direct Skill-Component Relationship**: Skills and components are managed separately in VirtualWorkspace
2. **Indirect Tool Control**: Skills can only control tools defined in their `tools[]` array, not component tools
3. **Tight Coupling**: ComponentToolProvider creates a wrapper layer between components and tools
4. **Limited Flexibility**: Components cannot be dynamically associated with skills
5. **State Management Complexity**: Tool state is managed at multiple levels (component, provider, manager)

## Proposed Architecture

### Design Goals

1. **Skill as Container**: Skills become containers for one or more ToolComponents
2. **Direct Component Control**: Skills directly manage their components' lifecycle and tool availability
3. **Simplified Tool Flow**: Remove intermediate provider layers for skill components
4. **Backward Compatibility**: Existing code continues to work during transition
5. **Type Safety**: Strong typing for skill-component relationships

### New Architecture

```
VirtualWorkspace
├── SkillManager
│   └── Skill[]
│       ├── components: ToolComponent[] (NEW)
│       ├── tools: Tool[] (existing)
│       └── onActivate/onDeactivate (existing)
└── ToolManager
    ├── GlobalToolProvider
    └── SkillToolProvider (NEW - replaces ComponentToolProvider for skills)
```

### Key Changes

#### 1. Skill Interface Extension

```typescript
export interface Skill {
  // Existing fields
  name: string;
  displayName: string;
  description: string;
  whenToUse?: string;
  triggers?: string[];
  prompt: {
    capability: string;
    direction: string;
  };
  tools?: Tool[];
  onActivate?: () => Promise<void>;
  onDeactivate?: () => Promise<void>;

  // NEW: Components managed by this skill
  components?: ToolComponent[];

  // NEW: Component lifecycle hooks
  onComponentActivate?: (component: ToolComponent) => Promise<void>;
  onComponentDeactivate?: (component: ToolComponent) => Promise<void>;
}
```

#### 2. ToolComponent Enhancement

```typescript
export abstract class ToolComponent {
  // Existing
  abstract toolSet: Map<string, Tool>;
  abstract renderImply: () => Promise<TUIElement[]>;
  abstract handleToolCall: (toolName: string, params: any) => Promise<void>;

  // NEW: Component metadata
  readonly componentId: string;
  readonly displayName: string;
  readonly description: string;

  // NEW: Component lifecycle hooks
  onActivate?: () => Promise<void>;
  onDeactivate?: () => Promise<void>;

  // NEW: Get component state for serialization
  getState(): any;
  setState(state: any): void;
}
```

#### 3. New SkillToolProvider

```typescript
export class SkillToolProvider implements IToolProvider {
  readonly id: string;
  readonly priority = 60; // Between global (100) and component (50)

  private skill: Skill;
  private componentProviders: Map<string, ComponentToolProvider>;

  constructor(skill: Skill) {
    this.id = `skill:${skill.name}`;
    this.skill = skill;
    this.componentProviders = new Map();
    this.initializeComponentProviders();
  }

  private initializeComponentProviders(): void {
    if (!this.skill.components) return;

    for (const component of this.skill.components) {
      const provider = new ComponentToolProvider(
        `${this.skill.name}:${component.componentId}`,
        component,
      );
      this.componentProviders.set(component.componentId, provider);
    }
  }

  getTools(): Tool[] {
    // Combine skill tools and component tools
    const skillTools = this.skill.tools ?? [];
    const componentTools = Array.from(this.componentProviders.values()).flatMap(
      (provider) => provider.getTools(),
    );
    return [...skillTools, ...componentTools];
  }

  async executeTool(name: string, params: any): Promise<any> {
    // Try component tools first
    for (const provider of this.componentProviders.values()) {
      if (provider.hasTool(name)) {
        return await provider.executeTool(name, params);
      }
    }

    // Fall back to skill tools
    // (handled by SkillToolProvider's own tool registry)
  }
}
```

#### 4. SkillManager Enhancements

```typescript
export class SkillManager {
  // Existing fields
  private registry = new Map<string, Skill>();
  private activeSkill: Skill | null = null;
  private onSkillChange?: (skill: Skill | null) => void;

  // NEW: Track active components
  private activeComponents: Map<string, ToolComponent> = new Map();

  // Existing methods...

  // NEW: Get active components
  getActiveComponents(): ToolComponent[] {
    return Array.from(this.activeComponents.values());
  }

  // NEW: Get component by ID from active skill
  getComponent(componentId: string): ToolComponent | undefined {
    if (!this.activeSkill?.components) return undefined;
    return this.activeSkill.components.find(
      (c) => c.componentId === componentId,
    );
  }

  // NEW: Enhanced activation with component lifecycle
  async activateSkill(skillName: string): Promise<SkillActivationResult> {
    const skill = this.registry.get(skillName);
    if (!skill) {
      return { success: false, message: `Skill "${skillName}" not found` };
    }

    // Deactivate current skill and its components
    if (this.activeSkill) {
      await this.deactivateSkill();
    }

    // Activate new skill
    this.activeSkill = skill;

    // Activate skill's components
    if (skill.components) {
      for (const component of skill.components) {
        this.activeComponents.set(component.componentId, component);
        await skill.onComponentActivate?.(component);
        await component.onActivate?.();
      }
    }

    // Call skill's onActivate
    await skill.onActivate?.();

    // Notify listeners
    this.onSkillChange?.(skill);

    return {
      success: true,
      message: `Skill "${skill.displayName}" activated`,
      skill,
    };
  }

  // NEW: Enhanced deactivation with component lifecycle
  async deactivateSkill(): Promise<{ success: boolean; message: string }> {
    if (!this.activeSkill) {
      return { success: true, message: 'No skill is currently active' };
    }

    const skill = this.activeSkill;

    // Deactivate components
    for (const component of this.activeComponents.values()) {
      await component.onDeactivate?.();
      await skill.onComponentDeactivate?.(component);
    }
    this.activeComponents.clear();

    // Call skill's onDeactivate
    await skill.onDeactivate?.();

    this.activeSkill = null;
    this.onSkillChange?.(null);

    return {
      success: true,
      message: `Skill "${skill.displayName}" deactivated`,
    };
  }
}
```

#### 5. VirtualWorkspace Simplification

```typescript
@injectable()
export class VirtualWorkspace implements IVirtualWorkspace {
  private config: VirtualWorkspaceConfig;
  private skillManager: SkillManager;
  private toolManager: IToolManager;
  private globalToolProvider: GlobalToolProvider;

  constructor(
    @inject(TYPES.VirtualWorkspaceConfig)
    @optional()
    config: Partial<VirtualWorkspaceConfig> = {},
    @inject(TYPES.IToolManager) @optional() toolManager?: IToolManager,
  ) {
    this.config = {
      id: 'default-workspace',
      name: 'Default Workspace',
      ...config,
    };
    this.toolManager = toolManager ?? new ToolManager();
    this.skillManager = new SkillManager({
      onSkillChange: (skill) => this.handleSkillChange(skill),
    });

    // Global tools provider
    this.globalToolProvider = new GlobalToolProvider(this.skillManager);
    this.toolManager.registerProvider(this.globalToolProvider);

    this.initializeSkills();
  }

  /**
   * Handle skill change - manage skill tool provider
   */
  private handleSkillChange(skill: Skill | null): void {
    // Remove previous skill provider
    const previousProviderId = this.skillManager.getPreviousSkill()?.name;
    if (previousProviderId) {
      this.toolManager.unregisterProvider(`skill:${previousProviderId}`);
    }

    // Add new skill provider
    if (skill) {
      const skillProvider = new SkillToolProvider(skill);
      this.toolManager.registerProvider(skillProvider);
    }

    // Notify tool availability change
    this.onToolAvailabilityChange?.();
  }

  // ... rest of existing methods ...
}
```

## Implementation Plan

### Phase 1: Type System Extensions

**Files to modify:**

- `src/skills/types.ts`

**Tasks:**

1. Extend `Skill` interface with `components` field
2. Add `onComponentActivate` and `onComponentDeactivate` hooks
3. Create `ComponentDefinition` interface for component metadata
4. Update `SkillActivationResult` to include component information

### Phase 2: ToolComponent Enhancement

**Files to modify:**

- `src/statefulContext/toolComponent.ts`

**Tasks:**

1. Add `componentId`, `displayName`, `description` fields
2. Add `onActivate` and `onDeactivate` lifecycle hooks
3. Add `getState()` and `setState()` methods for state management
4. Update abstract class documentation

### Phase 3: SkillToolProvider Implementation

**Files to create:**

- `src/tools/providers/SkillToolProvider.ts`

**Tasks:**

1. Implement `IToolProvider` interface
2. Manage component providers internally
3. Combine skill tools and component tools in `getTools()`
4. Route tool execution to appropriate component or skill handler
5. Handle component lifecycle events

### Phase 4: SkillManager Enhancements

**Files to modify:**

- `src/skills/SkillManager.ts`

**Tasks:**

1. Add `activeComponents` map
2. Implement `getActiveComponents()` method
3. Implement `getComponent()` method
4. Enhance `activateSkill()` to activate components
5. Enhance `deactivateSkill()` to deactivate components
6. Add `getPreviousSkill()` helper method
7. Update type definitions

### Phase 5: VirtualWorkspace Simplification

**Files to modify:**

- `src/statefulContext/virtualWorkspace.ts`

**Tasks:**

1. Remove direct component management (move to skills)
2. Simplify `handleSkillChange()` to use SkillToolProvider
3. Update component registration to be skill-scoped
4. Remove `components` map from VirtualWorkspace
5. Update rendering to show skill components

### Phase 6: SkillDefinition Builder Update

**Files to modify:**

- `src/skills/SkillDefinition.ts`

**Tasks:**

1. Add `components` parameter to `defineSkill()`
2. Add component lifecycle hook parameters
3. Update builder pattern to support components
4. Add validation for component definitions

### Phase 7: Migration of Existing Components

**Files to modify:**

- `src/statefulContext/__tests__/testComponents.ts`
- Any custom component implementations

**Tasks:**

1. Update test components to include metadata
2. Add lifecycle hooks to components
3. Create example skills that use components
4. Update component tests

### Phase 8: Documentation Updates

**Files to create/modify:**

- `src/skills/README.md` (update)
- `docs/skill-component-architecture.md` (new)
- `COMPONENT_MIGRATION.md` (new)

**Tasks:**

1. Document new skill-component relationship
2. Provide migration guide for existing components
3. Add examples of skill-defined components
4. Update architecture diagrams

### Phase 9: Testing

**Files to create:**

- `src/skills/__tests__/SkillComponentIntegration.test.ts`
- `src/tools/providers/__tests__/SkillToolProvider.test.ts`
- `src/statefulContext/__tests__/component-lifecycle.test.ts`

**Tasks:**

1. Test skill activation with components
2. Test component lifecycle hooks
3. Test tool execution through skill provider
4. Test component state management
5. Test backward compatibility

### Phase 10: Backward Compatibility Layer

**Files to create:**

- `src/compat/ComponentAdapter.ts`
- `src/compat/LegacySkillAdapter.ts`

**Tasks:**

1. Create adapter for standalone components
2. Create adapter for skills without components
3. Ensure existing code continues to work
4. Add deprecation warnings

## Migration Strategy

### Option A: Gradual Migration (Recommended)

1. **Phase 1**: Implement new architecture alongside existing
2. **Phase 2**: Add compatibility adapters
3. **Phase 3**: Migrate one skill at a time
4. **Phase 4**: Deprecate old patterns
5. **Phase 5**: Remove old code

### Option B: Big Bang Migration

1. **Phase 1**: Implement new architecture
2. **Phase 2**: Update all existing code
3. **Phase 3**: Remove old architecture

### Recommended: Option A

Gradual migration allows:

- Testing at each step
- Rollback capability
- Parallel development
- Smaller, safer changes

## Usage Examples

### Defining a Skill with Components

```typescript
import { defineSkill } from '../skills/SkillDefinition.js';
import { ToolComponent } from '../statefulContext/toolComponent.js';

// Define a custom component
class PaperAnalysisComponent extends ToolComponent {
  readonly componentId = 'paper-analyzer';
  readonly displayName = 'Paper Analyzer';
  readonly description = 'Analyzes academic papers';

  toolSet = new Map([
    [
      'analyze_paper',
      {
        toolName: 'analyze_paper',
        desc: 'Analyze paper content',
        paramsSchema: z.object({
          content: z.string(),
        }),
      },
    ],
  ]);

  private analysisResults: any[] = [];

  renderImply = async () => {
    return [
      new tdiv({
        content: `Analysis Results: ${this.analysisResults.length}`,
        styles: { showBorder: false },
      }),
    ];
  };

  handleToolCall = async (toolName: string, params: any) => {
    if (toolName === 'analyze_paper') {
      const result = await this.analyze(params.content);
      this.analysisResults.push(result);
      return result;
    }
  };

  onActivate = async () => {
    console.log('[PaperAnalysisComponent] Activated');
  };

  onDeactivate = async () => {
    console.log('[PaperAnalysisComponent] Deactivated');
  };

  getState() {
    return { analysisResults: this.analysisResults };
  }

  setState(state: any) {
    this.analysisResults = state.analysisResults || [];
  }

  private async analyze(content: string): Promise<any> {
    // Analysis logic...
  }
}

// Define skill with component
export default defineSkill({
  name: 'paper-analysis',
  displayName: 'Paper Analysis',
  description: 'Advanced paper analysis with multiple components',

  capabilities: ['Analyze papers', 'Extract citations', 'Compare papers'],
  workDirection: 'Use the paper analyzer component for analysis...',

  // Skill-level tools
  tools: [createTool('search_papers', 'Search for papers', searchSchema)],

  // Components managed by this skill
  components: [new PaperAnalysisComponent()],

  // Component lifecycle hooks
  onComponentActivate: async (component) => {
    console.log(`Component ${component.componentId} activated`);
  },

  onComponentDeactivate: async (component) => {
    console.log(`Component ${component.componentId} deactivated`);
  },

  onActivate: async () => {
    console.log('[PaperAnalysis] Skill activated');
  },

  onDeactivate: async () => {
    console.log('[PaperAnalysis] Skill deactivated');
  },
});
```

### Using Skills with Components

```typescript
// Create workspace
const workspace = new VirtualWorkspace();

// Activate skill (components are activated automatically)
await workspace.skillManager.activateSkill('paper-analysis');

// Get active components
const components = workspace.skillManager.getActiveComponents();
// [PaperAnalysisComponent]

// Access specific component
const analyzer = workspace.skillManager.getComponent('paper-analyzer');
// PaperAnalysisComponent instance

// Execute tool (routed through skill provider)
const result = await workspace.handleToolCall('analyze_paper', {
  content: 'paper text...',
});

// Deactivate skill (components are deactivated automatically)
await workspace.skillManager.deactivateSkill();
```

### Backward Compatible Usage

```typescript
// Old way still works during migration
const workspace = new VirtualWorkspace();
const component = new TestToolComponentA();

// Register component directly (wrapped in adapter)
workspace.registerComponent('test-a', component);

// Use as before
await workspace.handleToolCall('search', { query: 'test' });
```

## Benefits

### Architecture Benefits

1. **Clear Ownership**: Skills own their components explicitly
2. **Simplified Flow**: Tool execution flows directly through skill providers
3. **Better State Management**: Component state is scoped to skill lifecycle
4. **Type Safety**: Strong typing for skill-component relationships
5. **Testability**: Skills and components can be tested independently

### Developer Benefits

1. **Easier Composition**: Skills can compose multiple components
2. **Better Organization**: Related functionality grouped in skills
3. **Lifecycle Control**: Components have clear activation/deactivation hooks
4. **State Persistence**: Components can save/restore state
5. **Flexibility**: Components can be reused across skills

### User Benefits

1. **Clearer Model**: Skills as containers is intuitive
2. **Better Context**: LLM sees skill-organized tools
3. **Predictable Behavior**: Components activate/deactivate with skills
4. **Easier Debugging**: Clear component ownership

## Risks and Mitigations

### Risk 1: Breaking Changes

**Mitigation:**

- Implement compatibility adapters
- Gradual migration path
- Extensive testing
- Clear deprecation warnings

### Risk 2: Performance Impact

**Mitigation:**

- Benchmark before/after
- Optimize provider lookup
- Cache component instances
- Lazy initialization

### Risk 3: Complexity Increase

**Mitigation:**

- Clear documentation
- Code examples
- Migration guide
- Developer tools

## Success Criteria

1. ✅ Skills can define and manage multiple components
2. ✅ Components activate/deactivate with skill lifecycle
3. ✅ Tool execution flows through skill providers
4. ✅ Backward compatibility maintained
5. ✅ All tests pass
6. ✅ Documentation complete
7. ✅ Migration guide available

## Timeline Estimate

- **Phase 1-2**: 2-3 days (Type system and ToolComponent)
- **Phase 3-4**: 3-4 days (Providers and SkillManager)
- **Phase 5-6**: 2-3 days (VirtualWorkspace and SkillDefinition)
- **Phase 7**: 2-3 days (Migration)
- **Phase 8**: 1-2 days (Documentation)
- **Phase 9**: 3-4 days (Testing)
- **Phase 10**: 2-3 days (Compatibility)

**Total: 15-22 days**

## Next Steps

1. Review this plan with stakeholders
2. Approve or refine architecture
3. Begin Phase 1 implementation
4. Iterate based on feedback

## Related Documents

- [Skill-Based Tool Control Architecture](./skill-based-tool-control-architecture.md)
- [Skill System Refactoring Summary](../docs/skill-system-refactoring-summary.md)
- [Tool Management Refactoring](./tool-management-refactoring.md)
