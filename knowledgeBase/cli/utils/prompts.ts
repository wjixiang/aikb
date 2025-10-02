import { input, select, confirm } from '@inquirer/prompts';
import { EntityData, KnowledgeData } from '../../knowledge.type';

/**
 * Prompt for entity creation
 * @returns Promise resolving to entity data
 */
export async function promptForEntityCreation(): Promise<EntityData> {
  console.log('\n🔍 创建新实体\n');
  
  const name = await input({
    message: '请输入实体名称:',
    validate: (input) => input.trim() !== '' || '实体名称不能为空',
  });
  
  const addTags = await confirm({
    message: '是否要添加标签?',
    default: false,
  });
  
  let tags: string[] = [];
  if (addTags) {
    const tagsInput = await input({
      message: '请输入标签 (用逗号分隔):',
    });
    tags = tagsInput.split(',').map(tag => tag.trim()).filter(tag => tag !== '');
  }
  
  const definition = await input({
    message: '请输入实体定义:',
    validate: (input) => input.trim() !== '' || '实体定义不能为空',
  });
  
  return {
    name: [name.trim()],
    tags,
    definition: definition.trim(),
  };
}

/**
 * Prompt for knowledge creation
 * @returns Promise resolving to knowledge data
 */
export async function promptForKnowledgeCreation(): Promise<{
  entityId: string;
  knowledgeData: KnowledgeData;
}> {
  console.log('\n📚 创建新知识\n');
  
  const entityId = await input({
    message: '请输入关联的实体ID:',
    validate: (input) => input.trim() !== '' || '实体ID不能为空',
  });
  
  const scope = await input({
    message: '请输入知识范围/标题:',
    validate: (input) => input.trim() !== '' || '知识范围不能为空',
  });
  
  const content = await input({
    message: '请输入知识内容:',
    validate: (input) => input.trim() !== '' || '知识内容不能为空',
  });
  
  return {
    entityId: entityId.trim(),
    knowledgeData: {
      scope: scope.trim(),
      content: content.trim(),
      childKnowledgeId: [],
    },
  };
}

/**
 * Prompt for natural language knowledge creation
 * @returns Promise resolving to entity ID and natural language text
 */
export async function promptForNaturalLanguageKnowledge(): Promise<{
  entityId: string;
  naturalLanguageText: string;
}> {
  console.log('\n📝 从自然语言创建知识\n');
  
  const entityId = await input({
    message: '请输入关联的实体ID:',
    validate: (input) => input.trim() !== '' || '实体ID不能为空',
  });
  
  const naturalLanguageText = await input({
    message: '请输入自然语言文本:',
    validate: (input) => input.trim() !== '' || '自然语言文本不能为空',
  });
  
  return {
    entityId: entityId.trim(),
    naturalLanguageText: naturalLanguageText.trim(),
  };
}

/**
 * Prompt for knowledge ID to render
 * @returns Promise resolving to knowledge ID
 */
export async function promptForKnowledgeId(): Promise<string> {
  console.log('\n📄 渲染Markdown\n');
  
  const knowledgeId = await input({
    message: '请输入要渲染的知识ID:',
    validate: (input) => input.trim() !== '' || '知识ID不能为空',
  });
  
  return knowledgeId.trim();
}

/**
 * Prompt for output file path
 * @param defaultPath Default file path
 * @returns Promise resolving to file path
 */
export async function promptForOutputPath(defaultPath: string = './output.md'): Promise<string> {
  const outputPath = await input({
    message: '请输入输出文件路径:',
    default: defaultPath,
  });
  
  return outputPath.trim();
}

/**
 * Display success message
 * @param message Success message
 */
export function displaySuccess(message: string): void {
  console.log(`\n✅ ${message}`);
}

/**
 * Display error message
 * @param message Error message
 */
export function displayError(message: string): void {
  console.log(`\n❌ ${message}`);
}

/**
 * Display info message
 * @param message Info message
 */
export function displayInfo(message: string): void {
  console.log(`\nℹ️  ${message}`);
}

/**
 * Display warning message
 * @param message Warning message
 */
export function displayWarning(message: string): void {
  console.log(`\n⚠️  ${message}`);
}

/**
 * Confirm action
 * @param message Confirmation message
 * @returns Promise resolving to boolean
 */
export async function confirmAction(message: string): Promise<boolean> {
  return await confirm({
    message,
    default: false,
  });
}

/**
 * Select from options
 * @param message Selection message
 * @param choices Array of choices
 * @returns Promise resolving to selected choice
 */
export async function selectFromOptions(
  message: string,
  choices: string[]
): Promise<string> {
  return await select({
    message,
    choices: choices.map(choice => ({ name: choice, value: choice })),
  });
}