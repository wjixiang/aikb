import {
  OpenAICompatibleConfig,
  OpenaiCompatibleApiClient,
} from '../OpenaiCompatibleApiClient';
import { ChatCompletionFunctionTool } from '../ApiClient.interface';
import { ApiClientFactory } from '../ApiClientFactory.ts';
import { config } from 'dotenv';
config();

describe('Test Moonshot (Kimi) API', () => {
  const kimiCode = ApiClientFactory.create({
    apiProvider: 'moonshot',
    moonshotApiLine: 'coding',
    apiModelId: 'kimi-for-coding',
    apiKey: process.env['KIMI_API_KEY'] as string,
  });

  it('', async () => {
    const result = await kimiCode.makeRequest('', 'hi', []);
    console.log(result);
  });
});
