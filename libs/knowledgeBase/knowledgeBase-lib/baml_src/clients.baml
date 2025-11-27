// Learn more about clients at https://docs.boundaryml.com/docs/snippets/clients/overview

client<llm> GLM4Flash {
  provider openai-generic
  options {
    model "glm-4-flash"
    api_key env.GLM_API_KEY
    base_url "https://open.bigmodel.cn/api/paas/v4"
  }
}

client<llm> GLM45Flash {
  provider openai-generic
  options {
    model "glm-4.5-flash"
    api_key env.GLM_API_KEY
    base_url "https://open.bigmodel.cn/api/paas/v4"
  }
}

client<llm> GLM45Air {
  provider openai-generic
  options {
    model "glm-4.5-air"
    api_key env.GLM_API_KEY
    base_url "https://open.bigmodel.cn/api/paas/v4"
  }
}

client<llm> GLMZ1Flash {
  provider openai-generic
  options {
    model "glm-z1-flash"
    api_key env.GLM_API_KEY
    base_url "https://open.bigmodel.cn/api/paas/v4"
  }
}

client<llm> GLM4Air {
  provider openai-generic
  options {
    model "glm-4-air"
    api_key env.GLM_API_KEY
    base_url "https://open.bigmodel.cn/api/paas/v4"
  }
}

client<llm> QWen3 {
  provider openai-generic
  options {
    model "qwen-plus-latest"
    api_key env.ALIBABA_API_KEY
    base_url "https://dashscope.aliyuncs.com/compatible-mode/v1/"
    enable_thinking false
  }
}

client<llm> QWenFlash {
  provider openai-generic
  options {
    model "qwen-flash"
    api_key env.ALIBABA_API_KEY
    base_url "https://dashscope.aliyuncs.com/compatible-mode/v1/"
    enable_thinking false
  }
}



client<llm> QWen27binstruct {
  provider openai-generic
  options {
    model "qwen2-7b-instruct"
    api_key env.ALIBABA_API_KEY
    base_url "https://dashscope.aliyuncs.com/compatible-mode/v1/"
    enable_thinking false
  }
}


client<llm> QWen25_7binstruct {
  provider openai-generic
  options {
    model "qwen2.5-7b-instruct"
    api_key env.ALIBABA_API_KEY
    base_url "https://dashscope.aliyuncs.com/compatible-mode/v1/"
    enable_thinking false
  }
}

client<llm> QWen25_14binstruct {
  provider openai-generic
  options {
    model "qwen2.5-14b-instruct"
    api_key env.ALIBABA_API_KEY
    base_url "https://dashscope.aliyuncs.com/compatible-mode/v1/"
    enable_thinking false
  }
}

client<llm> QWen25_32binstruct {
  provider openai-generic
  options {
    model "qwen2.5-32b-instruct"
    api_key env.ALIBABA_API_KEY
    base_url "https://dashscope.aliyuncs.com/compatible-mode/v1/"
    enable_thinking false
  }
}