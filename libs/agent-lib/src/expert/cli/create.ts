/**
 * Expert Create CLI - 创建新的Expert模板
 * 
 * Usage:
 *   npx tsx src/expert/cli/index.ts create <expert-name>
 *   npx tsx src/expert/cli/index.ts create my-new-expert
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';

/**
 * Expert模板配置
 */
interface ExpertTemplateConfig {
  expertId: string;
  displayName: string;
  description: string;
}

/**
 * 生成config.json模板
 */
function generateConfigJson(config: ExpertTemplateConfig): string {
  return JSON.stringify({
    id: config.expertId,
    displayName: config.displayName,
    description: config.description,
    version: '1.0.0',
    category: 'general',
    tags: [],
    triggers: [config.expertId],
    whenToUse: `Use this Expert when you need to ${config.description.toLowerCase()}`,
    export: {
      autoExport: false,
      bucket: 'agentfs',
      defaultPath: '{expertId}/{timestamp}.json'
    }
  }, null, 2);
}

/**
 * 生成sop.yaml模板
 */
function generateSopYaml(config: ExpertTemplateConfig): string {
  return `# Expert Standard Operating Procedure (SOP)
# This file defines the Expert's behavior and prompts

overview: |-
  ${config.displayName} - ${config.description}

responsibilities:
  - Process user input
  - Execute tasks
  - Generate output

constraints:
  - Always validate input before processing
  - Handle errors gracefully

parameters:
  - name: input
    type: string
    required: true
    description: The input to process

steps:
  - phase: THINKING
    description: Analyze the input and plan the execution
    details: |-
      1. Parse and validate the input
      2. Identify the required actions
      3. Plan the execution sequence

  - phase: ACTION
    description: Execute the planned actions
    details: |-
      1. Execute the planned actions
      2. Monitor progress
      3. Handle any errors

  - phase: OUTPUT
    description: Generate and format the output
    details: |-
      1. Collect results
      2. Format output
      3. Export if configured

examples:
  - input: |-
      {"query": "example query"}
    output: |-
      {"status": "success", "result": "processed"}
    description: Basic example showing input/output format
`;
}

/**
 * 生成Workspace.ts模板
 *
 * @param config - Expert配置
 * @param isExternal - 是否为外部项目（非agent-lib内置）
 */
function generateWorkspaceTs(config: ExpertTemplateConfig, isExternal: boolean = false): string {
  const className = toPascalCase(config.expertId) + 'Workspace';

  // 统一使用 'agent-lib' 包导入
  const baseImportPath = 'agent-lib';

  return `/**
 * ${config.displayName} Workspace
 *
 * 运行时工作空间 - 用于定义组件
 * 继承 ExpertWorkspaceBase 以获得输入/输出处理能力
 */

import { ExpertWorkspaceBase } from '${baseImportPath}';
import type { ValidationResult } from '${baseImportPath}';
// import { MyComponent } from './components/MyComponent.js';

/**
 * ${className} - 运行时工作空间
 *
 * 继承 ExpertWorkspaceBase 以获得静态方法
 * 用于 createExpertConfig 工厂函数
 */
export class ${className} extends ExpertWorkspaceBase {

  // ==================== 组件定义 ====================

  /**
   * 获取组件列表
   *
   * 支持三种方式定义组件：
   * 1. 直接实例: new MyComponent()
   * 2. 工厂函数: () => new MyComponent()
   * 3. 异步工厂: async () => await createComponent()
   *
   * 示例:
   * // 直接实例
   * static override getComponents() {
   *   return [new MyComponent()];
   * }
   *
   * // 工厂函数
   * static override getComponents() {
   *   return [() => new AnotherComponent()];
   * }
   *
   * // 带自定义ID
   * static override getComponentsWithIds() {
   *   return [{ id: 'my-component', component: new MyComponent() }];
   * }
   */
  static override getComponents() {
    return [
      // 添加组件实例或工厂函数
      // new MyComponent(),
      // () => new AnotherComponent(),
    ];
  }

  // ==================== 输入处理 ====================

  /**
   * 验证输入
   */
  static override validateInput(input: Record<string, any>): ValidationResult {
    return { valid: true };
  }

  /**
   * 转换输入格式
   */
  static override transformInput(input: Record<string, any>): Record<string, any> {
    return input;
  }
}
`;
}

/**
 * 生成index.ts模板
 *
 * @param config - Expert配置
 * @param isExternal - 是否为外部项目（非agent-lib内置）
 */
function generateIndexTs(config: ExpertTemplateConfig, isExternal: boolean = false): string {
  // 外部项目使用包导入 'agent-lib'
  // 内部项目（agent-lib源码）也使用 'agent-lib'，因为运行时它已经是构建后的包
  const importPath = 'agent-lib';
  const className = toPascalCase(config.expertId) + 'Workspace';

  return `/**
 * ${config.displayName} - Factory Function
 *
 * 使用 ExpertFactory 自动加载配置，无需样板代码
 *
 * 使用方式：
 *   import { createExpertConfig } from '${importPath}';
 *   import { ${className} } from './Workspace.js';
 *   export default createExpertConfig(import.meta.url, ${className});
 */

import { createExpertConfig } from '${importPath}';
import { ${className} } from './Workspace.js';

export default createExpertConfig(import.meta.url, ${className});
`;
}

/**
 * 转换为PascalCase
 */
function toPascalCase(str: string): string {
  return str
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

/**
 * 创建Expert模板
 *
 * @param expertName - Expert名称
 * @param outputDir - 可选的输出目录，默认为当前工作目录下的experts/
 */
export async function createExpert(expertName: string, outputDir?: string): Promise<void> {
  // 验证expert名称
  if (!expertName || !/^[a-z][a-z0-9-]*$/.test(expertName)) {
    console.log(chalk.red('\n❌ Invalid expert name'));
    console.log(chalk.gray('  Expert name must start with lowercase letter and contain only lowercase letters, numbers, and hyphens'));
    console.log(chalk.gray('  Example: my-expert, pubmed-search, data-processor\n'));
    process.exit(1);
  }

  // 获取目标目录 - 支持自定义输出路径
  // 默认生成在当前工作目录的experts/下，而不是agent-lib的builtin目录
  const baseDir = outputDir || join(process.cwd(), 'experts');
  const expertDir = join(baseDir, expertName);

  // 检查是否已存在
  if (existsSync(expertDir)) {
    console.log(chalk.red(`\n❌ Expert "${expertName}" already exists`));
    console.log(chalk.gray(`  Path: ${expertDir}\n`));
    process.exit(1);
  }

  console.log(chalk.bold.cyan('\n⚡ Creating Expert Template'));
  console.log(chalk.gray('─'.repeat(40)));
  console.log(chalk.gray(`  Expert ID: ${expertName}`));
  console.log(chalk.gray(`  Directory: ${expertDir}`));

  // 创建配置
  const config: ExpertTemplateConfig = {
    expertId: expertName,
    displayName: toPascalCase(expertName).replace(/([A-Z])/g, ' $1').trim(),
    description: `A new Expert for ${expertName.replace(/-/g, ' ')}`,
  };

  // 检测是否为外部项目（非agent-lib内置）
  // 通过检查当前工作目录是否为agent-lib包本身来判断
  // agent-lib包的路径会以/libs/agent-lib或\libs\agent-lib结尾，或包含/libs/agent-lib/路径
  const cwd = process.cwd();
  const isAgentLibPackage =
    cwd.endsWith('/libs/agent-lib') ||
    cwd.endsWith('\\libs\\agent-lib') ||
    cwd.includes('/libs/agent-lib/') ||
    cwd.includes('\\libs\\agent-lib\\');
  const isExternal = !isAgentLibPackage;

  try {
    // 创建目录
    mkdirSync(expertDir, { recursive: true });
    console.log(chalk.green('  ✓ Created directory'));

    // 写入config.json
    writeFileSync(join(expertDir, 'config.json'), generateConfigJson(config));
    console.log(chalk.green('  ✓ Created config.json'));

    // 写入sop.yaml
    writeFileSync(join(expertDir, 'sop.yaml'), generateSopYaml(config));
    console.log(chalk.green('  ✓ Created sop.yaml'));

    // 写入Workspace.ts - 传递isExternal标志
    writeFileSync(join(expertDir, 'Workspace.ts'), generateWorkspaceTs(config, isExternal));
    console.log(chalk.green('  ✓ Created Workspace.ts'));

    // 写入index.ts - 传递isExternal标志
    writeFileSync(join(expertDir, 'index.ts'), generateIndexTs(config, isExternal));
    console.log(chalk.green('  ✓ Created index.ts'));

    console.log(chalk.bold.green('\n✅ Expert template created successfully!\n'));
    if (isExternal) {
      console.log(chalk.gray('This Expert is in an external project.'));
      console.log(chalk.gray('Make sure agent-lib is installed as a dependency.\n'));
    }
    console.log(chalk.gray('Next steps:'));
    console.log(chalk.gray(`  1. Edit config.json to add metadata`));
    console.log(chalk.gray(`  2. Edit sop.yaml to define behavior`));
    console.log(chalk.gray(`  3. Edit Workspace.ts to add components`));
    console.log(chalk.gray(`  4. Import and use the Expert in your application\n`));

  } catch (error) {
    console.log(chalk.red(`\n❌ Failed to create expert: ${error instanceof Error ? error.message : String(error)}\n`));
    process.exit(1);
  }
}

/**
 * CLI entry point
 */
export async function createExpertCLI(): Promise<void> {
  const args = process.argv.slice(3); // Skip 'node' and 'cli.ts'

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log(chalk.bold.cyan('\nExpert Create CLI\n'));
    console.log(chalk.gray('Usage:'));
    console.log(chalk.gray('  expert-cli create <expert-name>'));
    console.log(chalk.gray('  expert-cli create my-new-expert\n'));
    console.log(chalk.gray('Options:'));
    console.log(chalk.gray('  --help, -h   Show this help message\n'));
    return;
  }

  const expertName = args[0];
  await createExpert(expertName);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  createExpertCLI().catch(console.error);
}
