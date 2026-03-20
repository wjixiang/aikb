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
        apiProvider: 'openai',
        openAiBaseUrl: 'https://ark.cn-beijing.volces.com/api/coding/v3',
        apiKey: '5be76e94-fa7f-4827-8cc7-296a84b79ef1',
        apiModelId: 'glm-4.7',
        zaiApiLine: 'china_coding',
    },
});

const agent = container.getAgent();
agent.workspace.registerComponents([
    { id: 'article-retrieve', component: new BibliographySearchComponent() },
]);

agent.getTaskModule().submitTask({
    description: '执行综述写作文献检索任务。要求围绕椎间盘突出进行全面细致的文献检索。',
    priority: 'high',
});
