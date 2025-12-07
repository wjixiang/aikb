client<llm> GLM4Plus {
  provider openai-generic
  options {
    model "glm-4-plus"
    api_key env.GLM_API_KEY
    base_url "https://open.bigmodel.cn/api/paas/v4"
    retry_policy GLMRetry
  }
}
client<llm> GLM45Flash {
  provider openai-generic
  options {
    model "glm-4.5-flash"
    api_key env.GLM_API_KEY
    base_url "https://open.bigmodel.cn/api/paas/v4"
    retry_policy GLMRetry
  }
}

client<llm> GLM45Air {
  provider openai-generic
  options {
    model "glm-4-air-250414"
    api_key env.GLM_API_KEY
    base_url "https://open.bigmodel.cn/api/paas/v4"
    retry_policy GLMRetry
  }
}

client<llm> GLM46 {
  provider openai-generic
  options {
    model "glm-4.6"
    api_key env.GLM_API_KEY
    base_url "https://open.bigmodel.cn/api/paas/v4"
    retry_policy GLMRetry
    thinking {
      type "disabled"
    }
  }
}




client<llm> QiniuDeepseekV3 {
  provider openai-generic
  options {
    model "deepseek-v3"
    api_key env.QINIU_DEEPSEEK_FREE_API_KEY
    base_url "https://api.qnaigc.com/v1"
  }
}

client<llm> GeminiFlash {
  provider openai-generic
  options {
    model "gemini-2.5-flash-preview-05-20"
    api_key env.SHENMA_API_KEY
    base_url "https://api.whatai.cc/v1"
  }
}

client<llm> GeminiFlashOpenrouter {
  provider openai-generic
  options {
    model "google/gemini-2.5-pro"
    api_key env.OPENROUTER_API_KEY
    base_url "https://openrouter.ai/api/v1"
  }
}

client<llm> Kimi {
  provider openai-generic
  options {
    model "kimi-k2-0905-preview"
    api_key env.KIMI_API_KEY
    base_url "https://api.moonshot.cn/v1"
  }
}

client<llm> KimiK2Turbo {
  provider openai-generic
  options {
    model "kimi-k2-turbo-preview"
    api_key env.KIMI_API_KEY
    base_url "https://api.moonshot.cn/v1"
  }
}


retry_policy GLMRetry {
  max_retries 6
    strategy {
    type constant_delay
    delay_ms 10000
  }
}
