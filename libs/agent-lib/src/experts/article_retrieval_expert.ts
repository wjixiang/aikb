import { AgentFactory } from "../agent/AgentFactory.js";
import { ObservableAgentFactory } from "../agent/ObservableAgent.js";
import { OpenaiCompatibleApiClient, OpenAICompatibleConfig } from "../api-client/OpenaiCompatibleApiClient.js";
import { MetaAnalysisWorkspace } from "../workspaces/metaAnalysisWorkspace.js";

const articleRetrievalExpertCapability = `

You are a specialized Article Retrieval Expert with advanced expertise in searching, identifying, and retrieving relevant medical literature from PubMed and other biomedical databases. Your primary responsibility is to conduct systematic and comprehensive literature searches to support evidence-based medicine research, meta-analyses, and clinical investigations.

### Core Competencies

#### 1. Literature Search Strategy Development
- **PICO Framework Application**: Transform clinical questions into structured searches using Population, Intervention, Comparison, and Outcome (PICO) elements
- **MeSH Term Utilization**: Effectively use Medical Subject Headings (MeSH) for precise and comprehensive searches
- **Boolean Logic Mastery**: Construct complex search queries using AND, OR, and NOT operators to optimize result relevance
- **Field-Specific Searching**: Leverage field constraints (e.g., [Title], [Abstract], [Author], [Journal]) for targeted searches
- **Query Refinement**: Iteratively refine search strategies based on initial results to balance sensitivity and specificity

#### 2. PubMed Database Navigation
- **Advanced Search Techniques**: Utilize PubMed's search syntax and filters effectively
- **Publication Type Filtering**: Restrict searches to specific article types (meta-analyses, randomized controlled trials, systematic reviews, etc.)
- **Date Range Optimization**: Apply appropriate date filters for current evidence or historical perspectives
- **Sorting and Prioritization**: Sort results by relevance, publication date, or other criteria to identify most relevant articles
- **Result Pagination**: Efficiently navigate through large result sets to find comprehensive coverage

#### 3. Article Selection and Evaluation
- **Title and Abstract Screening**: Rapidly assess article relevance through title and abstract review
- **Study Design Recognition**: Identify study methodologies (RCT, cohort, case-control, etc.) from citations
- **Publication Quality Assessment**: Evaluate journal impact factors, peer review status, and publication credibility
- **Relevance Determination**: Select articles that directly address the research question or clinical scenario
- **Duplicate Detection**: Identify and manage duplicate publications or redundant studies

#### 4. Citation Management
- **PMID Tracking**: Accurately record and manage PubMed Identifiers for selected articles
- **Citation Details Extraction**: Extract complete bibliographic information (authors, journal, year, volume, pages)
- **Abstract Retrieval**: Obtain full abstracts for detailed relevance assessment
- **Full Text Access**: Identify available full-text sources and access options
- **Reference Export**: Compile selected citations for further analysis or documentation

`;

const direction = `

When given a research question or clinical scenario:

1. **Question Analysis**: Break down the research question into key concepts using PICO framework
2. **Search Strategy Construction**: Build a comprehensive search strategy using:
   - MeSH terms for key concepts
   - Text words for synonyms and related terms
   - Boolean operators to combine concepts
   - Field tags for targeted searching
3. **Initial Search**: Execute the search and evaluate result quantity and relevance
4. **Strategy Refinement**: If results are too broad or narrow, adjust:
   - Add or remove concepts
   - Use more specific or general MeSH terms
   - Apply additional filters (publication type, date range)
   - Modify Boolean operators
5. **Result Screening**: Review titles and abstracts to identify relevant articles
6. **Article Selection**: Select articles that meet inclusion criteria
7. **Detailed Review**: View full article details for selected citations
8. **Completion**: Compile final list of relevant articles with complete citation information

### Best Practices

- **Comprehensiveness**: Aim for thorough coverage while maintaining relevance
- **Documentation**: Keep track of search strategies and results for reproducibility
- **Transparency**: Clearly report search terms, filters, and results
- **Quality Over Quantity**: Prioritize high-quality, relevant studies over maximizing citation counts
- **Systematic Approach**: Follow systematic review principles for structured, unbiased searching
- **MeSH Optimization**: Use MeSH database to find the most appropriate indexing terms
- **Search Limits**: Apply appropriate limits to focus on the most relevant evidence

### Example Search Strategies

**Clinical Question**: "In adult patients with type 2 diabetes, do SGLT2 inhibitors reduce cardiovascular events?"

**Search Strategy Components**:
- Population: "type 2 diabetes mellitus" OR "diabetes mellitus, type 2"[MeSH]
- Intervention: "SGLT2 inhibitors" OR "sodium-glucose transporter 2 inhibitors"[MeSH Terms]
- Outcomes: "cardiovascular diseases"[MeSH] OR "heart failure"[MeSH] OR "major adverse cardiovascular events"
- Study Design: Filter for randomized controlled trials, meta-analyses, systematic reviews

**Constructed Query**:
\`\`\`
("type 2 diabetes mellitus" OR "diabetes mellitus, type 2"[MeSH])
AND ("SGLT2 inhibitors" OR "sodium-glucose transporter 2 inhibitors"[MeSH])
AND ("cardiovascular diseases"[MeSH] OR "heart failure"[MeSH] OR "major adverse cardiovascular events")
\`\`\`

### Task Completion

Your task is complete when you have:
1. Identified and retrieved all relevant articles addressing the research question
2. Applied appropriate search strategies and filters to optimize results
3. Screened results to select the most relevant studies
4. Compiled a comprehensive list of selected articles with complete citation details
5. Provided sufficient information for the next stage of analysis or review

Use the <attempt_completion> function when you have successfully retrieved and documented all relevant articles for the given research question.
`

const config: OpenAICompatibleConfig = {
    apiKey: process.env['GLM_API_KEY'] as string,
    model: "glm-4.5",
    baseURL: "https://open.bigmodel.cn/api/coding/paas/v4"
}

// Create base agent using AgentFactory
const baseArticleRetrievalExpert = AgentFactory.create(
    new MetaAnalysisWorkspace(),
    {
        capability: articleRetrievalExpertCapability,
        direction: direction
    },
    {
        apiClient: new OpenaiCompatibleApiClient(config)
    }
);

// Wrap with ObservableAgentFactory for observation capabilities
export const ArticleRetrievalExpert = new ObservableAgentFactory()
    .onStatusChanged((taskId, status) => {
        console.log(`[ArticleRetrievalExpert] Task ${taskId} status changed to: ${status}`);
    })
    .onMessageAdded((taskId, message) => {
        // ANSI color codes for beautiful console output
        const colors = {
            reset: '\x1b[0m',
            bright: '\x1b[1m',
            dim: '\x1b[2m',
            underscore: '\x1b[4m',
            blink: '\x1b[5m',

            // Foreground colors
            black: '\x1b[30m',
            red: '\x1b[31m',
            green: '\x1b[32m',
            yellow: '\x1b[33m',
            blue: '\x1b[34m',
            magenta: '\x1b[35m',
            cyan: '\x1b[36m',
            white: '\x1b[37m',

            // Background colors
            bgBlack: '\x1b[40m',
            bgRed: '\x1b[41m',
            bgGreen: '\x1b[42m',
            bgYellow: '\x1b[43m',
            bgBlue: '\x1b[44m',
            bgMagenta: '\x1b[45m',
            bgCyan: '\x1b[46m',
            bgWhite: '\x1b[47m',
        };

        const roleColors = {
            'user': colors.cyan,
            'assistant': colors.green,
            'system': colors.yellow,
        };

        const roleColor = roleColors[message.role as keyof typeof roleColors] || colors.white;
        const timestamp = message.ts ? new Date(message.ts).toISOString() : new Date().toISOString();

        // Header
        console.log(`\n${colors.bright}${colors.blue}╔════════════════════════════════════════════════════════════════╗${colors.reset}`);
        console.log(`${colors.bright}${colors.blue}║${colors.reset} ${colors.bright}${colors.magenta}ArticleRetrievalExpert${colors.reset} - ${colors.bright}${colors.white}Message Added${colors.reset} ${colors.blue}║${colors.reset}`);
        console.log(`${colors.bright}${colors.blue}╠════════════════════════════════════════════════════════════════╣${colors.reset}`);

        // Task ID
        console.log(`${colors.blue}║${colors.reset} ${colors.cyan}Task ID:${colors.reset}    ${colors.bright}${colors.white}${taskId}${colors.reset}`);

        // Role
        console.log(`${colors.blue}║${colors.reset} ${colors.cyan}Role:${colors.reset}       ${roleColor}${colors.bright}${message.role}${colors.reset}`);

        // Timestamp
        console.log(`${colors.blue}║${colors.reset} ${colors.cyan}Timestamp:${colors.reset}   ${colors.dim}${colors.white}${timestamp}${colors.reset}`);

        // Content
        console.log(`${colors.blue}║${colors.reset} ${colors.cyan}Content:${colors.reset}`);
        console.log(`${colors.blue}║${colors.reset} ${colors.dim}────────────────────────────────────────────────────────────${colors.reset}`);

        const content = message.content;
        if (typeof content === 'string') {
            // String content - display with proper formatting
            const lines = content.split('\n');
            for (const line of lines) {
                console.log(`${colors.blue}║${colors.reset} ${colors.white}${line}${colors.reset}`);
            }
        } else if (Array.isArray(content)) {
            // Array content - display each block
            for (const block of content) {
                if (typeof block === 'string') {
                    console.log(`${colors.blue}║${colors.reset} ${colors.white}${block}${colors.reset}`);
                } else if ('type' in block) {
                    const blockType = block.type;
                    if (blockType === 'thinking') {
                        console.log(`${colors.blue}║${colors.reset} ${colors.yellow}[THINKING]${colors.reset} ${colors.dim}${(block as any).thinking}${colors.reset}`);
                    } else if (blockType === 'text') {
                        console.log(`${colors.blue}║${colors.reset} ${colors.white}${(block as any).text}${colors.reset}`);
                    } else if (blockType === 'tool_use') {
                        console.log(`${colors.blue}║${colors.reset} ${colors.magenta}[TOOL]${colors.reset} ${colors.bright}${colors.white}${(block as any).name}${colors.reset}`);
                        if ((block as any).input) {
                            console.log(`${colors.blue}║${colors.reset}   ${colors.dim}${JSON.stringify((block as any).input, null, 2).split('\n').join('\n' + ' '.repeat(3))}${colors.reset}`);
                        }
                    } else if (blockType === 'tool_result') {
                        console.log(`${colors.blue}║${colors.reset} ${colors.green}[RESULT]${colors.reset} ${colors.cyan}${(block as any).tool_use_id}${colors.reset}`);
                        const result = (block as any).content || (block as any).result;
                        if (typeof result === 'string') {
                            console.log(`${colors.blue}║${colors.reset}   ${colors.white}${result}${colors.reset}`);
                        } else if (Array.isArray(result)) {
                            for (const item of result) {
                                if (typeof item === 'string') {
                                    console.log(`${colors.blue}║${colors.reset}   ${colors.white}${item}${colors.reset}`);
                                } else if (item && 'type' in item && item.type === 'image') {
                                    console.log(`${colors.blue}║${colors.reset}   ${colors.dim}[IMAGE: ${(item as any).source?.type || 'unknown'}]${colors.reset}`);
                                }
                            }
                        }
                    } else {
                        console.log(`${colors.blue}║${colors.reset} ${colors.dim}[${blockType}]${colors.reset} ${colors.white}${JSON.stringify(block)}${colors.reset}`);
                    }
                } else {
                    console.log(`${colors.blue}║${colors.reset} ${colors.white}${JSON.stringify(block)}${colors.reset}`);
                }
            }
        } else {
            console.log(`${colors.blue}║${colors.reset} ${colors.dim}${JSON.stringify(content, null, 2).split('\n').join('\n' + ' '.repeat(3))}${colors.reset}`);
        }

        // Footer
        console.log(`${colors.bright}${colors.blue}╚════════════════════════════════════════════════════════════════╝${colors.reset}\n`);
    })
    .onTaskCompleted((taskId) => {
        console.log(`[ArticleRetrievalExpert] Task ${taskId} completed successfully`);
    })
    .onTaskAborted((taskId, reason) => {
        console.error(`[ArticleRetrievalExpert] Task ${taskId} aborted: ${reason}`);
    })
    .onError((error, context) => {
        console.error(`[ArticleRetrievalExpert] Error in ${context}:`, error);
    })
    .create(baseArticleRetrievalExpert);