/**
 * Bookshelf Workspace (v2)
 * Virtual workspace for managing and searching through bookshelf content
 */

import { VirtualWorkspace } from '../statefulContext/index.js';
import { BibliographySearchComponent, PicosComponent } from '../components/index.js';

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

        this.registerComponent({
            key: 'PICO Templater',
            component: new PicosComponent()
        })

        // Register components
        this.registerComponent({
            key: 'Pubmed Search Engine',
            component: new BibliographySearchComponent(),
            priority: 1
        });
    }
}
