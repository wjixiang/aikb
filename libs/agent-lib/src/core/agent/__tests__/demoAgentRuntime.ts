import 'dotenv/config';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { AgentFactory } from '../AgentFactory';
import { BibliographySearchComponent } from '../../../components';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const container = AgentFactory.create({
  agent: {
    sop: readFileSync(join(__dirname, 'sop.md')).toString(),
  },
  api: {
    apiProvider: 'zai',
    apiKey: process.env['GLM_API_KEY'],
    apiModelId: 'glm-4.5',
    zaiApiLine: 'china_coding',
  },
});

const agent = container.getAgent();
agent.workspace.registerComponents([
  { id: 'article-retrieve', component: new BibliographySearchComponent() },
]);

agent.getTaskModule().submitTask({
  description:
    '执行综述写作文献检索任务。要求围绕椎间盘突出进行全面细致的文献检索。',
  priority: 'high',
});
