export interface ToolParameter {
  name: string;
  type: string;
  description: string;
  required: boolean;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: ToolParameter[];
  required_parameters: string[];
}

export interface ToolCall {
  tool_name: string;
  parameters: Record<string, any>;
  id: string;
}

export interface ToolResult {
  tool_id: string;
  result: string;
  success: boolean;
  error_message?: string;
}

export interface AgentDecision {
  should_use_tool: boolean;
  selected_tool?: string;
  reasoning: string;
  confidence: number;
}

export interface StepResponse {
  is_final_step: boolean;
  response: string;
  tool?: ToolCall;
  reasoning: string;
}
