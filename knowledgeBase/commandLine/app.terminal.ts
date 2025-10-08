import { input } from '@inquirer/prompts';
import { Command } from 'commander';

async function main() {
  const answer = await input({ message: 'Enter your name' });
}
