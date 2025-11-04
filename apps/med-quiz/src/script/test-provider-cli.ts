import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import { LLMProvider, testAllProviders } from '../lib/langchain/provider';
import * as dotenv from 'dotenv';
dotenv.config();

async function main() {
  const argv = await yargs(hideBin(process.argv))
    .option('provider', {
      alias: 'p',
      type: 'string',
      description: 'Specific provider to test (gptio, gptapi, ZhiZengZeng)',
      choices: ['gptio', 'gptapi', 'zhizeng'],
    })
    .option('test', {
      alias: 't',
      type: 'string',
      description: 'Test type (chat, embedding, all)',
      choices: ['chat', 'embedding', 'all'],
      default: 'all',
    })
    .option('model', {
      alias: 'm',
      type: 'string',
      description: 'Model name to test',
    })
    .option('temperature', {
      type: 'number',
      description: 'Temperature for chat model',
      default: 0.7,
    })
    .help()
    .alias('help', 'h').argv;

  if (argv.provider) {
    // Test specific provider
    let provider;
    try {
      provider = LLMProvider.getProvider(argv.provider);
    } catch (error) {
      console.error(
        `Provider ${argv.provider} not found or failed to initialize:`,
        error,
      );
      process.exit(1);
    }

    console.log(`Testing provider: ${argv.provider}`);

    if (argv.test === 'chat' || argv.test === 'all') {
      try {
        const modelName = argv.model || 'deepseek-v3'; // 使用默认模型
        console.log(`Testing chat model: ${modelName}`);
        const chatModel = provider.getChatModal(modelName, argv.temperature);
        const response = await chatModel.invoke('Hello, world!');
        console.log('Chat test successful');
        console.log('Response:', response);
      } catch (error) {
        console.error('Chat test failed:', error);
      }
    }

    if (argv.test === 'embedding' || argv.test === 'all') {
      try {
        const modelName = argv.model || 'text-embedding-3-large'; // 使用默认嵌入模型
        console.log(`Testing embedding model: ${modelName}`);
        const { Embeddings } = provider.getEmbeddingModal(modelName);
        const embeddings = await Embeddings.embedDocuments(['Hello, world!']);
        console.log('Embedding test successful');
        console.log('Vector dimensions:', embeddings[0].length);
      } catch (error) {
        console.error('Embedding test failed:', error);
      }
    }
  } else {
    // Test all providers
    console.log('Testing all providers...');
    testAllProviders();
  }
}

main().catch(console.error);
