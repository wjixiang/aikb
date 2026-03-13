/**
 * Meta-Analysis Article Retrieval Expert
 * 
 * 使用简化架构的Expert入口文件
 * 自动加载config.json和sop.yaml
 */

import { createExpertConfig } from '../../ExpertFactory.js';
import { MetaAnalysisArticleRetrievalWorkspace } from './Workspace.js';

/**
 * 导出Expert配置
 * 
 * 工厂函数会自动：
 * 1. 加载config.json
 * 2. 加载sop.yaml
 * 3. 构建prompt（capability + direction）
 * 4. 从Workspace获取输入/输出处理器
 */
export default createExpertConfig(import.meta.url, MetaAnalysisArticleRetrievalWorkspace);

// 同时导出Workspace类，供需要直接使用的场景
export { MetaAnalysisArticleRetrievalWorkspace };
