class AttemptCompletion {
    toolName "attempt_completion"
    toolParams string
}

class ToolCall {
    toolName string
    toolParams string
}


function ApiRequest(systemPrompt: string, workspaceContext: string, memoryContext: string[]) -> AttemptCompletion |  ToolCall{
    client GLM47_coder
    prompt #"

        {{_.role("user")}}

        {{systemPrompt}}

        {{workspaceContext}}

        {% for message in memoryContext %}
            {{message}}
        {% endfor %}

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
