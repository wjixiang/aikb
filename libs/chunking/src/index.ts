// Main exports for the chunking package

// Core strategy and types
export {
  ChunkingStrategyType,
  ChunkingStrategy,
  ChunkingStrategyCategory,
  type ChunkingStrategyMetadata,
  type BaseChunkResult,
  type TitledChunkResult,
  type IChunkingStrategy,
  BaseChunkingStrategy,
  CHUNKING_STRATEGY_REGISTRY,
  ChunkingStrategyUtils,
  ChunkingStrategyCompatibility,
  defaultChunkingConfig,
  type ChunkingConfig,
  type ChunkResult as BaseChunkResultType,
} from './chunking-strategy.js';

// Manager
export { ChunkingManager, chunkingManager } from './chunking-manager.js';

// Main tool functions - re-export with aliases to avoid conflicts
export {
  h1Chunking,
  paragraphChunking,
  chunkText,
  chunkTextEnhanced,
  chunkTextAdvanced,
  chunkTextWithEnum,
  chunkTextWithFallback,
  getAvailableStrategies,
  getAvailableStrategyEnums,
  getStrategiesByCategory,
  autoSelectStrategy,
  autoSelectStrategyEnum,
  canStrategyHandle,
  canStrategyEnumHandle,
  getStrategyDefaultConfig,
  getStrategyEnumDefaultConfig,
  validateStrategyConfig,
  validateStrategyEnumConfig,
  getStrategiesForText,
  getStrategyEnumsForText,
  getStrategyMetadata,
  isStrategyImplemented,
  getFallbackStrategies,
  requiresTitle,
  ChunkingAdapter,
  chunkTextLegacy,
  type ChunkingConfig as ToolChunkingConfig,
  type ChunkResult as ToolChunkResult,
  type BaseChunkingStrategy as ToolBaseChunkingStrategy,
  type TitledChunkResult as ToolTitledChunkResult,
  type IChunkingStrategy as ToolIChunkingStrategy,
} from './chunking-tool.js';

// Search utilities
export {
  ChunkSearchUtils,
  type ItemChunk,
  type ChunkSearchFilter,
} from './chunk-search-utils.js';

// Strategy implementations
export {
  H1ChunkingStrategy,
  ParagraphChunkingStrategy,
} from './strategies/index.js';
