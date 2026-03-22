/**
 * Bookshelf Workspace (v2)
 * Virtual workspace for managing and searching through bookshelf content
 *
 * Note: This workspace example requires components from agent-lib.
 * Import and register them manually:
 *
 * import { BookViewerComponent, KnowledgeManageComponent } from 'agent-lib';
 * import { KmsWorkspace } from 'agent-lib';
 *
 * Or extend this class to add your own components.
 */

import {
  VirtualWorkspace,
  type DIComponentRegistration,
} from '../statefulContext/virtualWorkspace.js';
import { ToolManager } from '../tools/ToolManager.js';
import { ComponentRegistry } from '../../components/ComponentRegistry.js';
import { GlobalToolProvider } from '../tools/providers/GlobalToolProvider.js';

/**
 * Knowledge Management Workspace
 *
 * This workspace requires components from agent-lib.
 * Users should extend this class and add their own components.
 */
export class KmsWorkspace extends VirtualWorkspace {
  constructor(components?: DIComponentRegistration[]) {
    const toolManager = new ToolManager();
    const componentRegistry = new ComponentRegistry();
    const globalToolProvider = new GlobalToolProvider();

    super(
      toolManager,
      componentRegistry,
      globalToolProvider,
      {
        id: 'bookshelf-workspace',
        name: 'Bookshelf Workspace',
        description:
          'Workspace for viewing and searching through bookshelf content. Provides tools to select books, view content, and perform semantic search across book materials.',
      },
      components,
    );
  }
}
