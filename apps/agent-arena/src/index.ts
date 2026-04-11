import 'reflect-metadata';
import { program } from 'commander';
import { runCommand } from './commands/run.js';
import { testCommand } from './commands/test.js';
import { listCommand } from './commands/list.js';
// Config is loaded lazily by the singleton on first access

program
  .name('agent-arena')
  .description('CLI tool for testing agents with mock and live LLM support')
  .version('0.1.0');

program
  .command('run')
  .description('Run a single agent with a prompt')
  .argument('<agent>', 'Agent soul token (e.g. ukb-data, bib-retrieve)')
  .requiredOption('-p, --prompt <message>', 'User prompt to send to the agent')
  .option('--mock', 'Use mock LLM (default)', true)
  .option('--live', 'Use real LLM API')
  .option('--provider <name>', 'LLM provider for live mode (e.g. openai, anthropic)')
  .option('--model <id>', 'Model ID for live mode')
  .option('--api-key <key>', 'API key for live mode')
  .option('--timeout <ms>', 'Agent execution timeout in ms (0 = no limit)', '0')
  .option('--observe', 'Print real-time agent events')
  .option('--json', 'Output results as JSON')
  .action(runCommand);

program
  .command('test')
  .description('Run a test suite from a YAML/JSON file')
  .argument('<file>', 'Path to test suite file (.yaml or .json)')
  .option('--mock', 'Use mock LLM (default)', true)
  .option('--live', 'Use real LLM API')
  .option('--provider <name>', 'LLM provider for live mode')
  .option('--model <id>', 'Model ID for live mode')
  .option('--api-key <key>', 'API key for live mode')
  .option('--timeout <ms>', 'Timeout per test case in ms (0 = no limit)', '0')
  .option('--json', 'Output results as JSON')
  .action(testCommand);

program
  .command('list')
  .description('List all available agent souls')
  .action(listCommand);

program.parseAsync(process.argv);
