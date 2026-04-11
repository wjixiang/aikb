import type { ToolCall } from 'llm-api-client';
import type { AgentBlueprint } from 'agent-lib/core';

// ============================================================
// Test Case Definitions
// ============================================================

export interface MockToolCallDef {
  name: string;
  arguments?: Record<string, unknown>;
}

export interface MockResponseDef {
  toolCalls?: MockToolCallDef[];
  textResponse?: string;
}

export interface TestCaseExpectation {
  toolCalls?: Array<{
    name: string;
    arguments?: Record<string, unknown>;
  }>;
  textContains?: string;
  status?: 'completed' | 'aborted' | 'error';
  maxRounds?: number;
}

export interface TestCase {
  name: string;
  prompt: string;
  mock?: MockResponseDef;
  expect: TestCaseExpectation;
}

export interface TestSuite {
  name: string;
  agent: {
    soul?: string;
    sop?: string;
    name?: string;
    type?: string;
    description?: string;
    components?: unknown[];
  };
  cases: TestCase[];
}

// ============================================================
// Run/Result Types
// ============================================================

export type ArenaMode = 'mock' | 'live';

export interface ToolCallRecord {
  name: string;
  arguments: Record<string, unknown>;
  success: boolean;
  result: unknown;
  timestamp: number;
  turnId: string;
  toolUseId?: string;
}

export interface AgentRunResult {
  success: boolean;
  status: string;
  duration: number;
  messages: Array<{ role: string; content: string }>;
  toolCalls: ToolCallRecord[];
  llmCalls: number;
  tokenUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  error?: string;
}

export interface TestCaseResult {
  testCase: TestCase;
  passed: boolean;
  result: AgentRunResult;
  failures: string[];
  duration: number;
}

export interface TestSuiteResult {
  suiteName: string;
  agentToken: string;
  total: number;
  passed: number;
  failed: number;
  duration: number;
  results: TestCaseResult[];
}
