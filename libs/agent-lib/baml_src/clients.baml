// Learn more about clients at https://docs.boundaryml.com/docs/snippets/clients/overview

// Using the new OpenAI Responses API for enhanced formatting
client<llm> GLM47_coder {
  provider openai-generic
  options {
    model "glm-4.7"
    base_url "https://open.bigmodel.cn/api/coding/paas/v4"
    api_key env.GLM_API_KEY
  }
}
