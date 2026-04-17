import { AgentRuntime } from "../AgentRuntime";
import { ClientPool } from "llm-api-client";
import type { IPersistenceService } from "../../persistence/types.js";

const pool = ClientPool.getInstance();

const mockPersistenceService: IPersistenceService = {
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
  saveToolResultBlob: async () => ({ preview: '', originalSize: 0 }),
  getToolResultBlob: async () => null,
  deleteToolResultBlob: async () => {},
  getToolResultBlobs: async () => new Map(),
};

const runtime = new AgentRuntime({ apiClient: pool, persistenceService: mockPersistenceService })

// runtime.createAgent()