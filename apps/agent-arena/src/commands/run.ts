import 'reflect-metadata';
import chalk from 'chalk';
import ora from 'ora';
import { resolveBlueprint, runAgent } from '../lib/test-runner.js';
import { formatRunResult } from '../lib/output-formatter.js';

export async function runCommand(
  agent: string,
  options: {
    prompt: string;
    mock: boolean;
    live: boolean;
    provider?: string;
    model?: string;
    apiKey?: string;
    timeout: string;
    observe: boolean;
    json: boolean;
  },
): Promise<void> {
  const spinner = ora('Resolving agent blueprint...').start();
  const mode = options.live ? 'live' : 'mock';

  try {
    const blueprint = resolveBlueprint(agent);
    spinner.text = `Running agent (${mode} mode)...`;

    const result = await runAgent(blueprint, options.prompt, {
      mode,
      ...(options.provider && { provider: options.provider }),
      ...(options.model && { model: options.model }),
      ...(options.apiKey && { apiKey: options.apiKey }),
      timeout: parseInt(options.timeout),
    });

    if (result.success) {
      spinner.succeed(`Agent completed in ${result.duration}ms`);
    } else {
      spinner.fail(`Agent failed after ${result.duration}ms`);
    }

    formatRunResult(result, options.json);
    process.exit(result.success ? 0 : 1);
  } catch (error) {
    spinner.fail(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
