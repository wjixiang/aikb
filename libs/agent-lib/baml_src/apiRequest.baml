class AttemptCompletion {
    toolName "attempt_completion"
    data string
}

class ExecuteScript {
    toolName "execute_script"
    data string
}

function ApiRequest(systemPrompt: string, workspaceContext: string, memoryContext: string[]) -> AttemptCompletion |  ExecuteScript{
    client GLM47_coder
    prompt #"
        {{_.role("system")}}
        {{ ctx.output_format }}

        {{_.role("user")}}

        {{systemPrompt}}

        {{workspaceContext}}

        {% for message in memoryContext %}
            {{message}}
        {% endfor %}

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
