# Expert Template Folders Analysis

## Overview

The `libs/agent-lib` module contains **two template folders** for Expert development. This analysis examines whether they are duplicated and provides merge recommendations.

## Template Folders Identified

### 1. `_templates/` - Hygen Templates

**Location:** `libs/agent-lib/_templates/`

**Structure:**
```
_templates/
├── expert/new/              # Expert generation templates
│   ├── config.json.ejs      # Config template
│   ├── expert.ts.ejs        # Expert factory (OLD pattern)
│   ├── exportHandler.ts.ejs # Export handler template
│   ├── input.ts.ejs         # Input handler template
│   └── sop.yaml.ejs         # SOP template
├── generator/               # Hygen meta-templates
│   ├── help/index.ejs.t
│   ├── new/hello.ejs.t
│   └── with-prompt/*.ejs.t
└── init/repo/               # Init templates
    └── new-repo.ejs.t
```

**Purpose:** Designed for use with [hygen](https://github.com/jondot/hygen) code generator

**Usage:** `npx hygen expert new --name my-expert`

### 2. `src/expert/templates/` - Reference Template

**Location:** `libs/agent-lib/src/expert/templates/my-expert/`

**Structure:**
```
src/expert/templates/my-expert/
├── config.json    # Expert configuration
├── index.ts       # Expert factory (NEW pattern)
├── sop.yaml       # Standard Operating Procedure
└── Workspace.ts   # Workspace with input/output handlers
```

**Purpose:** Reference implementation demonstrating the simplified 4-file architecture

**Usage:** Used by `expert-cli create` command

## Key Differences

| Aspect | `_templates/expert/new/` | `src/expert/templates/my-expert/` |
|--------|--------------------------|-----------------------------------|
| **Generator** | hygen (EJS templates) | Programmatic (create.ts) |
| **Architecture** | OLD pattern (5+ files) | NEW pattern (4 files) |
| **Expert Factory** | Manual loading in `expert.ts` | Uses `createExpertConfig()` |
| **Handlers** | Separate files | Integrated in `Workspace.ts` |
| **Active Use** | ❌ Likely unused | ✅ Active (CLI uses this pattern) |

## Architecture Comparison

### OLD Pattern (hygen templates)
```
my-expert/
├── config.json       # Configuration
├── sop.yaml          # SOP definition
├── expert.ts         # Manual factory with loadMetadata(), loadSOP()
├── exportHandler.ts  # Separate export handler
└── input.ts          # Separate input handler
```

### NEW Pattern (reference template)
```
my-expert/
├── config.json       # Configuration
├── sop.yaml          # SOP definition
├── index.ts          # Simple factory using createExpertConfig()
└── Workspace.ts      # Combined handlers in one class
```

## Current CLI Implementation

The [`create.ts`](../libs/agent-lib/src/expert/cli/create.ts) CLI command **does NOT use hygen**:

```typescript
// create.ts generates templates programmatically
function generateConfigJson(config: ExpertTemplateConfig): string { ... }
function generateSopYaml(config: ExpertTemplateConfig): string { ... }
function generateWorkspaceTs(config: ExpertTemplateConfig, isExternal: boolean): string { ... }
function generateIndexTs(config: ExpertTemplateConfig, isExternal: boolean): string { ... }
```

This confirms that `_templates/expert/new/` is **not being used** by the current CLI.

## Duplication Analysis

### Confirmed Duplications

1. **config.json template** - Both folders have config.json templates
2. **sop.yaml template** - Both folders have SOP templates
3. **Expert factory** - Both generate expert factory code

### Key Issue

The `_templates/expert/new/` folder contains **outdated templates** that:
- Use the old architecture pattern
- Are not integrated with the current CLI
- Generate more files than necessary (5 vs 4)

## Recommendations

### Option A: Remove Legacy Hygen Templates (Recommended)

**Actions:**
1. Delete `_templates/expert/new/` folder entirely
2. Delete `_templates/generator/` folder (hygen boilerplate)
3. Delete `_templates/init/` folder (if unused)
4. Keep `src/expert/templates/my-expert/` as reference

**Benefits:**
- Eliminates confusion about which templates to use
- Removes outdated code patterns
- Simplifies project structure
- Single source of truth for Expert templates

**Risk:** Low - hygen templates appear unused

### Option B: Update Hygen Templates

**Actions:**
1. Update `_templates/expert/new/` to use new architecture
2. Remove separate handler templates
3. Add Workspace.ts.ejs template
4. Update expert.ts.ejs to use `createExpertConfig()`

**Benefits:**
- Maintains hygen compatibility for those who prefer it
- Provides alternative generation method

**Drawbacks:**
- Maintains two template systems
- More maintenance overhead

### Option C: Full Merge

**Actions:**
1. Convert `src/expert/templates/my-expert/` into hygen templates
2. Replace programmatic generation in create.ts with hygen
3. Add hygen as a dependency

**Benefits:**
- Leverages hygen's template engine
- Easier template customization

**Drawbacks:**
- Adds external dependency
- More complex setup
- Current programmatic approach works well

## Recommended Approach: Option A

Remove the legacy hygen templates and keep only the reference template at `src/expert/templates/my-expert/`.

### Implementation Steps

1. **Delete unused template folders:**
   ```bash
   rm -rf libs/agent-lib/_templates/expert/
   rm -rf libs/agent-lib/_templates/generator/
   rm -rf libs/agent-lib/_templates/init/
   rmdir libs/agent-lib/_templates/  # if empty
   ```

2. **Update documentation** to clarify template usage:
   - Reference `src/expert/templates/my-expert/` as the example
   - Document `expert-cli create <name>` as the creation method

3. **Verify no references** to `_templates/` in codebase

## Files to Remove

```
libs/agent-lib/_templates/
├── expert/new/
│   ├── config.json.ejs      ❌ Remove
│   ├── expert.ts.ejs        ❌ Remove
│   ├── expert.sop.md.ejs    ❌ Remove
│   ├── exportHandler.ts.ejs ❌ Remove
│   ├── input.ts.ejs         ❌ Remove
│   └── sop.yaml.ejs         ❌ Remove
├── generator/               ❌ Remove entirely
└── init/                    ❌ Remove entirely
```

## Files to Keep

```
libs/agent-lib/src/expert/templates/my-expert/
├── config.json    ✅ Keep (reference)
├── index.ts       ✅ Keep (reference)
├── sop.yaml       ✅ Keep (reference)
└── Workspace.ts   ✅ Keep (reference)
```

## Summary

| Folder | Status | Action |
|--------|--------|--------|
| `_templates/expert/new/` | Legacy/Unused | **Remove** |
| `_templates/generator/` | Hygen boilerplate | **Remove** |
| `_templates/init/` | Unused | **Remove** |
| `src/expert/templates/my-expert/` | Active reference | **Keep** |

The analysis confirms **duplication exists** and the `_templates/` folder contains **outdated templates** that should be removed in favor of the current reference implementation.
