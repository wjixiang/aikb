import OpenAI from "openai";
import * as dotenv from "dotenv";
import { ClientRegistry } from "@boundaryml/baml";
dotenv.config();

const clientRegistry = new ClientRegistry();

// Register all BAML clients
clientRegistry.addLlmClient("Hunyuanlite", "openai-generic", {
  model: "hunyuan-lite",
  api_key: process.env.CHATMODAL_API_KEY,
  base_url: "https://api.zhizengzeng.com/v1",
});

clientRegistry.addLlmClient("GLM4Flash", "openai-generic", {
  model: "glm-4-flash",
  api_key: process.env.GLM_API_KEY,
  base_url: "https://open.bigmodel.cn/api/paas/v4",
});

// Note: DeepseekV3 has empty options in BAML file, so we'll skip it or use defaults
// clientRegistry.addLlmClient('DeepseekV3', 'openai-generic', {
//     model: "",
//     api_key: "",
//     base_url: ""
// })

clientRegistry.addLlmClient("QiniuDeepseekV3", "openai-generic", {
  model: "deepseek-v3",
  api_key: process.env.QINIU_DEEPSEEK_FREE_API_KEY,
  base_url: "https://api.qnaigc.com/v1",
});

clientRegistry.addLlmClient("OpenrouterQWEN3", "openai-generic", {
  model: "qwen/qwen3-235b-a22b",
  api_key: process.env.OPENROUTER_API_KEY,
  base_url: "https://openrouter.ai/api/v1",
});

clientRegistry.addLlmClient("QWen3Reasoning", "openai-generic", {
  model: "qwen-plus-latest",
  api_key: process.env.ALIBABA_API_KEY,
  base_url: "https://dashscope.aliyuncs.com/compatible-mode/v1/",
  enable_thinking: true,
});

clientRegistry.addLlmClient("QWen3", "openai-generic", {
  model: "qwen-plus-latest",
  api_key: process.env.ALIBABA_API_KEY,
  base_url: "https://dashscope.aliyuncs.com/compatible-mode/v1/",
  enable_thinking: false,
});

clientRegistry.addLlmClient("GLM4Plus", "openai-generic", {
  model: "glm-4-plus",
  api_key: process.env.GLM_API_KEY,
  base_url: "https://open.bigmodel.cn/api/paas/v4",
  retry_policy: "GLMRetry", // This will be handled by BAML runtime
});

// Register new GLM models
clientRegistry.addLlmClient("GLM45", "openai-generic", {
  model: "glm-4.5",
  api_key: process.env.GLM_API_KEY,
  base_url: "https://open.bigmodel.cn/api/paas/v4",
});

clientRegistry.addLlmClient("GLM45X", "openai-generic", {
  model: "glm-4.5-x",
  api_key: process.env.GLM_API_KEY,
  base_url: "https://open.bigmodel.cn/api/paas/v4",
});

clientRegistry.addLlmClient("GLM45Air", "openai-generic", {
  model: "glm-4.5-air",
  api_key: process.env.GLM_API_KEY,
  base_url: "https://open.bigmodel.cn/api/paas/v4",
});

clientRegistry.addLlmClient("GLM45AirX", "openai-generic", {
  model: "glm-4.5-airx",
  api_key: process.env.GLM_API_KEY,
  base_url: "https://open.bigmodel.cn/api/paas/v4",
});

clientRegistry.addLlmClient("GLM45Flash", "openai-generic", {
  model: "glm-4.5-flash",
  api_key: process.env.GLM_API_KEY,
  base_url: "https://open.bigmodel.cn/api/paas/v4",
});

clientRegistry.addLlmClient("GLMZ1AirX", "openai-generic", {
  model: "glm-z1-airx",
  api_key: process.env.GLM_API_KEY,
  base_url: "https://open.bigmodel.cn/api/paas/v4",
});

clientRegistry.addLlmClient("GLM41VThinkingFlash", "openai-generic", {
  model: "glm-4.1v-thinking-flash",
  api_key: process.env.GLM_API_KEY,
  base_url: "https://open.bigmodel.cn/api/paas/v4",
});

clientRegistry.addLlmClient("GLMZ1Air", "openai-generic", {
  model: "glm-z1-air",
  api_key: process.env.GLM_API_KEY,
  base_url: "https://open.bigmodel.cn/api/paas/v4",
});

clientRegistry.addLlmClient("GLMZ1Flash", "openai-generic", {
  model: "glm-z1-flash",
  api_key: process.env.GLM_API_KEY,
  base_url: "https://open.bigmodel.cn/api/paas/v4",
});

clientRegistry.addLlmClient("GLM4Air250414", "openai-generic", {
  model: "glm-4-air-250414",
  api_key: process.env.GLM_API_KEY,
  base_url: "https://open.bigmodel.cn/api/paas/v4",
});

clientRegistry.addLlmClient("GLM4Flash250414", "openai-generic", {
  model: "glm-4-flash-250414",
  api_key: process.env.GLM_API_KEY,
  base_url: "https://open.bigmodel.cn/api/paas/v4",
});

clientRegistry.addLlmClient("CogVideoX3", "openai-generic", {
  model: "cogvideox-3",
  api_key: process.env.GLM_API_KEY,
  base_url: "https://open.bigmodel.cn/api/paas/v4",
});

clientRegistry.addLlmClient("GLM4Long", "openai-generic", {
  model: "glm-4-long",
  api_key: process.env.GLM_API_KEY,
  base_url: "https://open.bigmodel.cn/api/paas/v4",
});

clientRegistry.addLlmClient("GLM4VPlus0111", "openai-generic", {
  model: "glm-4v-plus-0111",
  api_key: process.env.GLM_API_KEY,
  base_url: "https://open.bigmodel.cn/api/paas/v4",
});

clientRegistry.addLlmClient("GLM4Air", "openai-generic", {
  model: "glm-4-air",
  api_key: process.env.GLM_API_KEY,
  base_url: "https://open.bigmodel.cn/api/paas/v4",
});

clientRegistry.addLlmClient("GLM4FlashX", "openai-generic", {
  model: "glm-4-flashx",
  api_key: process.env.GLM_API_KEY,
  base_url: "https://open.bigmodel.cn/api/paas/v4",
});

clientRegistry.addLlmClient("GLM4AirX", "openai-generic", {
  model: "glm-4-airx",
  api_key: process.env.GLM_API_KEY,
  base_url: "https://open.bigmodel.cn/api/paas/v4",
});

clientRegistry.addLlmClient("GLM49B", "openai-generic", {
  model: "glm-4-9b",
  api_key: process.env.GLM_API_KEY,
  base_url: "https://open.bigmodel.cn/api/paas/v4",
});

clientRegistry.addLlmClient("GLM4VPlus", "openai-generic", {
  model: "glm-4v-plus",
  api_key: process.env.GLM_API_KEY,
  base_url: "https://open.bigmodel.cn/api/paas/v4",
});

clientRegistry.addLlmClient("GLM4VFlash", "openai-generic", {
  model: "glm-4v-flash",
  api_key: process.env.GLM_API_KEY,
  base_url: "https://open.bigmodel.cn/api/paas/v4",
});

clientRegistry.addLlmClient("GLM4V", "openai-generic", {
  model: "glm-4v",
  api_key: process.env.GLM_API_KEY,
  base_url: "https://open.bigmodel.cn/api/paas/v4",
});

clientRegistry.addLlmClient("Rerank", "openai-generic", {
  model: "rerank",
  api_key: process.env.GLM_API_KEY,
  base_url: "https://open.bigmodel.cn/api/paas/v4",
});

clientRegistry.addLlmClient("CogView4250304", "openai-generic", {
  model: "cogview-4-250304",
  api_key: process.env.GLM_API_KEY,
  base_url: "https://open.bigmodel.cn/api/paas/v4",
});

clientRegistry.addLlmClient("CogView3Plus", "openai-generic", {
  model: "cogview-3-plus",
  api_key: process.env.GLM_API_KEY,
  base_url: "https://open.bigmodel.cn/api/paas/v4",
});

clientRegistry.addLlmClient("CogView3Flash", "openai-generic", {
  model: "cogview-3-flash",
  api_key: process.env.GLM_API_KEY,
  base_url: "https://open.bigmodel.cn/api/paas/v4",
});

clientRegistry.addLlmClient("CogView3", "openai-generic", {
  model: "cogview-3",
  api_key: process.env.GLM_API_KEY,
  base_url: "https://open.bigmodel.cn/api/paas/v4",
});

clientRegistry.addLlmClient("GLM4Assistant", "openai-generic", {
  model: "glm-4-assistant",
  api_key: process.env.GLM_API_KEY,
  base_url: "https://open.bigmodel.cn/api/paas/v4",
});

clientRegistry.addLlmClient("GLM4AllTools", "openai-generic", {
  model: "glm-4-alltools",
  api_key: process.env.GLM_API_KEY,
  base_url: "https://open.bigmodel.cn/api/paas/v4",
});

clientRegistry.addLlmClient("CogVideoXFlash", "openai-generic", {
  model: "cogvideox-flash",
  api_key: process.env.GLM_API_KEY,
  base_url: "https://open.bigmodel.cn/api/paas/v4",
});

clientRegistry.addLlmClient("CogVideoX2", "openai-generic", {
  model: "cogvideox-2",
  api_key: process.env.GLM_API_KEY,
  base_url: "https://open.bigmodel.cn/api/paas/v4",
});

clientRegistry.addLlmClient("CogVideoX", "openai-generic", {
  model: "cogvideox",
  api_key: process.env.GLM_API_KEY,
  base_url: "https://open.bigmodel.cn/api/paas/v4",
});

clientRegistry.addLlmClient("Embedding3", "openai-generic", {
  model: "embedding-3",
  api_key: process.env.GLM_API_KEY,
  base_url: "https://open.bigmodel.cn/api/paas/v4",
});

clientRegistry.addLlmClient("Embedding2", "openai-generic", {
  model: "embedding-2",
  api_key: process.env.GLM_API_KEY,
  base_url: "https://open.bigmodel.cn/api/paas/v4",
});

clientRegistry.addLlmClient("ChatGLM36B", "openai-generic", {
  model: "chatglm3-6b",
  api_key: process.env.GLM_API_KEY,
  base_url: "https://open.bigmodel.cn/api/paas/v4",
});

clientRegistry.addLlmClient("GLM40520", "openai-generic", {
  model: "glm-4-0520",
  api_key: process.env.GLM_API_KEY,
  base_url: "https://open.bigmodel.cn/api/paas/v4",
});

clientRegistry.addLlmClient("CodeGeeX4", "openai-generic", {
  model: "codegeex-4",
  api_key: process.env.GLM_API_KEY,
  base_url: "https://open.bigmodel.cn/api/paas/v4",
});

clientRegistry.addLlmClient("GLM4Voice", "openai-generic", {
  model: "glm-4-voice",
  api_key: process.env.GLM_API_KEY,
  base_url: "https://open.bigmodel.cn/api/paas/v4",
});

clientRegistry.addLlmClient("Tts_1", "openai-generic", {
  model: "tts-1",
  api_key: process.env.SHENMA_API_KEY,
  base_url: "https://api.whatai.cc/v1/",
  retry_policy: "GLMRetry", // This will be handled by BAML runtime
});

// Register Qwen Turbo models
clientRegistry.addLlmClient("QwenTurbo", "openai-generic", {
  model: "qwen-turbo",
  api_key: process.env.ALIBABA_API_KEY,
  base_url: "https://dashscope.aliyuncs.com/compatible-mode/v1/",
});

clientRegistry.addLlmClient("QwenTurboLatest", "openai-generic", {
  model: "qwen-turbo-latest",
  api_key: process.env.ALIBABA_API_KEY,
  base_url: "https://dashscope.aliyuncs.com/compatible-mode/v1/",
});

clientRegistry.addLlmClient("QwenTurbo20250715", "openai-generic", {
  model: "qwen-turbo-2025-07-15",
  api_key: process.env.ALIBABA_API_KEY,
  base_url: "https://dashscope.aliyuncs.com/compatible-mode/v1/",
});

clientRegistry.addLlmClient("QwenTurbo20250428", "openai-generic", {
  model: "qwen-turbo-2025-04-28",
  api_key: process.env.ALIBABA_API_KEY,
  base_url: "https://dashscope.aliyuncs.com/compatible-mode/v1/",
});

clientRegistry.addLlmClient("QwenTurbo20250211", "openai-generic", {
  model: "qwen-turbo-2025-02-11",
  api_key: process.env.ALIBABA_API_KEY,
  base_url: "https://dashscope.aliyuncs.com/compatible-mode/v1/",
});

clientRegistry.addLlmClient("QwenTurbo20240919", "openai-generic", {
  model: "qwen-turbo-0919",
  api_key: process.env.ALIBABA_API_KEY,
  base_url: "https://dashscope.aliyuncs.com/compatible-mode/v1/",
});

clientRegistry.addLlmClient("QwenTurbo20241101", "openai-generic", {
  model: "qwen-turbo-1101",
  api_key: process.env.ALIBABA_API_KEY,
  base_url: "https://dashscope.aliyuncs.com/compatible-mode/v1/",
});

clientRegistry.addLlmClient("QwenTurbo20240624", "openai-generic", {
  model: "qwen-turbo-0624",
  api_key: process.env.ALIBABA_API_KEY,
  base_url: "https://dashscope.aliyuncs.com/compatible-mode/v1/",
});

// Register Qwen Plus models
clientRegistry.addLlmClient("QwenPlus", "openai-generic", {
  model: "qwen-plus",
  api_key: process.env.ALIBABA_API_KEY,
  base_url: "https://dashscope.aliyuncs.com/compatible-mode/v1/",
});

clientRegistry.addLlmClient("QwenPlusLatest", "openai-generic", {
  model: "qwen-plus-latest",
  api_key: process.env.ALIBABA_API_KEY,
  base_url: "https://dashscope.aliyuncs.com/compatible-mode/v1/",
});

clientRegistry.addLlmClient("QwenPlus20250714", "openai-generic", {
  model: "qwen-plus-2025-07-14",
  api_key: process.env.ALIBABA_API_KEY,
  base_url: "https://dashscope.aliyuncs.com/compatible-mode/v1/",
});

clientRegistry.addLlmClient("QwenPlus20250428", "openai-generic", {
  model: "qwen-plus-2025-04-28",
  api_key: process.env.ALIBABA_API_KEY,
  base_url: "https://dashscope.aliyuncs.com/compatible-mode/v1/",
});

clientRegistry.addLlmClient("QwenPlus20250125", "openai-generic", {
  model: "qwen-plus-2025-01-25",
  api_key: process.env.ALIBABA_API_KEY,
  base_url: "https://dashscope.aliyuncs.com/compatible-mode/v1/",
});

clientRegistry.addLlmClient("QwenPlus20241125", "openai-generic", {
  model: "qwen-plus-1125",
  api_key: process.env.ALIBABA_API_KEY,
  base_url: "https://dashscope.aliyuncs.com/compatible-mode/v1/",
});

clientRegistry.addLlmClient("QwenPlus20241127", "openai-generic", {
  model: "qwen-plus-1127",
  api_key: process.env.ALIBABA_API_KEY,
  base_url: "https://dashscope.aliyuncs.com/compatible-mode/v1/",
});

clientRegistry.addLlmClient("QwenPlus20241220", "openai-generic", {
  model: "qwen-plus-1220",
  api_key: process.env.ALIBABA_API_KEY,
  base_url: "https://dashscope.aliyuncs.com/compatible-mode/v1/",
});

clientRegistry.addLlmClient("QwenPlus20250112", "openai-generic", {
  model: "qwen-plus-0112",
  api_key: process.env.ALIBABA_API_KEY,
  base_url: "https://dashscope.aliyuncs.com/compatible-mode/v1/",
});

// Register GPT models
clientRegistry.addLlmClient("Gpt4o", "openai-generic", {
  model: "gpt-4o",
  api_key: process.env.GPTIO_API_KEY,
  base_url: process.env.GPTIO_BASE_URL,
});

clientRegistry.addLlmClient("Gpt4oMini", "openai-generic", {
  model: "gpt-4o-mini",
  api_key: process.env.GPTIO_API_KEY,
  base_url: process.env.GPTIO_BASE_URL,
});

clientRegistry.addLlmClient("Gpt4Turbo", "openai-generic", {
  model: "gpt-4-turbo",
  api_key: process.env.GPTIO_API_KEY,
  base_url: process.env.GPTIO_BASE_URL,
});

clientRegistry.addLlmClient("Gpt35Turbo", "openai-generic", {
  model: "gpt-3.5-turbo",
  api_key: process.env.GPTIO_API_KEY,
  base_url: process.env.GPTIO_BASE_URL,
});

clientRegistry.addLlmClient("DeepseekV3", "openai-generic", {
  model: "deepseek-v3",
  api_key: process.env.GPTIO_API_KEY,
  base_url: process.env.GPTIO_BASE_URL,
});

// Supported LLMs type
type SupportedLLM =
  | "Hunyuanlite"
  | "GLM4Flash"
  | "GLM45"
  | "GLM45X"
  | "GLM45Air"
  | "GLM45AirX"
  | "GLM45Flash"
  | "GLMZ1AirX"
  | "GLM41VThinkingFlash"
  | "GLM4Plus"
  | "GLMZ1Air"
  | "GLMZ1Flash"
  | "GLM4Air250414"
  | "GLM4Flash250414"
  | "CogVideoX3"
  | "GLM4Long"
  | "GLM4VPlus0111"
  | "GLM4Air"
  | "GLM4FlashX"
  | "GLM4Flash"
  | "GLM4AirX"
  | "GLM49B"
  | "GLM4VPlus"
  | "GLM4VFlash"
  | "GLM4V"
  | "Rerank"
  | "CogView4250304"
  | "CogView3Plus"
  | "CogView3Flash"
  | "CogView3"
  | "GLM4Assistant"
  | "GLM4AllTools"
  | "CogVideoXFlash"
  | "CogVideoX2"
  | "CogVideoX"
  | "Embedding3"
  | "Embedding2"
  | "ChatGLM36B"
  | "GLM40520"
  | "CodeGeeX4"
  | "GLM4Voice"
  | "QiniuDeepseekV3"
  | "OpenrouterQWEN3"
  | "QWen3Reasoning"
  | "QWen3"
  | "GLM4Plus"
  | "Tts_1"
  | "QwenTurbo"
  | "QwenTurboLatest"
  | "QwenTurbo20250715"
  | "QwenTurbo20250428"
  | "QwenTurbo20250211"
  | "QwenTurbo20240919"
  | "QwenTurbo20241101"
  | "QwenTurbo20240624"
  | "QwenPlus"
  | "QwenPlusLatest"
  | "QwenPlus20250714"
  | "QwenPlus20250428"
  | "QwenPlus20250125"
  | "QwenPlus20241125"
  | "QwenPlus20241127"
  | "QwenPlus20241220"
  | "QwenPlus20250112"
  | "DeepseekV3";

// Set a primary client (using QiniuDeepseekV3 as an example)
clientRegistry.setPrimary("QiniuDeepseekV3");

const llm_provider = {
  qiniuyun: new OpenAI({
    apiKey: process.env.QINIU_DEEPSEEK_FREE_API_KEY,
    baseURL: "https://api.qnaigc.com/v1",
  }),
  zhizengzeng: new OpenAI({
    apiKey: process.env.CHATMODAL_API_KEY,
    baseURL: "https://api.zhizengzeng.com/v1",
  }),
  glm: new OpenAI({
    apiKey: process.env.GLM_API_KEY,
    baseURL: "https://open.bigmodel.cn/api/paas/v4",
  }),
  alibaba: new OpenAI({
    apiKey: process.env.ALIBABA_API_KEY,
    baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1/",
  }),
  gptio: new OpenAI({
    apiKey: process.env.GPTIO_API_KEY,
    baseURL: process.env.GPTIO_BASE_URL,
  }),
};

function get_provider(llm_id: SupportedLLM): OpenAI {
  // Map LLM IDs to their respective providers based on API keys
  switch (llm_id) {
    case "DeepseekV3":
      return llm_provider.gptio;
    // Qiniu DeepSeek models
    case "QiniuDeepseekV3":
      return llm_provider.qiniuyun;

    // ZhiZengZeng models
    case "Hunyuanlite":
      return llm_provider.zhizengzeng;

    // GLM models
    case "GLM4Flash":
    case "GLM45":
    case "GLM45X":
    case "GLM45Air":
    case "GLM45AirX":
    case "GLM45Flash":
    case "GLMZ1AirX":
    case "GLM41VThinkingFlash":
    case "GLM4Plus":
    case "GLMZ1Air":
    case "GLMZ1Flash":
    case "GLM4Air250414":
    case "GLM4Flash250414":
    case "CogVideoX3":
    case "GLM4Long":
    case "GLM4VPlus0111":
    case "GLM4Air":
    case "GLM4FlashX":
    case "GLM4Flash":
    case "GLM4AirX":
    case "GLM49B":
    case "GLM4VPlus":
    case "GLM4VFlash":
    case "GLM4V":
    case "Rerank":
    case "CogView4250304":
    case "CogView3Plus":
    case "CogView3Flash":
    case "CogView3":
    case "GLM4Assistant":
    case "GLM4AllTools":
    case "CogVideoXFlash":
    case "CogVideoX2":
    case "CogVideoX":
    case "Embedding3":
    case "Embedding2":
    case "ChatGLM36B":
    case "GLM40520":
    case "CodeGeeX4":
    case "GLM4Voice":
      return llm_provider.glm;

    // Alibaba/Qwen models
    case "QWen3Reasoning":
    case "QWen3":
    case "QwenTurbo":
    case "QwenTurboLatest":
    case "QwenTurbo20250715":
    case "QwenTurbo20250428":
    case "QwenTurbo20250211":
    case "QwenTurbo20240919":
    case "QwenTurbo20241101":
    case "QwenTurbo20240624":
    case "QwenPlus":
    case "QwenPlusLatest":
    case "QwenPlus20250714":
    case "QwenPlus20250428":
    case "QwenPlus20250125":
    case "QwenPlus20241125":
    case "QwenPlus20241127":
    case "QwenPlus20241220":
    case "QwenPlus20250112":
    case "OpenrouterQWEN3":
      return llm_provider.alibaba;

    // Other models
    case "Tts_1":
      return llm_provider.zhizengzeng;

    default:
      // Return primary provider as fallback
      return llm_provider.qiniuyun;
  }
}

export { clientRegistry, get_provider };
export type { SupportedLLM };
