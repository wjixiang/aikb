# Comprehensive Chunking Strategy Enum Guide

## Overview

This guide introduces the new comprehensive chunking strategy enum system that unifies all chunking strategies and methods in the codebase. The new system provides better organization, extensibility, and backward compatibility.

## Key Components

### 1. New Enum Types

#### ChunkingStrategy Enum
The main enum that defines all chunking strategies:

```typescript
export enum ChunkingStrategy {
  // Current implemented strategies
  H1 = 'h1',
  PARAGRAPH = 'paragraph',
  
  // Referenced but not yet implemented
  SEMANTIC = 'semantic',
  MIXED = 'mixed',
  CUSTOM = 'custom',
  
  // Future strategies (planned)
  SENTENCE = 'sentence',
  RECURSIVE = 'recursive',
  FIXED_SIZE = 'fixed_size',
  TOKEN_BASED = 'token_based',
  MARKDOWN_SECTION = 'markdown_section',
  HTML_TAG = 'html_tag',
  CODE_BLOCK = 'code_block',
  
  // Special strategies
  AUTO = 'auto',  // Automatic strategy selection
  LEGACY = 'legacy',  // For backward compatibility
}
```

#### ChunkingStrategyCategory Enum
Organizes strategies by their approach:

```typescript
export enum ChunkingStrategyCategory {
  STRUCTURE_BASED = 'structure_based',  // H1, markdown_section, html_tag
  CONTENT_BASED = 'content_based',      // paragraph, sentence, semantic
  SIZE_BASED = 'size_based',            // fixed_size, token_based, recursive
  HYBRID = 'hybrid',                    // mixed, custom
  SYSTEM = 'system'                     // auto, legacy
}
```

### 2. Strategy Registry

The `CHUNKING_STRATEGY_REGISTRY` contains metadata for all strategies:

```typescript
export const CHUNKING_STRATEGY_REGISTRY: Record<string, ChunkingStrategyMetadata> = {
  [ChunkingStrategy.H1]: {
    name: ChunkingStrategy.H1,
    category: ChunkingStrategyCategory.STRUCTURE_BASED,
    displayName: 'H1 Headers',
    description: 'Splits markdown text based on H1 headers',
    version: '1.0.0',
    isImplemented: true,
    requiresTitle: true,
    defaultConfig: { maxChunkSize: 1000, minChunkSize: 100, overlap: 50 },
    fallbackStrategies: [ChunkingStrategy.PARAGRAPH],
  },
  // ... other strategies
};
```

### 3. Utility Classes

#### ChunkingStrategyUtils
Provides utility functions for working with strategies:

```typescript
// Get strategies by category
const structureStrategies = ChunkingStrategyUtils.getStrategiesByCategory(
  ChunkingStrategyCategory.STRUCTURE_BASED
);

// Get implemented strategies only
const availableStrategies = ChunkingStrategyUtils.getImplementedStrategies();

// Get fallback strategies
const fallbacks = ChunkingStrategyUtils.getFallbackStrategies(ChunkingStrategy.SEMANTIC);

// Check if strategy requires titles
const needsTitle = ChunkingStrategyUtils.requiresTitle(ChunkingStrategy.H1);

// Get default config
const config = ChunkingStrategyUtils.getDefaultConfig(ChunkingStrategy.PARAGRAPH);
```

#### ChunkingStrategyCompatibility
Handles conversion between old and new enum systems:

```typescript
// Convert legacy enum to new enum
const newStrategy = ChunkingStrategyCompatibility.fromLegacy(
  ChunkingStrategyType.H1
);

// Convert new enum to legacy enum (returns null if no equivalent)
const legacyStrategy = ChunkingStrategyCompatibility.toLegacy(
  ChunkingStrategy.H1
);

// Convert string to appropriate enum
const strategy = ChunkingStrategyCompatibility.fromString('h1');
```

## Migration Guide

### Phase 1: Immediate (No Breaking Changes)

Continue using existing code with no changes:

```typescript
// Old code continues to work
import { h1Chunking, paragraphChunking } from './chunkingTool';

const chunks = h1Chunking(markdownText);
```

### Phase 2: Gradual Migration

Start using new functions with enhanced features:

```typescript
// Use enhanced function that supports both old and new enums
import { chunkTextEnhanced, ChunkingStrategy } from './chunkingTool';

// Use new enum
const chunks = chunkTextEnhanced(text, ChunkingStrategy.H1);

// Or use string (automatically converted)
const chunks = chunkTextEnhanced(text, 'h1');

// Or let it auto-select
const chunks = chunkTextEnhanced(text);
```

### Phase 3: Full Migration

Use the new enum-based API:

```typescript
import { 
  chunkTextWithEnum, 
  getAvailableStrategyEnums,
  ChunkingStrategy 
} from './chunkingTool';

// Get available strategies
const strategies = getAvailableStrategyEnums();

// Use specific strategy
const chunks = chunkTextWithEnum(text, ChunkingStrategy.H1);

// Use auto-selection
const chunks = chunkTextWithEnum(text); // Automatically selects best strategy

// Use fallback strategy
const chunks = chunkTextWithFallback(text, ChunkingStrategy.SEMANTIC);
```

## New Features

### 1. Strategy Categories

Organize and filter strategies by category:

```typescript
import { getStrategiesByCategory, ChunkingStrategyCategory } from './chunkingTool';

// Get all structure-based strategies
const structureStrategies = getStrategiesByCategory(
  ChunkingStrategyCategory.STRUCTURE_BASED
);
```

### 2. Fallback Strategies

Automatically use alternative strategies if the preferred one fails:

```typescript
import { chunkTextWithFallback, ChunkingStrategy } from './chunkingTool';

// Try semantic strategy, fall back to H1 or paragraph if not available
const chunks = chunkTextWithFallback(text, ChunkingStrategy.SEMANTIC);
```

### 3. Strategy Metadata

Access detailed information about strategies:

```typescript
import { getStrategyMetadata, ChunkingStrategy } from './chunkingTool';

const metadata = getStrategyMetadata(ChunkingStrategy.H1);
console.log(metadata.description);
console.log(metadata.defaultConfig);
```

### 4. Enhanced Auto-Selection

Improved automatic strategy selection based on content:

```typescript
import { autoSelectStrategyEnum } from './chunkingTool';

const bestStrategy = autoSelectStrategyEnum(text);
```

## Backward Compatibility

### Legacy Enum Support

The old `ChunkingStrategyType` enum is preserved with deprecation warnings:

```typescript
// Still works but shows deprecation warning
import { ChunkingStrategyType } from './chunkingStrategy';

// Automatically converted to new system
const chunks = chunkTextEnhanced(text, ChunkingStrategyType.H1);
```

### Adapter Pattern

Use the adapter class for seamless migration:

```typescript
import { ChunkingAdapter } from './chunkingTool';

// Adapter handles conversion automatically
const chunks = ChunkingAdapter.chunkText(text, ChunkingStrategyType.H1);
```

## Implementation Status

| Strategy | Status | Description |
|----------|--------|-------------|
| H1 | ✅ Implemented | Splits markdown by H1 headers |
| PARAGRAPH | ✅ Implemented | Splits text by paragraphs |
| SEMANTIC | 📋 Planned | Uses semantic similarity |
| MIXED | 📋 Planned | Combines multiple strategies |
| CUSTOM | ✅ Implemented | User-defined strategies |
| SENTENCE | 📋 Planned | Splits by sentences |
| RECURSIVE | 📋 Planned | Recursive splitting |
| FIXED_SIZE | 📋 Planned | Fixed-size chunks |
| TOKEN_BASED | 📋 Planned | Token-based splitting |
| MARKDOWN_SECTION | 📋 Planned | Any markdown header level |
| HTML_TAG | 📋 Planned | HTML tag-based splitting |
| CODE_BLOCK | 📋 Planned | Code documentation |
| AUTO | ✅ Implemented | Automatic selection |
| LEGACY | ✅ Implemented | Backward compatibility |

## Best Practices

### 1. Use New Enum for New Code

```typescript
// Good - Use new enum
const chunks = chunkTextWithEnum(text, ChunkingStrategy.H1);

// Avoid - Old enum (for new code)
const chunks = chunkText(text, ChunkingStrategyType.H1);
```

### 2. Leverage Auto-Selection

```typescript
// Good - Let the system choose the best strategy
const chunks = chunkTextWithEnum(text);

// Consider - Specify preferred strategy with fallback
const chunks = chunkTextWithFallback(text, ChunkingStrategy.SEMANTIC);
```

### 3. Use Strategy Categories

```typescript
// Good - Filter by category when appropriate
const contentStrategies = getStrategiesByCategory(
  ChunkingStrategyCategory.CONTENT_BASED
);
```

### 4. Check Implementation Status

```typescript
// Good - Check if strategy is implemented before using
if (isStrategyImplemented(ChunkingStrategy.SEMANTIC)) {
  const chunks = chunkTextWithEnum(text, ChunkingStrategy.SEMANTIC);
} else {
  const chunks = chunkTextWithEnum(text, ChunkingStrategy.H1);
}
```

## Testing

Run the test file to verify the implementation:

```bash
cd lib/chunking && npx tsx test-new-enum.ts
```

## Future Roadmap

1. **Implement Planned Strategies**: Add implementations for semantic, mixed, sentence, etc.
2. **Performance Optimization**: Optimize strategy selection and execution
3. **Configuration Presets**: Add predefined configurations for different use cases
4. **Strategy Composition**: Allow combining multiple strategies
5. **ML-Based Selection**: Use machine learning for automatic strategy selection
6. **Parallel Processing**: Support for parallel chunking with multiple strategies

## Troubleshooting

### Common Issues

1. **Type Errors**: Ensure you're importing the correct enum types
2. **Strategy Not Found**: Check if the strategy is implemented
3. **Configuration Errors**: Validate configuration before using

### Getting Help

- Check the test file for usage examples
- Review the strategy registry for available options
- Use the utility functions for debugging

## Conclusion

The new comprehensive enum system provides a robust foundation for chunking strategies while maintaining full backward compatibility. The gradual migration approach allows teams to adopt new features at their own pace.