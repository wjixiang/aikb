import { VirtualWorkspace } from 'stateful-context';

export interface TestCase {
  name: string;
  description: string;

  // Test input
  input: any;

  // Expected output
  expected: any;

  // Test type
  type: 'orchestration' | 'tool' | 'integration';

  // Tool name for tool tests
  toolName?: string;

  // Timeout (milliseconds)
  timeout?: number;

  // Setup hook
  setup?: (workspace: VirtualWorkspace) => Promise<void>;

  // Teardown hook
  teardown?: (workspace: VirtualWorkspace) => Promise<void>;

  // Custom assertion
  customAssert?: (actual: any, expected: any) => boolean | Promise<boolean>;
}

export interface TestResult {
  testCase: TestCase;
  passed: boolean;
  actual: any;
  error?: string;
  duration: number;
  timestamp: number;
}

export interface TestSuite {
  name: string;
  description: string;
  testCases: TestCase[];
  beforeAll?: () => Promise<void>;
  afterAll?: () => Promise<void>;
}
