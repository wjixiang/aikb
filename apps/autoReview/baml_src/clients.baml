client<llm> DefaultClient {
  provider openai-generic
  options {
    model "glm-4.7"
    base_url "https://open.bigmodel.cn/api/coding/paas/v4"
    api_key env.GLM_API_KEY
  }
}