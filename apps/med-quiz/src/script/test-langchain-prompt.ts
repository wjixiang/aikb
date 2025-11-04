#!/usr/bin/env node
/**
 * CLI script to test LangChain prompt templates
 * @module test-langchain-prompt
 * @description This script provides a command-line interface to test various
 * prompt templates from LangChain with different input parameters and LLM providers.
 */
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import * as prompts from '../lib/GraphRAG/prompt/prompt';
import { PromptTemplate } from '@langchain/core/prompts';
import { getChatModel } from '../lib/langchain/provider';

/**
 * Command-line arguments configuration
 * @type {object}
 * @property {string} template - Name of the prompt template to test
 * @property {string} params - JSON string of template parameters
 * @property {string} model - Model name to use
 * @property {number} temperature - Model temperature
 */
const argv = yargs(hideBin(process.argv))
  .option('template', {
    alias: 't',
    type: 'string',
    description: 'Name of prompt template to test',
    choices: Object.keys(prompts)
      .concat(Object.keys(prompts.ENTITY_EXTRACTION_EXAMPLE))
      .filter((k: string) => {
        const prompt = (prompts as any)[k as keyof typeof prompts];
        // Handle both direct PromptTemplates and nested ones (like ENTITY_EXTRACTION_PROMPT)
        if (
          prompt instanceof Object &&
          'format' in prompt &&
          typeof prompt.format === 'function'
        ) {
          return true;
        }
        if (
          prompt instanceof Object &&
          'DEFAULT' in prompt &&
          prompt.DEFAULT instanceof Object &&
          'format' in prompt.DEFAULT
        ) {
          return true;
        }
        return false;
      }),
    demandOption: true,
  })
  .option('params', {
    alias: 'p',
    type: 'string',
    description: 'JSON string of template parameters',
    default: '{}',
  })
  .option('model', {
    alias: 'm',
    type: 'string',
    description: 'Model name to use',
    default: 'gpt-4o-mini',
  })
  .option('temperature', {
    type: 'number',
    description: 'Model temperature',
    default: 0.7,
  })
  .parseSync();

/**
 * Main function that executes the prompt testing
 * @async
 * @function main
 */
async function main() {
  try {
    const params = JSON.parse(argv.params);
    const template = prompts[argv.template as keyof typeof prompts];
    if (!(template instanceof Object)) {
      throw new Error(
        `Selected template ${argv.template} is not a valid PromptTemplate`,
      );
    }

    // Handle both direct PromptTemplates and nested ones (like ENTITY_EXTRACTION_PROMPT)
    let promptTemplate;
    if ('format' in template) {
      promptTemplate = template;
    } else if (
      'DEFAULT' in template &&
      template.DEFAULT instanceof Object &&
      'format' in template.DEFAULT
    ) {
      promptTemplate = template.DEFAULT;
    } else {
      throw new Error(
        `Selected template ${argv.template} is not a valid PromptTemplate`,
      );
    }

    const prompt = await (promptTemplate as PromptTemplate).format(params);

    console.log('Formatted Prompt:\n', prompt);

    const chatModel = getChatModel()(argv.model, argv.temperature);
    const result = await chatModel.invoke(prompt);

    console.log('\nLLM Output:\n', result);
  } catch (error) {
    console.error(
      'Error:',
      error instanceof Error ? error.message : String(error),
    );
    if (error instanceof SyntaxError) {
      console.error('Invalid JSON parameters format');
    }
  }
}

main();
