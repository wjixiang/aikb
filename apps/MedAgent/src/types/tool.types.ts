export interface Tool {
  name: string;
  description: string;
  parameters: ToolParameter[];
}

export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required: boolean;
  default?: any;
  enum?: any[];
  properties?: Record<string, ToolParameter>;
  items?: ToolParameter;
}

export interface ToolExecution {
  id: string;
  toolName: string;
  parameters: Record<string, any>;
  status: 'pending' | 'executing' | 'completed' | 'error';
  result?: any;
  error?: string;
  timestamp: number;
  conversationId: string;
}

export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
}

export interface ToolExecutionParams {
  toolName: string;
  parameters: Record<string, any>;
  conversationId: string;
  toolCallId: string;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

export interface ToolResponse {
  toolCallId: string;
  result: ToolResult;
}

// Predefined tool schemas
export interface ReadFileParams {
  path: string;
}

export interface WriteFileParams {
  path: string;
  content: string;
}

export interface ExecuteCommandParams {
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
}

export interface SearchFilesParams {
  pattern: string;
  directory?: string;
  recursive?: boolean;
  maxResults?: number;
}

// Tool execution events
export interface ToolExecutionEvent {
  type: 'tool_start' | 'tool_progress' | 'tool_complete' | 'tool_error';
  toolCallId: string;
  toolName: string;
  timestamp: number;
  data?: any;
  error?: string;
}

// Tool registry
export interface ToolRegistry {
  registerTool: (tool: Tool) => void;
  unregisterTool: (name: string) => void;
  getTool: (name: string) => Tool | undefined;
  getAllTools: () => Tool[];
  hasTool: (name: string) => boolean;
}

// Tool execution context
export interface ToolExecutionContext {
  conversationId: string;
  userId?: string;
  sessionId?: string;
  permissions: string[];
  workingDirectory?: string;
  environment: Record<string, string>;
}
