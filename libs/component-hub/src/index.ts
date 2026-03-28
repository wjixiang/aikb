/**
 * Component Hub
 *
 * A collection of domain-specific components for agent systems.
 */

// Lifecycle
export { LifecycleComponent } from './lifecycle/index.js';

// Lineage Control
export { LineageControlComponent } from './lineage-control/index.js';
export { lineageControlToolSchemas } from './lineage-control/index.js';
export type {
  GetMyInfoParams,
  GetStatsParams,
  DiscoverAgentsParams,
  LineageControlToolName,
  LineageControlToolReturnTypes,
  SentTaskInfo,
  IncomingTaskInfo,
  CheckInboxParams,
  AcknowledgeTaskParams,
  CompleteTaskParams,
  FailTaskParams,
  SendTaskParams,
  SendQueryParams,
  CheckSentParams,
  WaitForResultParams,
  CancelTaskParams,
} from './lineage-control/index.js';

// Bookshelf
export {
  BookViewerComponent,
  WorkspaceInfoComponent,
} from './bookshelf/index.js';

// Knowledge
export { KnowledgeManageComponent } from './knowledge/index.js';

// Bibliography Search
export { BibliographySearchComponent } from './bibliographySearch/bibliographySearchComponent.js';

export { PicosComponent } from './PICOS/picosComponents.js';

export { PrismaCheckListComponent } from './PRISMA/prismaCheckListComponent.js';
export { PrismaFlowComponent } from './PRISMA/prismaFlowComponent.js';

export { PaperAnalysisComponent } from './paperAnalysis/paperAnalysisComponent.js';

export { WebSearchComponent } from './webSearch/index.js';
export {
  ZhipuWebSearchProvider,
  type ZhipuWebSearchConfig,
  type ZhipuSearchEngine,
} from './webSearch/index.js';
export type {
  WebSearchProvider,
  WebSearchProviderConfig,
  WebSearchParams,
  WebSearchResponse,
  WebSearchResult,
  SearchIntent,
  RecencyFilter,
  ContentSize,
} from './webSearch/index.js';

export { RuntimeControlComponent } from './runtime-control/index.js';
export {
  SwarmAPIClient,
  type RESTConfig as RuntimeControlRESTConfig,
} from './runtime-control/index.js';
export {
  runtimeControlToolSchemas,
  type RuntimeControlToolName,
  type RuntimeControlToolReturnType,
  type CreateAgentParams,
  type DestroyAgentParams,
  type StopAgentParams,
  type ListAgentsParams,
  type GetAgentParams,
  type ListAgentSoulsParams,
  type CreateAgentByTypeParams,
  type RegisterInTopologyParams,
  type UnregisterFromTopologyParams,
  type ConnectAgentsParams,
  type DisconnectAgentsParams,
  type GetTopologyInfoParams,
  type GetNeighborsParams,
} from './runtime-control/schemas.js';
