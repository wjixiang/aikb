# Knowledge Creation Module

This module provides functionality to create knowledge hierarchies from natural language text, establishing "实体→知识→实体" (Entity → Knowledge → Entity) relationships.

## Overview

The Knowledge Creation module consists of three main components:

1. **EntityExtractor** - Extracts entities and relationships from natural language text
2. **KnowledgeCreationWorkflow** - Orchestrates the creation of knowledge hierarchies
3. **Entity Extensions** - Extended Entity class methods for creating subordinate knowledge

## Components

### EntityExtractor

The `EntityExtractor` class provides methods to analyze natural language text and extract entities, relationships, and text structure.

```typescript
import { EntityExtractor } from './knowledgeCreation/EntityExtractor';

const extractor = new EntityExtractor();

// Extract main entity from text
const mainEntity = await extractor.extractMainEntity(text);

// Extract related entities
const relatedEntities = await extractor.extractRelatedEntities(text, mainEntityName);

// Extract relationships between entities
const relationships = await extractor.extractRelationships(text, entities);

// Analyze text structure
const sections = await extractor.analyzeTextStructure(text);
```

### KnowledgeCreationWorkflow

The `KnowledgeCreationWorkflow` class orchestrates the creation of knowledge hierarchies from natural language text.

```typescript
import { KnowledgeCreationWorkflow } from './knowledgeCreation/KnowledgeCreationWorkflow';

const workflow = new KnowledgeCreationWorkflow(knowledgeStorage);

// Create a knowledge hierarchy from text
const knowledgeHierarchy = await workflow.create_knowledge_hierarchy_from_text(
  text,
  parentEntity,
);

// Create simple knowledge from text
const simpleKnowledge = await workflow.create_simple_knowledge_from_text(
  text,
  parentEntity,
  scope,
);

// Update existing knowledge with new text
const updatedKnowledge = await workflow.update_knowledge_with_text(
  knowledge,
  newText,
);
```

### Entity Extensions

The `Entity` class has been extended with methods to create and retrieve subordinate knowledge.

```typescript
import Entity from './Entity';

// Create subordinate knowledge from natural language text
const knowledge = await entity.create_subordinate_knowledge_from_text(
  naturalLanguageText,
  knowledgeStorage,
);

// Get all subordinate knowledge for this entity
const subordinateKnowledge = await entity.get_subordinate_knowledge(
  knowledgeStorage,
);
```

## Usage Examples

### Basic Example

```typescript
import Entity from './Entity';
import { MongodbKnowledgeContentStorage } from './storage/mongodb-knowledge-content-storage';
import { MongodbKnowledgeVectorStorage } from './storage/mongodb-knowledge-vector-storage';
import { MongoKnowledgeGraphStorage } from './storage/mongodb-knowledge-graph-storage';
import KnowledgeStorage from './storage/knowledgeStorage';
import { MongodbEntityContentStorage } from './storage/mongodb-entity-content-storage';
import { MongoEntityGraphStorage } from './storage/mongodb-entity-graph-storage';
import { ElasticsearchVectorStorage } from './storage/elasticsearch-entity-vector-storage';
import EntityStorage from './storage/entityStorage';

// Initialize storage
const knowledgeContentStorage = new MongodbKnowledgeContentStorage();
const knowledgeVectorStorage = new MongodbKnowledgeVectorStorage();
const knowledgeGraphStorage = new MongoKnowledgeGraphStorage();

const entityContentStorage = new MongodbEntityContentStorage();
const entityGraphStorage = new MongoEntityGraphStorage();
const entityVectorStorage = new ElasticsearchVectorStorage();

const knowledgeStorage = new KnowledgeStorage(
  knowledgeContentStorage,
  knowledgeGraphStorage,
  knowledgeVectorStorage,
);

const entityStorage = new EntityStorage(
  entityContentStorage,
  entityGraphStorage,
  entityVectorStorage,
);

// Create an entity
const entity = await Entity.create_entity_with_entity_data({
  name: ['Machine Learning'],
  tags: ['AI', 'Computer Science'],
  definition: 'Machine learning is a subset of artificial intelligence...',
}).save(entityStorage);

// Create knowledge from natural language text
const text = `
Machine Learning Overview:
Machine learning is a subset of artificial intelligence that enables systems to learn from data.

Supervised Learning:
Supervised learning uses labeled training data to make predictions.

Unsupervised Learning:
Unsupervised learning finds hidden patterns in unlabeled data.
`;

const knowledge = await entity.create_subordinate_knowledge_from_text(
  text,
  knowledgeStorage,
);

// Render knowledge as markdown
const markdown = knowledge.render_to_markdown_string();
console.log(markdown);
```

### Advanced Example with Multiple Entities

```typescript
// Create multiple related entities
const computerScienceEntity = await Entity.create_entity_with_entity_data({
  name: ['Computer Science'],
  tags: ['Technology', 'Science'],
  definition: 'The study of computation, information, and automation.',
}).save(entityStorage);

const aiEntity = await Entity.create_entity_with_entity_data({
  name: ['Artificial Intelligence'],
  tags: ['Computer Science', 'Technology'],
  definition: 'The simulation of human intelligence in machines.',
}).save(entityStorage);

// Create entity relationships
await entityGraphStorage.create_relation(
  computerScienceEntity.get_id(),
  aiEntity.get_id(),
  'includes',
  { strength: 0.9 }
);

// Create knowledge for each entity
const csKnowledge = await computerScienceEntity.create_subordinate_knowledge_from_text(
  csText,
  knowledgeStorage,
);

const aiKnowledge = await aiEntity.create_subordinate_knowledge_from_text(
  aiText,
  knowledgeStorage,
);

// Create cross-entity knowledge relationships
await knowledgeGraphStorage.create_new_link(
  csKnowledge.get_id(),
  aiKnowledge.get_id(),
);
```

## Testing

The module includes comprehensive tests to verify functionality:

1. **Unit Tests** - Located in `__tests__/entity-knowledge-creation.test.ts`
2. **Integration Tests** - Located in `../examples/entity-knowledge-creation-example.ts`
3. **Test Runner** - Simple test runner in `test-runner.ts`

### Running Tests

```bash
# Run Vitest tests
npx vitest run knowledgeBase/knowledgeCreation/__tests__/

# Run the simple test runner
npx tsx knowledgeBase/knowledgeCreation/test-runner.ts

# Run the example
npx tsx knowledgeBase/examples/entity-knowledge-creation-example.ts
```

## Architecture

The Knowledge Creation module follows a layered architecture:

```
┌─────────────────────────────────────────────────────────┐
│                    Entity Layer                         │
│  ┌─────────────────┐    ┌─────────────────────────────┐ │
│  │   Entity Class  │    │  Entity Extensions          │ │
│  │                 │    │  - create_subordinate_knowledge │ │
│  │                 │    │  - get_subordinate_knowledge   │ │
│  └─────────────────┘    └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│                 Workflow Layer                          │
│  ┌─────────────────────────────────────────────────────┐ │
│  │        KnowledgeCreationWorkflow                    │ │
│  │                                                     │ │
│  │  - create_knowledge_hierarchy_from_text             │ │
│  │  - create_simple_knowledge_from_text                │ │
│  │  - update_knowledge_with_text                       │ │
│  └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│                Extraction Layer                         │
│  ┌─────────────────┐    ┌─────────────────────────────┐ │
│  │  EntityExtractor │    │      BAML Client             │ │
│  │                 │    │                             │ │
│  │  - extractMainEntity │    │  - ExtractMainEntity      │ │
│  │  - extractRelatedEntities │  │  - ExtractScopes         │ │
│  │  - extractRelationships │  │                          │ │
│  │  - analyzeTextStructure │  │                          │ │
│  └─────────────────┘    └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│                  Storage Layer                           │
│  ┌─────────────────┐    ┌─────────────────────────────┐ │
│  │  Knowledge      │    │      Entity                  │ │
│  │  Storage        │    │      Storage                 │ │
│  │                 │    │                             │ │
│  │  - Content      │    │  - Content                  │ │
│  │  - Graph        │    │  - Graph                    │ │
│  │  - Vector       │    │  - Vector                   │ │
│  └─────────────────┘    └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

## Error Handling

The module includes comprehensive error handling:

1. **Input Validation** - Validates input parameters and provides meaningful error messages
2. **Storage Errors** - Handles storage-related errors gracefully
3. **AI Service Errors** - Handles errors from BAML client operations
4. **Fallback Mechanisms** - Provides fallback behavior when AI services are unavailable

## Performance Considerations

1. **Caching** - Consider implementing caching for frequently accessed entities and knowledge
2. **Batch Operations** - Use batch operations for creating multiple knowledge items
3. **Async Processing** - All operations are asynchronous to avoid blocking
4. **Resource Management** - Properly manages database connections and resources

## Future Enhancements

1. **Advanced NLP** - Integrate more sophisticated NLP techniques
2. **Knowledge Graph Visualization** - Add visualization capabilities for knowledge graphs
3. **Real-time Updates** - Support real-time knowledge updates
4. **Multi-language Support** - Extend support for multiple languages
5. **Knowledge Validation** - Add validation mechanisms for created knowledge