import { AgentRuntime } from "../AgentRuntime";
import { ClientPool } from "llm-api-client";
import type { IPersistenceService } from "../../persistence/types.js";

const pool = ClientPool.getInstance();

const mockPersistenceService: IPersistenceService = {
  createSession: async () => 'mock-session-id',
  getSession: async () => null,
  updateSession: async () => {},
  deleteSession: async () => {},
  listSessions: async () => [],
  getStats: async () => ({ totalSessions: 0, byStatus: {}, totalCost: 0 }),
  saveMemory: async () => {},
  loadMemory: async () => null,
  saveInstanceMetadata: async () => {},
  getInstanceMetadata: async () => null,
  updateInstanceMetadata: async () => {},
  saveComponentState: async () => {},
  getComponentState: async () => null,
  getAllComponentStates: async () => ({}),
  deleteComponentState: async () => {},
  saveExportResult: async () => {},
};

const runtime = new AgentRuntime({ apiClient: pool, persistenceService: mockPersistenceService })

// runtime.createAgent()