/**
 * Bookshelf Workspace (v2)
 * Virtual workspace for managing and searching through bookshelf content
 */

import { VirtualWorkspace, ComponentRegistration } from '../virtualWorkspace';
import { BookViewerComponent, WorkspaceInfoComponent } from '../components/bookshelfComponents';
import { KnowledgeManageComponent } from '../components/knowledgeManageComponent';

/**
 * Knowledge Management Workspace
 * 
 */
export class KmsWorkspace extends VirtualWorkspace {
    constructor() {
        super({
            id: 'bookshelf-workspace',
            name: 'Bookshelf Workspace',
            description: 'Workspace for viewing and searching through bookshelf content. Provides tools to select books, view content, and perform semantic search across book materials.'
        });

        // Register components
        this.registerComponent({
            key: 'book_viewer',
            component: new BookViewerComponent(),
            priority: 0
        });

        // this.registerComponent({
        //     key: 'workspace_info',
        //     component: new WorkspaceInfoComponent(),
        //     priority: 10
        // });

        this.registerComponent({
            key: 'knowledge_explorer',
            component: new KnowledgeManageComponent()
        })
    }
}
