/**
 * Meta-Analysis Workspace (v3)
 *
 * Simplified workspace that relies on skills for dynamic component registration.
 * Components are automatically registered when a skill with components is activated.
 *
 * This workspace no longer manually registers components. Instead, it provides
 * a clean foundation for skills to dynamically add their components.
 */

import { VirtualWorkspace } from '../statefulContext/virtualWorkspace.js';
import { ToolManager } from '../tools/ToolManager.js';
import { ComponentRegistry } from '../../components/ComponentRegistry.js';
import { GlobalToolProvider } from '../tools/providers/GlobalToolProvider.js';

/**
 * Meta-Analysis Workspace
 *
 * A workspace designed for meta-analysis and systematic review workflows.
 * Components are dynamically registered through skills, eliminating the need
 * for manual component registration in the workspace constructor.
 */
export class MetaAnalysisWorkspace extends VirtualWorkspace {
  constructor() {
    const toolManager = new ToolManager();
    const componentRegistry = new ComponentRegistry();
    const globalToolProvider = new GlobalToolProvider();

    super(toolManager, componentRegistry, globalToolProvider, {
      id: 'meta-analysis-workspace',
      name: 'Meta-Analysis Workspace',
      description:
        'Workspace for conducting systematic reviews and meta-analyses. Components are dynamically registered through skills.',
    });
  }
}
