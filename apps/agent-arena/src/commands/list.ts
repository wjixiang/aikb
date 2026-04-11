import 'reflect-metadata';
import chalk from 'chalk';
import { getAllAgentSouls } from 'agent-soul-hub';

export async function listCommand(): Promise<void> {
  console.log('');
  console.log(chalk.bold('Available Agent Souls:'));
  console.log('');

  const souls = getAllAgentSouls();
  if (souls.length === 0) {
    console.log(chalk.gray('  No agent souls registered.'));
  } else {
    for (const soul of souls) {
      console.log(`  ${chalk.cyan(soul.token.padEnd(25))} ${soul.name}`);
      console.log(chalk.gray(`  ${''.padEnd(25)} ${soul.description}`));
      console.log('');
    }
  }

  console.log(chalk.gray('\nUsage: agent-arena run <soul-token> -p "your message"\n'));
}
