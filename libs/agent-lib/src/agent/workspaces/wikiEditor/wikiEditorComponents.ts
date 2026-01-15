import { z } from 'zod';
import { WorkspaceComponent, ComponentState, ComponentProps } from '../../componentTypes';
import { parseXMLCommands, CommandParseError } from './wikiEditorCommandParser';
import { executeCommand, CommandExecutionError, CommandResult } from './wikiEditorCommandExecutor';
import { XML_COMMAND_SCHEMA } from './wikiEditorCommandTypes';

/**
 * Result of executing edit commands on the wiki editor
 */
export interface WikiEditorExecutionResult {
    success: boolean;
    error?: string;
    results: CommandResult[];
    previousContent: string;
    newContent: string;
    totalChanges: number;
}

/**
 * Wiki Editor Component
 * Provides XML-based editing commands for modifying wiki document content
 */
export class WikiEditorComponents extends WorkspaceComponent {
    constructor() {
        super(
            'wiki_editor',
            'Wiki Editor',
            `A powerful, LLM-friendly, text-based application for knowledge management.
- This application provides capabilities to exploring and editing notes accumulated in the knowledge vault.
- The content of Interface Area will refresh each conversation based on your modification of editable props. To change editable props, you have two methods:
  1. Direct Modification: select props field and input desired value directly
  2. Indirect Modification: input specific commands to excute props modification 

`,
            {
                edit_command: {
                    value: null,
                    schema: z.string().nullable(),
                    description: `Edit command to modify the current wiki document content. Use XML-based commands to make changes to the document.

${XML_COMMAND_SCHEMA}

Examples:
---------
Insert a new section after a header:
<insert>
  <after>## Introduction</after>
  <content>## New Section

This is new content.
</content>
</insert>

Replace text:
<replace>
  <search>old text</search>
  <replace_text>new text</replace_text>
</replace>

Delete a section:
<delete>
  <search>## Section to Delete</search>
</delete>

Append content:
<append>
  <content>Additional content at the end</content>
</append>

Batch operations:
<batch>
  <stop_on_error>false</stop_on_error>
  <commands>
    <append>
      <content>Additional content</content>
    </append>
    <replace>
      <search>foo</search>
      <replace_text>bar</replace_text>
    </replace>
  </commands>
</batch>
`,
                    readonly: false
                },
                file_command: {
                    value: null,
                    schema: z.string().nullable(),
                    description: '',
                    readonly: false
                }
            },
            {}
        );
        this.state['current_editor_content'] = '';
        this.state['last_execution_result'] = null;
        this.state['command_history'] = [];

        // Set up side effect to execute edit commands when they change
        this.useEffect(
            'execute_edit_command',
            ['edit_command'],
            async (dependencies) => {
                const editCommand = dependencies['edit_command'] as string | null;
                if (editCommand) {
                    await this.executeEditCommand(editCommand);
                }
            },
            { stopOnError: false, retryable: false }
        );
    }

    /**
     * Execute an XML edit command on the current content
     */
    private async executeEditCommand(xmlCommand: string): Promise<void> {
        const previousContent = this.state['current_editor_content'] as string || '';

        try {
            // Parse the XML command(s)
            const commands = parseXMLCommands(xmlCommand);

            if (commands.length === 0) {
                throw new Error('No valid commands found in XML');
            }

            // Execute all commands
            const results: CommandResult[] = [];
            let currentContent = previousContent;
            let totalChanges = 0;
            let hasError = false;
            let errorMessage = '';

            for (const command of commands) {
                try {
                    const result = executeCommand(currentContent, command);
                    results.push(result);
                    currentContent = result.newContent;
                    totalChanges += result.changes;

                    if (!result.success) {
                        hasError = true;
                        errorMessage = result.error || 'Command execution failed';
                        break;
                    }
                } catch (error) {
                    hasError = true;
                    errorMessage = error instanceof Error ? error.message : String(error);
                    results.push({
                        success: false,
                        command,
                        error: errorMessage,
                        previousContent: currentContent,
                        newContent: currentContent,
                        changes: 0
                    });
                    break;
                }
            }

            // Update the content
            this.state['current_editor_content'] = currentContent;

            // Store execution result
            const executionResult: WikiEditorExecutionResult = {
                success: !hasError,
                error: hasError ? errorMessage : undefined,
                results,
                previousContent,
                newContent: currentContent,
                totalChanges
            };

            this.state['last_execution_result'] = executionResult;

            // Add to command history
            const history = this.state['command_history'] as Array<{
                timestamp: Date;
                command: string;
                result: WikiEditorExecutionResult;
            }> || [];
            history.push({
                timestamp: new Date(),
                command: xmlCommand,
                result: executionResult
            });
            this.state['command_history'] = history;

        } catch (error) {
            // Store error result
            const executionResult: WikiEditorExecutionResult = {
                success: false,
                error: error instanceof Error ? error.message : String(error),
                results: [],
                previousContent,
                newContent: previousContent,
                totalChanges: 0
            };

            this.state['last_execution_result'] = executionResult;
        }
    }

    /**
     * Get the current editor content
     */
    getContent(): string {
        return this.state['current_editor_content'] as string || '';
    }

    /**
     * Set the editor content
     */
    async setContent(content: string): Promise<void> {
        await this.updateState('current_editor_content', content);
    }

    /**
     * Get the last execution result
     */
    getLastExecutionResult(): WikiEditorExecutionResult | null {
        return this.state['last_execution_result'] as WikiEditorExecutionResult | null;
    }

    /**
     * Get the command history
     */
    getCommandHistory(): Array<{
        timestamp: Date;
        command: string;
        result: WikiEditorExecutionResult;
    }> {
        return this.state['command_history'] as Array<{
            timestamp: Date;
            command: string;
            result: WikiEditorExecutionResult;
        }> || [];
    }

    /**
     * Clear the command history
     */
    async clearCommandHistory(): Promise<void> {
        await this.updateState('command_history', []);
    }

    /**
     * Reset the editor content
     */
    async resetContent(): Promise<void> {
        await this.updateState('current_editor_content', '');
    }

    /**
     * Get the current content length
     */
    getContentLength(): number {
        return this.getContent().length;
    }

    /**
     * Get the number of lines in the content
     */
    getLineCount(): number {
        return this.getContent().split('\n').length;
    }

    /**
     * Get a preview of the content (first N characters)
     */
    getContentPreview(maxLength: number = 200): string {
        const content = this.getContent();
        if (content.length <= maxLength) {
            return content;
        }
        return content.substring(0, maxLength) + '...';
    }

    override render(): string {
        const content = this.getContent();
        const lastResult = this.getLastExecutionResult();
        const history = this.getCommandHistory();

        let output = `

Current Content:
---------------
${content || '(empty)'}

`;

        if (content) {
            output += `
Content Statistics:
-------------------
- Length: ${this.getContentLength()} characters
- Lines: ${this.getLineCount()}
- Preview: ${this.getContentPreview(100)}
`;
        }

        if (lastResult) {
            output += `
Last Execution Result:
----------------------
Status: ${lastResult.success ? '✓ Success' : '✗ Failed'}
Total Changes: ${lastResult.totalChanges}
`;
            if (lastResult.error) {
                output += `Error: ${lastResult.error}\n`;
            }
            if (lastResult.results.length > 0) {
                output += `Commands Executed: ${lastResult.results.length}\n`;
            }
        }

        if (history.length > 0) {
            output += `
Command History:
----------------
Total Commands: ${history.length}
Last Command: ${history[history.length - 1].timestamp.toISOString()}
`;
        }

        return output;
    }
}
