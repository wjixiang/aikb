/**
 * Bookshelf Workspace (v2)
 * Virtual workspace for managing and searching through bookshelf content
 *
 * Note: This workspace example requires components from componentHub.
 * Import and register them manually:
 *
 * import { BookViewerComponent, KnowledgeManageComponent } from 'componentHub';
 * import { KmsWorkspace } from 'agent-lib';
 *
 * Or extend this class to add your own components.
 */

import { VirtualWorkspace, ComponentRegistration } from '../statefulContext/index.js';

/**
 * Knowledge Management Workspace
 *
 * This workspace requires components from componentHub.
 * Users should extend this class and add their own components.
 */
export class KmsWorkspace extends VirtualWorkspace {
    constructor(components?: { bookViewer?: ComponentRegistration; knowledgeExplorer?: ComponentRegistration }) {
        super({
            id: 'bookshelf-workspace',
            name: 'Bookshelf Workspace',
            description: 'Workspace for viewing and searching through bookshelf content. Provides tools to select books, view content, and perform semantic search across book materials.'
        });

        // Register components if provided
        // Example:
        // this.registerComponent({
        //     key: 'book_viewer',
        //     component: new BookViewerComponent(),
        //     priority: 0
        // });

        if (components?.bookViewer) {
            this.registerComponent(components.bookViewer);
        }

        if (components?.knowledgeExplorer) {
            this.registerComponent(components.knowledgeExplorer);
        }
    }
}
