/**
 * Task Module Usage Examples
 * 
 * This file demonstrates how to use the Task Module with various
 * collectors and validators for different scenarios.
 */

import {
    TaskModule,
    createTask,
    createTextCollector,
    createToolCallCollector,
    createCompositeCollector,
    createSchemaValidator,
    createSimpleValidator,
    createPredicateValidator,
    createTodoItem,
    type TaskCreationConfig,
    type ITask,
} from '../index.js';

// ==================== Example 1: Basic Text Collection ====================

/**
 * Example 1: Basic text collection with simple validation
 */
export function example1_BasicTextCollection() {
    const taskModule = new TaskModule();

    // Create a task with text collector and simple validator
    const task = taskModule.createTask({
        id: 'task-1',
        description: 'Collect user feedback',
        collector: createTextCollector(),
        validator: createSimpleValidator(
            'non-empty-text',
            (data) => typeof data === 'string' && data.length > 0,
            'Text must not be empty'
        ),
        priority: 'high',
    });

    // Collect some data
    const result = task.collect('This is great feedback!');
    console.log('Collected:', result);

    // Validate the result
    const validation = task.validate(result);
    console.log('Validation:', validation);

    // Mark task as complete
    task.complete(result.data);

    return { taskModule, task };
}

// ==================== Example 2: Tool Call Collection ====================

/**
 * Example 2: Tool call collection with schema validation
 */
export function example2_ToolCallCollection() {
    const taskModule = new TaskModule();

    // Define a schema for tool call results
    const toolCallSchema = {
        type: 'object',
        properties: {
            name: { type: 'string' },
            arguments: { type: 'object' },
            result: { type: 'any' },
        },
        required: ['name', 'arguments'],
    };

    // Create a task for tool calls
    const task = taskModule.createTask({
        id: 'task-2',
        description: 'Execute tool calls',
        collector: createToolCallCollector(),
        validator: createSchemaValidator(toolCallSchema),
    });

    // Collect a tool call result
    const toolCallData = {
        name: 'search_files',
        arguments: { pattern: '*.ts' },
        result: { files: ['file1.ts', 'file2.ts'] },
    };

    const result = task.collect(toolCallData);
    console.log('Collected tool call:', result);

    return { taskModule, task };
}

// ==================== Example 3: Composite Collector ====================

/**
 * Example 3: Using composite collector to handle multiple data types
 */
export function example3_CompositeCollector() {
    const taskModule = new TaskModule();

    // Create a composite collector that tries multiple collectors
    const compositeCollector = createCompositeCollector([
        createTextCollector(),
        createToolCallCollector(),
    ]);

    const task = taskModule.createTask({
        id: 'task-3',
        description: 'Handle multiple data types',
        collector: compositeCollector,
        validator: createPredicateValidator(
            'has-data',
            (data) => data !== null && data !== undefined
        ),
    });

    // Can collect both text and tool calls
    const textResult = task.collect('Some text data');
    const toolCallResult = task.collect({
        name: 'some_tool',
        arguments: {},
    });

    console.log('Text result:', textResult);
    console.log('Tool call result:', toolCallResult);

    return { taskModule, task };
}

// ==================== Example 4: Hierarchical TODO List ====================

/**
 * Example 4: Creating hierarchical TODO lists with Level-2 items
 */
export function example4_HierarchicalTodoList() {
    const taskModule = new TaskModule();

    // Create Level-1 tasks (hardcoded)
    const analysisTask = taskModule.createTask({
        id: 'analyze-code',
        description: 'Analyze the codebase',
        collector: createTextCollector(),
        validator: createSimpleValidator(
            'has-analysis',
            (data) => typeof data === 'string' && data.includes('analysis')
        ),
    });

    const docTask = taskModule.createTask({
        id: 'generate-docs',
        description: 'Generate documentation',
        collector: createTextCollector(),
        validator: createSimpleValidator(
            'has-docs',
            (data) => typeof data === 'string' && data.length > 100
        ),
    });

    // Add Level-2 subtasks (simulating LLM-created items)
    taskModule.addLevel2TodoItem({
        id: 'analyze-code-1',
        description: 'Identify main components',
        parentId: 'analyze-code',
        level: 2,
        status: 'pending',
    });

    taskModule.addLevel2TodoItem({
        id: 'analyze-code-2',
        description: 'Review dependencies',
        parentId: 'analyze-code',
        level: 2,
        status: 'pending',
    });

    taskModule.addLevel2TodoItem({
        id: 'generate-docs-1',
        description: 'Write API documentation',
        parentId: 'generate-docs',
        level: 2,
        status: 'pending',
    });

    // Render the TODO list for LLM
    const todoList = taskModule.renderTodoListForPrompt({ format: 'markdown' });
    console.log('TODO List:\n', todoList);

    return { taskModule, analysisTask, docTask };
}

// ==================== Example 5: Custom Collector ====================

/**
 * Example 5: Creating a custom collector
 */
import type { IResultCollector, CollectedResult, CollectionContext } from '../types.js';

class CodeAnalysisCollector implements IResultCollector {
    readonly type = 'code-analysis';

    collect(data: unknown, context?: CollectionContext): CollectedResult {
        // Custom logic to analyze code
        const code = typeof data === 'string' ? data : JSON.stringify(data);
        const lines = code.split('\n').length;
        const functions = (code.match(/function\s+\w+/g) || []).length;
        const classes = (code.match(/class\s+\w+/g) || []).length;

        return {
            type: this.type,
            data: {
                lines,
                functions,
                classes,
                complexity: functions + classes * 2,
            },
            metadata: {
                source: context?.source || 'external',
                originalLength: code.length,
            },
            timestamp: Date.now(),
        };
    }

    canCollect(data: unknown): boolean {
        return typeof data === 'string' || typeof data === 'object';
    }
}

export function example5_CustomCollector() {
    const taskModule = new TaskModule();

    const task = taskModule.createTask({
        id: 'code-analysis',
        description: 'Analyze code complexity',
        collector: new CodeAnalysisCollector(),
        validator: createPredicateValidator(
            'has-complexity',
            (data) => typeof data === 'object' && data !== null && 'complexity' in data
        ),
    });

    const code = `
        function hello() {
            console.log('Hello');
        }
        
        class Calculator {
            add(a, b) { return a + b; }
        }
    `;

    const result = task.collect(code);
    console.log('Code analysis result:', result);

    return { taskModule, task };
}

// ==================== Example 6: Batch Operations ====================

/**
 * Example 6: Batch collection and validation
 */
export async function example6_BatchOperations() {
    const taskModule = new TaskModule();

    // Create multiple tasks
    const tasks = [
        taskModule.createTask({
            id: 'task-a',
            description: 'Task A',
            collector: createTextCollector(),
            validator: createSimpleValidator('non-empty', (d) => d !== ''),
        }),
        taskModule.createTask({
            id: 'task-b',
            description: 'Task B',
            collector: createTextCollector(),
            validator: createSimpleValidator('non-empty', (d) => d !== ''),
        }),
        taskModule.createTask({
            id: 'task-c',
            description: 'Task C',
            collector: createTextCollector(),
            validator: createSimpleValidator('non-empty', (d) => d !== ''),
        }),
    ];

    // Batch collect results
    const collectionReport = taskModule.collectResults([
        { taskId: 'task-a', data: 'Result A' },
        { taskId: 'task-b', data: 'Result B' },
        { taskId: 'task-c', data: 'Result C' },
    ]);

    console.log('Collection report:', collectionReport);

    // Batch validate results
    const validationReport = await taskModule.validateResults([
        { taskId: 'task-a', result: collectionReport.results['task-a']! },
        { taskId: 'task-b', result: collectionReport.results['task-b']! },
        { taskId: 'task-c', result: collectionReport.results['task-c']! },
    ]);

    console.log('Validation report:', validationReport);

    return { taskModule, tasks };
}

// ==================== Example 7: Event Subscriptions ====================

/**
 * Example 7: Subscribing to task events
 */
export function example7_EventSubscriptions() {
    const taskModule = new TaskModule();

    const task = taskModule.createTask({
        id: 'event-example',
        description: 'Demonstrate event subscriptions',
        collector: createTextCollector(),
        validator: createSimpleValidator('non-empty', (d) => d !== ''),
    });

    // Subscribe to result events
    task.onResult((task, result) => {
        console.log(`[Event] Result collected for task ${task.id}:`, result);
    });

    // Subscribe to completion events
    task.onComplete((task, finalResult) => {
        console.log(`[Event] Task ${task.id} completed with:`, finalResult);
    });

    // Subscribe to error events
    task.onError((task, error) => {
        console.error(`[Event] Task ${task.id} failed:`, error.message);
    });

    // Trigger events
    const result = task.collect('Some data');
    task.complete(result.data);

    return { taskModule, task };
}

// ==================== Example 8: Task Context Summary ====================

/**
 * Example 8: Getting task context summary
 */
export function example8_TaskContextSummary() {
    const taskModule = new TaskModule();

    // Create tasks with different statuses
    taskModule.createTask({
        id: 'completed-task',
        description: 'A completed task',
        collector: createTextCollector(),
        validator: createSimpleValidator('always-valid', () => true),
    });

    const inProgressTask = taskModule.createTask({
        id: 'in-progress-task',
        description: 'A task in progress',
        collector: createTextCollector(),
        validator: createSimpleValidator('always-valid', () => true),
    });

    // Update task status
    const completedTask = taskModule.getTask('completed-task')!;
    completedTask.updateStatus('completed');

    inProgressTask.updateStatus('in_progress');

    // Get context summary
    const summary = taskModule.getTaskContextSummary();
    console.log('Task summary:', summary);

    return { taskModule, summary };
}

// ==================== Main Export ====================

/**
 * Run all examples
 */
export async function runAllExamples() {
    console.log('=== Example 1: Basic Text Collection ===');
    example1_BasicTextCollection();

    console.log('\n=== Example 2: Tool Call Collection ===');
    example2_ToolCallCollection();

    console.log('\n=== Example 3: Composite Collector ===');
    example3_CompositeCollector();

    console.log('\n=== Example 4: Hierarchical TODO List ===');
    example4_HierarchicalTodoList();

    console.log('\n=== Example 5: Custom Collector ===');
    example5_CustomCollector();

    console.log('\n=== Example 6: Batch Operations ===');
    await example6_BatchOperations();

    console.log('\n=== Example 7: Event Subscriptions ===');
    example7_EventSubscriptions();

    console.log('\n=== Example 8: Task Context Summary ===');
    example8_TaskContextSummary();
}
