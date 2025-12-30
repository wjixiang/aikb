import OpenAI from "openai"
import { McpTool, McpToolCallResponse } from "../shared/mcp"

export type ToolArgs = {
    toolOptions?: any
    settings?: Record<string, any>
    // 新增：MCP特定参数
    mcpServerName?: string
    alwaysAllow?: boolean
    enabledForPrompt?: boolean
}

// 新增：MCP工具响应类型
export type ToolResponse =
    | string
    | McpToolCallResponse
    | {
        type: 'text' | 'image' | 'audio' | 'resource'
        content: any
        isError?: boolean
    }

export interface Tool {
    // 保留原有desc结构，但增强兼容性
    desc: {
        native: OpenAI.Chat.ChatCompletionTool;
        xml: (args: ToolArgs) => string | undefined;
        // 新增：MCP格式描述
        mcp?: (args: ToolArgs) => McpTool;
    };

    // 增强resolve函数，支持MCP标准响应
    resolve: (args: any) => Promise<ToolResponse>;

    // 新增：工具元数据
    metadata?: {
        name: string;
        version?: string;
        author?: string;
        tags?: string[];
        // 新增：MCP服务器信息
        mcpServer?: {
            name: string;
            version?: string;
        };
    };

    // 新增：工具执行选项
    options?: {
        timeout?: number;
        retryCount?: number;
        requiresApproval?: boolean;
        // 新增：MCP特定选项
        mcpProtocol?: 'stdio' | 'sse';
    };
}