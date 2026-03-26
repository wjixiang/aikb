/**
 * Agent Components Library
 *
 * Domain-specific components for agent systems.
 *
 * Includes:
 * - BibliographySearch: PubMed literature search
 * - PICOS: PICO framework extraction for evidence-based medicine
 * - PRISMA: PRISMA checklist and flow diagram
 * - PaperAnalysis: Scientific paper analysis
 * - FileSystem: Markdown file management
 */

export { BibliographySearchComponent } from './bibliographySearch/bibliographySearchComponent.js';

export { PicosComponent } from './PICOS/picosComponents.js';

export { PrismaCheckListComponent } from './PRISMA/prismaCheckListComponent.js';
export { PrismaFlowComponent } from './PRISMA/prismaFlowComponent.js';

export { PaperAnalysisComponent } from './paperAnalysis/paperAnalysisComponent.js';

export {
  MarkdownComponent,
  createMarkdownComponent,
  type MarkdownComponentConfig,
  type MarkdownComponentState,
  type MarkdownHooks,
  type MarkdownToolName,
} from './fileSystem/markdown/index.js';
