#!/usr/bin/env tsx
import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import axios, { AxiosError } from 'axios';

const API_BASE = 'http://localhost:3000/api/obcors/quiz/similar-search-by-desc';

async function searchSimilarQuizzes(
  filter: string,
  searchStr: string,
  verbose = false,
) {
  const startTime = Date.now();
  if (verbose) {
    console.log(`[TEST] Starting search for: "${searchStr}"`);
    console.log(`[TEST] Using filter: "${filter}"`);
  }

  try {
    const response = await axios.post(API_BASE, {
      filter,
      searchStr,
    });

    if (verbose) {
      console.log(`[TEST] Search completed in ${Date.now() - startTime}ms`);
      console.log(`[TEST] Found ${response.data?.length || 0} results`);
      if (response.data?.length) {
        console.log(`[TEST] First result:`, {
          id: response.data[0]._id,
          content: response.data[0].content?.substring(0, 100) + '...',
        });
      }
    }

    return response.data;
  } catch (error: unknown) {
    const errorTime = Date.now() - startTime;
    console.error(`[TEST] Search failed after ${errorTime}ms`);

    if (axios.isAxiosError(error)) {
      const err = error as AxiosError;
      console.error('[TEST] API Error Details:');
      console.error('Status:', err.response?.status);
      console.error('Data:', err.response?.data);
      console.error('URL:', err.config?.url);
      if (verbose && err.response?.data) {
        console.error(
          'Full error:',
          JSON.stringify(err.response.data, null, 2),
        );
      }
    } else if (error instanceof Error) {
      console.error('[TEST] Error:', error.message);
      if (verbose) {
        console.error('Stack:', error.stack);
      }
    }
    process.exit(1);
  }
}

yargs(hideBin(process.argv))
  .scriptName('test-similar-search')
  .usage('$0 <cmd> [args]')
  .command(
    'search',
    'Search for similar quizzes by description',
    (yargs) => {
      return yargs
        .option('filter', {
          describe: 'MongoDB filter query (e.g. "subject:anatomy")',
          type: 'string',
          default: '',
        })
        .option('search', {
          describe: 'Text to find similar quizzes for',
          type: 'string',
          demandOption: true,
        })
        .option('verbose', {
          describe: 'Enable verbose logging',
          type: 'boolean',
          default: false,
        });
    },
    async (argv) => {
      const results = await searchSimilarQuizzes(
        argv.filter,
        argv.search,
        argv.verbose,
      );
      console.log(JSON.stringify(results, null, 2));
    },
  )
  .command(
    'test',
    'Run a quick test search (anatomy questions about heart)',
    () => {},
    async () => {
      console.log('Running test search...');
      const results = await searchSimilarQuizzes(
        'cls like \"内科学\"',
        `| 情况                  | 选药                               | 禁用药         |
| ------------------- | -------------------------------- | ----------- |
| 无合并症中老年(盐敏感,2015)   | **利尿剂**、**CCB**                  |             |
| 糖尿病、蛋白尿(2013, 2021) | **ACEI/ARB**                     |             |
| 痛风                  | **ARB**、**CCB**                  |             |
| 冠心病                 | **β-R阻断剂**、**ACEI/ARB**、**维拉帕米** |             |
| 心率慢                 | **[[氨氯地平(Amlodipine)]]**         |             |
| 支气管哮喘、变异型心绞痛、雷诺病    | **CCB**                          | **β受体阻断剂**  |
| [[前列腺肥大]]           | **[[哌唑嗪]]**(不单用)                 | **CCB**     |
| 消化性溃疡               | **[[可乐定(clonidine)]]**(不单用)      | **[[利血平]]** |`,
      );
      console.log(JSON.stringify(results, null, 2));
    },
  )
  .demandCommand(1, 'You need at least one command')
  .help()
  .parse();
