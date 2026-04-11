import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { TestSuite } from '../types.js';

/**
 * Load a test suite from a YAML or JSON file.
 */
export function loadTestSuite(filePath: string): TestSuite {
  const absolutePath = resolve(process.cwd(), filePath);
  const content = readFileSync(absolutePath, 'utf-8');

  if (filePath.endsWith('.yaml') || filePath.endsWith('.yml')) {
    return parseYaml(content) as TestSuite;
  }

  if (filePath.endsWith('.json')) {
    return JSON.parse(content) as TestSuite;
  }

  throw new Error(
    `Unsupported test file format: ${filePath}. Use .yaml, .yml, or .json`,
  );
}
