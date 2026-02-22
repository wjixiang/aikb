/**
 * Bookshelf Workspace (v2)
 * Virtual workspace for managing and searching through bookshelf content
 */

import { VirtualWorkspace } from '../statefulContext/index.js';
import { BibliographySearchComponent, PicosComponent, PrismaCheckListComponent, PrismaFlowComponent } from '../components/index.js';

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

        this.registerComponent({
            key: 'Prisma Check List',
            component: new PrismaCheckListComponent()
        })

        this.registerComponent({
            key: 'Prisma Workflow',
            component: new PrismaFlowComponent()
        })

        this.registerComponent({
            key: 'Pubmed Search Engine',
            component: new BibliographySearchComponent(),
        });
    }
}
