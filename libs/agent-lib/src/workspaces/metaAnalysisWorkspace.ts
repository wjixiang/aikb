/**
 * Bookshelf Workspace (v2)
 * Virtual workspace for managing and searching through bookshelf content
 */

import { VirtualWorkspace, ComponentRegistration } from 'stateful-context';
import { BibliographySearchComponent } from '../components/index.js';

/**
 * Knowledge Management Workspace
 * 
 */
export class MetaAnalysisWorkspace extends VirtualWorkspace {
    constructor() {
        super({
            id: 'bibliography-workspace',
            name: 'Medical Bibliography Searching workspace',
            description: 'Workspace for viewing and searching through Pubmed'
        });

        // Register components
        this.registerComponent({
            key: 'Pubmed Search Engine',
            component: new BibliographySearchComponent(),
            priority: 0
        });
    }
}
