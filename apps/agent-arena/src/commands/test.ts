import 'reflect-metadata';
import ora from 'ora';
import { loadTestSuite } from '../lib/test-loader.js';
import { runTestSuite } from '../lib/test-runner.js';
import { formatTestSuiteResult } from '../lib/output-formatter.js';

export async function testCommand(
  file: string,
  options: {
    mock: boolean;
    live: boolean;
    provider?: string;
    model?: string;
    apiKey?: string;
    timeout: string;
    json: boolean;
  },
): Promise<void> {
  const mode = options.live ? 'live' : 'mock';
  const spinner = ora(`Loading test suite from ${file}...`).start();

  try {
    const suite = loadTestSuite(file);
    spinner.text = `Running ${suite.cases.length} test cases (${mode} mode)...`;

    const result = await runTestSuite(suite, {
      mode,
      ...(options.provider && { provider: options.provider }),
      ...(options.model && { model: options.model }),
      ...(options.apiKey && { apiKey: options.apiKey }),
      timeout: parseInt(options.timeout),
    });

    spinner.stop();
    formatTestSuiteResult(result, options.json);
    process.exit(result.failed > 0 ? 1 : 0);
  } catch (error) {
    spinner.fail(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
