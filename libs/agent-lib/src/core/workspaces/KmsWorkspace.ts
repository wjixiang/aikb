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

import { VirtualWorkspace, type DIComponentRegistration } from '../statefulContext/virtualWorkspace.js';

/**
 * Knowledge Management Workspace
 *
 * This workspace requires components from agent-lib.
 * Users should extend this class and add their own components.
 */
export class KmsWorkspace extends VirtualWorkspace {
    constructor(components?: DIComponentRegistration[]) {
        super({
            id: 'bookshelf-workspace',
            name: 'Bookshelf Workspace',
            description: 'Workspace for viewing and searching through bookshelf content. Provides tools to select books, view content, and perform semantic search across book materials.',
            // Components are passed via config, which gets registered in constructor
        });

        // Note: Components should be passed via DI container (AgentContainer.components)
        // or through config.components in the constructor
        // This constructor signature is kept for backward compatibility
        if (components && components.length > 0) {
            for (const { id, component, priority } of components) {
                this.componentRegistry.register(id, component, priority);
                this._registerToolProvider(id, component);
            }
        }
    }
}
