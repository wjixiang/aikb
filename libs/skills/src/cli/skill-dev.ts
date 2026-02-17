#!/usr/bin/env node

/**
 * CLI Tool for Automatic Skill Development
 *
 * Usage:
 *   skill-dev start --workspace <workspace-path> --name <skill-name> --description <desc>
 *   skill-dev status <session-id>
 *   skill-dev feedback <session-id> --type <approve|reject|improve> --comments <text>
 *   skill-dev report <session-id>
 *   skill-dev list
 */

import { Command } from 'commander';
import { AutoSkillDeveloper } from '../builder/AutoSkillDeveloper.js';
import type { ApiClient } from 'agent-lib';
import * as fs from 'fs/promises';
import * as path from 'path';

const program = new Command();

// Global state file for sessions
const STATE_FILE = './.skill-dev-state.json';

// Load or create API client
async function getApiClient(): Promise<ApiClient> {
  // TODO: Load from config
  // For now, return a mock or configured client
  throw new Error('API client not configured. Please set up your API client.');
}

// Load workspace from path
async function loadWorkspace(workspacePath: string): Promise<any> {
  // Dynamic import of workspace
  const workspaceModule = await import(path.resolve(workspacePath));

  // Try default export first, then fall back to first named export
  let WorkspaceClass = workspaceModule.default;

  if (!WorkspaceClass) {
    const keys = Object.keys(workspaceModule);
    if (keys.length > 0) {
      const firstKey = keys[0];
      WorkspaceClass = workspaceModule[firstKey as keyof typeof workspaceModule];
    }
  }

  if (!WorkspaceClass) {
    throw new Error(`No workspace class found in ${workspacePath}. Please ensure the module exports a default or named class.`);
  }

  return new WorkspaceClass();
}

// Save session state
async function saveState(autoDev: AutoSkillDeveloper): Promise<void> {
  const sessions = autoDev.listSessions();
  const state = sessions.map(s => ({
    sessionId: s.sessionId,
    skillName: s.request.skillName,
    status: s.status,
    iterations: s.iterations,
    score: s.evaluations[s.evaluations.length - 1]?.metrics.overallScore
  }));

  await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2));
}

// Load session state
async function loadState(): Promise<any[]> {
  try {
    const data = await fs.readFile(STATE_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

// Commands

program
  .name('skill-dev')
  .description('Automatic Skill Development CLI')
  .version('1.0.0');

program
  .command('start')
  .description('Start a new auto-development session')
  .requiredOption('-w, --workspace <path>', 'Path to workspace module')
  .requiredOption('-n, --name <name>', 'Skill name')
  .requiredOption('-d, --description <desc>', 'Skill description')
  .option('-c, --category <category>', 'Skill category', 'general')
  .option('-t, --target-score <score>', 'Target quality score', '80')
  .option('-i, --max-iterations <num>', 'Maximum iterations', '5')
  .option('-o, --output <dir>', 'Output directory', './libs/skills/repository/generated')
  .option('-e, --examples <json>', 'Examples as JSON string')
  .action(async (options) => {
    try {
      console.log('Starting auto-development session...\n');

      const apiClient = await getApiClient();
      const workspace = await loadWorkspace(options.workspace);
      const autoDev = new AutoSkillDeveloper(apiClient);

      const examples = options.examples ? JSON.parse(options.examples) : undefined;

      const sessionId = await autoDev.startAutoDevSession({
        workspace,
        skillName: options.name,
        description: options.description,
        category: options.category,
        examples,
        targetScore: parseInt(options.targetScore),
        maxIterations: parseInt(options.maxIterations),
        outputDir: options.output
      });

      console.log(`✓ Session started: ${sessionId}`);
      console.log(`\nMonitor progress with: skill-dev status ${sessionId}`);

      await saveState(autoDev);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Check session status')
  .argument('<session-id>', 'Session ID')
  .action(async (sessionId) => {
    try {
      const apiClient = await getApiClient();
      const autoDev = new AutoSkillDeveloper(apiClient);

      const session = autoDev.getSession(sessionId);
      if (!session) {
        console.error('Session not found');
        process.exit(1);
      }

      console.log('\n=== Session Status ===\n');
      console.log(`Session ID: ${session.sessionId}`);
      console.log(`Skill Name: ${session.request.skillName}`);
      console.log(`Status: ${session.status}`);
      console.log(`Iterations: ${session.iterations}`);

      if (session.evaluations.length > 0) {
        const latest = session.evaluations[session.evaluations.length - 1];
        console.log(`\nLatest Score: ${latest.metrics.overallScore}/100`);
        console.log(`Test Pass Rate: ${(latest.metrics.testPassRate * 100).toFixed(1)}%`);
        console.log(`Code Quality: ${(latest.metrics.codeQuality * 100).toFixed(1)}%`);
        console.log(`Documentation: ${(latest.metrics.documentation * 100).toFixed(1)}%`);
      }

      if (session.error) {
        console.log(`\nError: ${session.error}`);
      }

      if (session.status === 'awaiting_feedback') {
        console.log('\n⚠ Awaiting human feedback');
        console.log(`Provide feedback with: skill-dev feedback ${sessionId} --type <approve|reject|improve>`);
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('feedback')
  .description('Submit human feedback')
  .argument('<session-id>', 'Session ID')
  .requiredOption('-t, --type <type>', 'Feedback type: approve, reject, or improve')
  .option('-c, --comments <text>', 'Feedback comments')
  .option('-s, --suggestions <json>', 'Suggestions as JSON array')
  .option('-e, --examples <json>', 'Additional examples as JSON')
  .action(async (sessionId, options) => {
    try {
      const apiClient = await getApiClient();
      const autoDev = new AutoSkillDeveloper(apiClient);

      const suggestions = options.suggestions ? JSON.parse(options.suggestions) : undefined;
      const additionalExamples = options.examples ? JSON.parse(options.examples) : undefined;

      await autoDev.submitFeedback({
        sessionId,
        type: options.type,
        comments: options.comments,
        suggestions,
        additionalExamples
      });

      console.log(`✓ Feedback submitted: ${options.type}`);

      if (options.type === 'approve') {
        console.log('Skill has been approved and saved');
      } else if (options.type === 'improve') {
        console.log('Skill is being improved based on your feedback');
        console.log(`Check status with: skill-dev status ${sessionId}`);
      }

      await saveState(autoDev);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('report')
  .description('Generate session report')
  .argument('<session-id>', 'Session ID')
  .option('-o, --output <file>', 'Output file (default: stdout)')
  .action(async (sessionId, options) => {
    try {
      const apiClient = await getApiClient();
      const autoDev = new AutoSkillDeveloper(apiClient);

      const report = await autoDev.generateReport(sessionId);

      if (options.output) {
        await fs.writeFile(options.output, report);
        console.log(`✓ Report saved to ${options.output}`);
      } else {
        console.log(report);
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('list')
  .description('List all sessions')
  .action(async () => {
    try {
      const sessions = await loadState();

      if (sessions.length === 0) {
        console.log('No sessions found');
        return;
      }

      console.log('\n=== Auto-Dev Sessions ===\n');
      console.log('ID\t\t\t\tSkill Name\t\t\tStatus\t\tScore\tIterations');
      console.log('-'.repeat(100));

      for (const session of sessions) {
        const id = session.sessionId.substring(0, 20) + '...';
        const name = session.skillName.padEnd(30);
        const status = session.status.padEnd(15);
        const score = session.score ? `${session.score}/100` : 'N/A';
        const iterations = session.iterations;

        console.log(`${id}\t${name}\t${status}\t${score}\t${iterations}`);
      }

      console.log();
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program.parse();
