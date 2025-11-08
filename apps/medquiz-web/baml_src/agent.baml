// Agent Tool Calling System
// This file defines the complete agent tool calling architecture

// Tool definitions
class ToolList {
    tools ToolDefinition[]
}

class ToolDefinition {
    name string
    description string
    parameters ToolParameter[]
    required_parameters string[]
}

class ToolParameter {
    name string
    type string
    description string
    required bool
}

// Available tools
class Textbook_semantic_search_tool {
    search_content string
    max_results int @description("Maximum number of results to return, default 5")
    subject_filter string[] @description("Optional subject filters")
}

class Quiz_retrieval_tool {
    query string
    difficulty_level string[] @description("Easy, Medium, Hard")
    subject string[] @description("Subject filters")
    limit int @description(#"
        default 10
    "#)
}

class Knowledge_extraction_tool {
    content string
    extract_type string @description("concepts, definitions, relationships")
    format string @description(#"
       structured 
    "#)
}

class StepResponse {
    is_final_step bool
    response string
    tool ToolCall?
    reasoning string @description("Agent's reasoning for this step")
}

class ToolCall {
    tool_name string
    parameters map<string, ToolParameter>
    id string @description("Unique identifier for this tool call")
}

// Agent decision making
class AgentDecision {
    should_use_tool bool
    selected_tool string?
    reasoning string
    confidence float @description("Confidence score 0-1")
}

// Agent state management
class AgentState {
    conversation_history Message[]
    available_tools ToolDefinition[]
    current_context string
    step_count int 
    max_steps int 
}

class Message {
    role string @description("user, assistant, system, tool")
    content string
    timestamp string
    tool_calls ToolCall[]?
    tool_results ToolResult[]?
}

class ToolResult {
    tool_id string
    result string
    success bool
    error_message string?
}

// Main agent functions
function AgentDecideNextAction(
    user_query: string,
    conversation_history: Message[],
    available_tools: ToolDefinition[],
    current_context: string
) -> AgentDecision {
    client "GLM4Plus"
    prompt #"
        {{_.role("system")}}
        You are an intelligent agent that can use tools to help users with medical education queries.
        
        Your responsibilities:
        1. Analyze the user's query carefully
        2. Decide whether you need to use a tool to provide accurate information
        3. Select the most appropriate tool based on the query context
        4. Provide clear reasoning for your decision
        
        Available tools:
        {% for tool in available_tools %}
        - {{tool.name}}: {{tool.description}}
          Parameters: {% for param in tool.parameters %}{{param.name}} ({{param.type}}): {{param.description}}{% if not loop.last %}, {% endif %}{% endfor %}
        {% endfor %}
        
        Current context: {{current_context}}
        
        {{_.role("user")}}
        User query: {{user_query}}
        
        Conversation history:
        {% for msg in conversation_history %}
        {{msg.role}}: {{msg.content}}
        {% endfor %}
        
        Analyze the query and decide:
        1. Do you need to use a tool to answer this accurately?
        2. If yes, which tool is most appropriate?
        3. What's your reasoning?
        
        {{ctx.output_format}}
    "#
}

function ExecuteToolCall(
    tool_name: string,
    parameters: map<string, ToolParameter>,
    tool_definitions: ToolDefinition[]
) -> ToolResult {
    client "GLM4Plus"
    prompt #"
        {{_.role("system")}}
        You are a tool execution engine. Validate and execute the requested tool call.
        
        Tool: {{tool_name}}
        Parameters: {{parameters}}
        
        {% for tool in tool_definitions %}
        {% if tool.name == tool_name %}
        Required parameters: {{tool.required_parameters}}
        {% endif %}
        {% endfor %}
        
        Validate the parameters and simulate the tool execution.
        Return the result in the specified format.
        
        {{ctx.output_format}}
    "#
}

function GenerateAgentResponse(
    user_query: string,
    tool_results: ToolResult[],
    conversation_history: Message[]
) -> StepResponse {
    client "GLM4Plus"
    prompt #"
        {{_.role("system")}}
        You are a medical education assistant. Generate a helpful response based on the tool results and conversation history.
        
        Guidelines:
        1. Be accurate and informative
        2. Use the tool results to provide specific, relevant information
        3. Maintain a helpful, educational tone
        4. If this fully answers the user's query, mark is_final_step as true
        5. If more steps are needed, mark is_final_step as false and explain what you'll do next
        
        Tool Results:
        {% for result in tool_results %}
        - Tool ID: {{result.tool_id}}
          Success: {{result.success}}
          {% if result.success %}
          Result: {{result.result}}
          {% else %}
          Error: {{result.error_message}}
          {% endif %}
        {% endfor %}
        
        Conversation History:
        {% for msg in conversation_history %}
        {{msg.role}}: {{msg.content}}
        {% endfor %}
        
        User Query: {{user_query}}
        
        Generate your response according to the guidelines.
        
        {{ctx.output_format}}
    "#
}

function FinalizeAgentResponse(
    conversation_history: Message[],
    accumulated_information: string
) -> StepResponse {
    client "GLM4Plus"
    prompt #"
        {{_.role("system")}}
        You are a medical education assistant. Synthesize all the information gathered through tool calls and provide a comprehensive final response.
        
        Guidelines:
        1. Review all the information gathered in previous steps
        2. Provide a comprehensive, well-structured response
        3. Address the original user query completely
        4. Ensure all information is accurate and relevant
        5. Format the response clearly with appropriate sections if needed
        
        Accumulated Information:
        {{accumulated_information}}
        
        Conversation History:
        {% for msg in conversation_history %}
        {{msg.role}}: {{msg.content}}
        {% endfor %}
        
        Provide your final comprehensive response.
        
        {{ctx.output_format}}
    "#
}

