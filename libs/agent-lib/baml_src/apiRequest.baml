class ToolCall {
    id string
    call_id string
    type "function_call"
    name string
    arguments string
}


function ApiRequest(systemPrompt: string, workspaceContext: string, memoryContext: string[]) -> ToolCall[] {
    client GLM47_coder
    prompt #"

        {{_.role("user")}}

        {{systemPrompt}}

        ---
        CURRENT WORKSPACE CONTEXT
        ---
        {{workspaceContext}}
        ---
        END WORKSPACE CONTEXT
        ---

        ---
        CONVERSATION HISTORY
        ---
        {% for message in memoryContext %}
            {{message}}
        {% endfor %}
        ---
        END CONVERSATION HISTORY
        ---

        IMPORTANT: Review the CURRENT WORKSPACE CONTEXT above to understand the current state of all components.
        Then review the CONVERSATION HISTORY to see previous actions and results.
        Based on this information, decide your next action.

        {{ ctx.output_format }}
    "#
}

test TestName {
  functions [ApiRequest]
  args {
    systemPrompt #"
      hello world
    "#
    workspaceContext #"
      hello world
    "#
    memoryContext [
      #"
        hello world
      "#,
      #"
        hello world
      "#
    ]
  }
}
