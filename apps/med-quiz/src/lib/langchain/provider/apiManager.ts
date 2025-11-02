// 定义一个通用的API接口
interface LLMApi {
  name: string;
  model: string;
  isAvailable(): Promise<boolean>;
  generateResponse(prompt: string): Promise<string>;
}

// 创建一个抽象层来管理API
class ApiManager {
  private apis: LLMApi[] = [];
  private currentApiIndex: number = 0;

  constructor(apis: LLMApi[]) {
    this.apis = apis;
  }

  async getAvailableApi(): Promise<LLMApi | null> {
    for (let i = 0; i < this.apis.length; i++) {
      const api = this.apis[this.currentApiIndex];
      if (await api.isAvailable()) {
        return api;
      }
      this.currentApiIndex = (this.currentApiIndex + 1) % this.apis.length;
    }
    return null;
  }

  async generateResponse(prompt: string): Promise<string> {
    const api = await this.getAvailableApi();
    if (!api) throw new Error("No available API");
    return api.generateResponse(prompt);
  }
}
