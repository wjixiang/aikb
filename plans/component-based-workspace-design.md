# Component-Based Workspace Architecture (React-like for LLM)

## Overview

This document outlines a component-based architecture for LLM-Workspace interaction, inspired by React's component model. Each workspace is composed of multiple components, each with its own editable status that triggers re-rendering when values change.

## Core Concepts

### 1. WorkspaceComponent

Similar to React components, each workspace component:

- Has its own state (editable status fields)
- Renders content based on its state
- Re-renders when state changes
- Can have child components
- Has lifecycle methods (mount, update, unmount)

### 2. Component State Management

```
LLM updates component state
    ↓
Component detects state change
    ↓
Component re-renders
    ↓
Workspace aggregates component renders
    ↓
Context is refreshed for LLM
```

### 3. Component Hierarchy

```
Workspace (Root)
├── BookSelector Component
│   └── editableStatus: selected_book_name
├── BookViewer Component
│   ├── editableStatus: current_page
│   └── dependsOn: BookSelector.selected_book_name
└── SearchComponent
    └── editableStatus: search_query
```

## Type Definitions

```typescript
/**
 * Component state - similar to React state
 */
interface ComponentState {
  [key: string]: string | number | boolean | null;
}

/**
 * Component props - passed from parent component
 */
interface ComponentProps {
  [key: string]: any;
}

/**
 * Component lifecycle hooks
 */
interface ComponentLifecycle {
  onMount?: () => void | Promise<void>;
  onUpdate?: (prevState: ComponentState) => void | Promise<void>;
  onUnmount?: () => void | Promise<void>;
}

/**
 * Workspace component interface
 */
interface WorkspaceComponent {
  // Component identification
  id: string;
  name: string;
  description: string;

  // Component state management
  state: ComponentState;
  editableStatus: Record<string, EditableStatus>;

  // Component rendering
  render: (props?: ComponentProps) => string;

  // Component lifecycle
  lifecycle?: ComponentLifecycle;

  // Child components
  children?: WorkspaceComponent[];

  // Component methods
  updateState: (key: string, value: any) => Promise<ComponentUpdateResult>;
  getState: () => ComponentState;
}

/**
 * Result of component state update
 */
interface ComponentUpdateResult {
  success: boolean;
  error?: string;
  componentId: string;
  updatedKey: string;
  previousValue: any;
  newValue: any;
  reRendered: boolean;
}

/**
 * Workspace component registry
 */
interface WorkspaceComponentRegistry {
  register: (component: WorkspaceComponent) => void;
  unregister: (componentId: string) => void;
  get: (componentId: string) => WorkspaceComponent | undefined;
  getAll: () => WorkspaceComponent[];
  updateComponentState: (
    componentId: string,
    key: string,
    value: any,
  ) => Promise<ComponentUpdateResult>;
}
```

## Component Lifecycle

### Mount Phase

1. Component is registered with workspace
2. `onMount()` hook is called
3. Initial state is set
4. Component renders initial content

### Update Phase

1. LLM updates component state via `updateEditableStatus()`
2. Workspace routes update to appropriate component
3. Component validates the update
4. `onUpdate()` hook is called with previous state
5. Component state is updated
6. Component re-renders
7. Workspace aggregates all component renders

### Unmount Phase

1. Component is unregistered from workspace
2. `onUnmount()` hook is called
3. Component resources are cleaned up

## Example: BookshelfWorkspace Components

### 1. BookSelector Component

```typescript
const BookSelectorComponent: WorkspaceComponent = {
  id: 'book_selector',
  name: 'BookSelector',
  description: 'Select a book from the available books',

  state: {
    selectedBook: null,
  },

  editableStatus: {
    selected_book_name: {
      value: null,
      constraint: 'must be one of the available book names',
      description: 'Select a book to browse',
      type: 'enum',
      enumValues: ['Physiology', 'Anatomy', 'Biochemistry', 'Pharmacology'],
      dependsOn: [],
      readonly: false,
    },
  },

  render: (props) => {
    const { availableBooks } = props;
    const selectedBook = BookSelectorComponent.state.selectedBook;

    return `
## Book Selector
Current selection: ${selectedBook || 'None'}

Available books:
${availableBooks.map((book) => `- ${book.bookName} (${book.pages} pages)`).join('\n')}
        `;
  },

  lifecycle: {
    onUpdate: (prevState) => {
      console.log(
        `Book changed from ${prevState.selectedBook} to ${BookSelectorComponent.state.selectedBook}`,
      );
    },
  },

  updateState: async (key, value) => {
    // Implementation
  },

  getState: () => BookSelectorComponent.state,
};
```

### 2. BookViewer Component

```typescript
const BookViewerComponent: WorkspaceComponent = {
  id: 'book_viewer',
  name: 'BookViewer',
  description: 'View and navigate through pages of the selected book',

  state: {
    currentPage: 1,
    totalPages: 0,
    content: '',
  },

  editableStatus: {
    current_page: {
      value: '1',
      constraint:
        "must be a positive integer within the current book's page range",
      description: 'Navigate to a specific page in the current book',
      type: 'number',
      dependsOn: ['book_selector.selected_book_name'],
      readonly: false,
    },
  },

  render: (props) => {
    const { currentBook } = props;
    const { currentPage, totalPages, content } = BookViewerComponent.state;

    if (!currentBook) {
      return `
## Book Viewer
No book selected. Please select a book first.
            `;
    }

    return `
## Book Viewer
Book: ${currentBook.bookName}
Page: ${currentPage} / ${totalPages}

${content}
        `;
  },

  lifecycle: {
    onMount: async () => {
      // Load initial content
    },
    onUpdate: async (prevState) => {
      // Load content for new page
    },
  },

  updateState: async (key, value) => {
    // Implementation
  },

  getState: () => BookViewerComponent.state,
};
```

### 3. SearchComponent

```typescript
const SearchComponent: WorkspaceComponent = {
  id: 'search',
  name: 'Search',
  description: 'Search for content in the books',

  state: {
    query: '',
    results: [],
  },

  editableStatus: {
    search_query: {
      value: null,
      constraint: 'must be a non-empty string',
      description: 'Search query to find content',
      type: 'string',
      dependsOn: [],
      readonly: false,
    },
  },

  render: (props) => {
    const { query, results } = SearchComponent.state;

    return `
## Search
Query: ${query || 'None'}

Results:
${results.length > 0 ? results.map((r) => `- ${r}`).join('\n') : 'No results'}
        `;
  },

  lifecycle: {
    onUpdate: async (prevState) => {
      // Perform search when query changes
    },
  },

  updateState: async (key, value) => {
    // Implementation
  },

  getState: () => SearchComponent.state,
};
```

## Workspace Integration

```typescript
export class BookshelfWorkspace implements IWorkspace {
  info = {
    name: 'BookshelfWorkspace',
    desc: 'A workspace for managing and searching through a collection of books.',
  };

  env: BookshelfWorkspaceEnvStatus = {
    availableBooks: mocked_availiable_books_data,
  };

  // Component registry
  private componentRegistry: WorkspaceComponentRegistry =
    new ComponentRegistryImpl();

  // Initialize with components
  constructor() {
    this.componentRegistry.register(BookSelectorComponent);
    this.componentRegistry.register(BookViewerComponent);
    this.componentRegistry.register(SearchComponent);
  }

  renderContext: () => string = () => {
    const components = this.componentRegistry.getAll();
    const componentRenders = components
      .map((comp) => comp.render(this.env))
      .join('\n\n');

    return `
################################
------Bookshelf Workspace-------
################################

${componentRenders}
        `;
  };

  async updateEditableStatus(
    fieldName: string,
    value: string | null,
  ): Promise<EditableStatusUpdateResult> {
    // Find component that owns this field
    const component = this.findComponentByField(fieldName);
    if (!component) {
      return {
        success: false,
        error: `Unknown editable field: ${fieldName}`,
      };
    }

    // Update component state
    const result = await this.componentRegistry.updateComponentState(
      component.id,
      fieldName,
      value,
    );

    // Update env status if needed
    await this.refreshEnvStatus();

    return result;
  }

  private findComponentByField(
    fieldName: string,
  ): WorkspaceComponent | undefined {
    const components = this.componentRegistry.getAll();
    for (const comp of components) {
      if (fieldName in comp.editableStatus) {
        return comp;
      }
    }
    return undefined;
  }
}
```

## Benefits

1. **Modular Design** - Each component is self-contained
2. **Reusability** - Components can be reused across workspaces
3. **Clear Separation** - State, rendering, and lifecycle are separated
4. **Reactive Updates** - Automatic re-rendering on state changes
5. **Composability** - Components can be nested and composed
6. **Testability** - Each component can be tested independently
7. **LLM-Friendly** - Clear component boundaries for LLM to understand

## Implementation Plan

1. Define core component interfaces and types
2. Implement component registry
3. Create base component class with lifecycle management
4. Implement BookshelfWorkspace components
5. Update workspace to use component system
6. Write tests for components and workspace
7. Update documentation

## Next Steps

1. Review and approve this design
2. Implement core component types
3. Implement component registry
4. Create example components
5. Update BookshelfWorkspace
6. Write comprehensive tests
