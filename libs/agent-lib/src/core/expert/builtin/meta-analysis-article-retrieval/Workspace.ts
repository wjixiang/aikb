/**
 * Meta-Analysis Article Retrieval Workspace Module
 *
 * 职责：
 * 1. 导入和注册 BibliographySearchComponent
 */

import { ExpertWorkspaceBase, type ComponentDefinition } from '../../ExpertWorkspaceBase.js';
import { BibliographySearchComponent } from '../../../../components/index.js';

/**
 * MetaAnalysisArticleRetrievalWorkspace
 *
 * 专门用于Meta-Analysis文献检索的工作空间
 */
export class MetaAnalysisArticleRetrievalWorkspace extends ExpertWorkspaceBase {

    // ==================== 组件定义 ====================

    /**
     * 获取带ID的组件列表
     * 使用 BibliographySearchComponent 进行 PubMed 检索
     * 使用 getComponentsWithIds 以保留组件ID（bibliography-search）
     */
    static override getComponentsWithIds(): ComponentDefinition[] {
        return [
            {
                id: 'bibliography-search',
                component: new BibliographySearchComponent(),
            },
        ];
    }
}
