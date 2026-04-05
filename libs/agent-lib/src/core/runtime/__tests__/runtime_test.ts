import { AgentRuntime } from "../AgentRuntime";
import { ClientPool } from "llm-api-client";

const pool = ClientPool.getInstance();
const runtime = new AgentRuntime({ clientPool: pool })

// runtime.createAgent()