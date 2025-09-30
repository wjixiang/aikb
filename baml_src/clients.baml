// Learn more about clients at https://docs.boundaryml.com/docs/snippets/clients/overview

client<llm> GLM4Flash {
  provider openai-generic
  options {
    model "glm-4.5-flash"
    api_key env.GLM_API_KEY
    base_url "https://open.bigmodel.cn/api/paas/v4"
  }
}

