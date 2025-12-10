import {
  mentionRegexGlobal,
  commandRegexGlobal,
  unescapeSpaces,
} from '../../shared/context-mentions';


import { t } from '../../i18n';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function getUrlErrorMessage(error: unknown): string {
  const errorMessage = getErrorMessage(error);

  // Check for common error patterns and return appropriate message
  if (errorMessage.includes('timeout')) {
    return t('common:errors.url_timeout');
  }
  if (errorMessage.includes('net::ERR_NAME_NOT_RESOLVED')) {
    return t('common:errors.url_not_found');
  }
  if (errorMessage.includes('net::ERR_INTERNET_DISCONNECTED')) {
    return t('common:errors.no_internet');
  }
  if (errorMessage.includes('net::ERR_ABORTED')) {
    return t('common:errors.url_request_aborted');
  }
  if (errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
    return t('common:errors.url_forbidden');
  }
  if (errorMessage.includes('404') || errorMessage.includes('Not Found')) {
    return t('common:errors.url_page_not_found');
  }

  // Default error message
  return t('common:errors.url_fetch_failed', { error: errorMessage });
}

export async function openMention(
  cwd: string,
  mention?: string,
): Promise<void> {
  if (!mention) {
    return;
  }

  // if (mention.startsWith('/')) {
  //   // Slice off the leading slash and unescape any spaces in the path
  //   const relPath = unescapeSpaces(mention.slice(1));
  //   const absPath = path.resolve(cwd, relPath);
  //   if (mention.endsWith('/')) {
  //     vscode.commands.executeCommand(
  //       'revealInExplorer',
  //       vscode.Uri.file(absPath),
  //     );
  //   } else {
  //     openFile(absPath);
  //   }
  // } else if (mention === 'problems') {
  //   vscode.commands.executeCommand('workbench.actions.view.problems');
  // } else if (mention === 'terminal') {
  //   vscode.commands.executeCommand('workbench.action.terminal.focus');
  // } else if (mention.startsWith('http')) {
  //   vscode.env.openExternal(vscode.Uri.parse(mention));
  // }
}

export async function parseMentions(
  text: string,
  // cwd: string,
  // urlContentFetcher: UrlContentFetcher,
  // fileContextTracker?: FileContextTracker,
  // rooIgnoreController?: RooIgnoreController,
  // showRooIgnoredFiles: boolean = false,
  // includeDiagnosticMessages: boolean = true,
  // maxDiagnosticMessages: number = 50,
  // maxReadFileLine?: number,
): Promise<string> {
  const mentions: Set<string> = new Set();
  // const validCommands: Map<string, Command> = new Map();

  // // First pass: check which command mentions exist and cache the results
  // const commandMatches = Array.from(text.matchAll(commandRegexGlobal));
  // const uniqueCommandNames = new Set(
  //   commandMatches.map(([, commandName]) => commandName),
  // );

  // const commandExistenceChecks = await Promise.all(
  //   Array.from(uniqueCommandNames).map(async (commandName) => {
  //     try {
  //       const command = await getCommand(cwd, commandName);
  //       return { commandName, command };
  //     } catch (error) {
  //       // If there's an error checking command existence, treat it as non-existent
  //       return { commandName, command: undefined };
  //     }
  //   }),
  // );

  // // Store valid commands for later use
  // for (const { commandName, command } of commandExistenceChecks) {
  //   if (command) {
  //     validCommands.set(commandName, command);
  //   }
  // }

  // Only replace text for commands that actually exist
  let parsedText = text;
  // for (const [match, commandName] of commandMatches) {
  //   if (validCommands.has(commandName)) {
  //     parsedText = parsedText.replace(
  //       match,
  //       `Command '${commandName}' (see below for command content)`,
  //     );
  //   }
  // }

  // Second pass: handle regular mentions
  parsedText = parsedText.replace(mentionRegexGlobal, (match, mention) => {
    mentions.add(mention);
    if (mention.startsWith('http')) {
      return `'${mention}' (see below for site content)`;
    } else if (mention.startsWith('/')) {
      const mentionPath = mention.slice(1);
      return mentionPath.endsWith('/')
        ? `'${mentionPath}' (see below for folder content)`
        : `'${mentionPath}' (see below for file content)`;
    } else if (mention === 'problems') {
      return `Workspace Problems (see below for diagnostics)`;
    } else if (mention === 'git-changes') {
      return `Working directory changes (see below for details)`;
    } else if (/^[a-f0-9]{7,40}$/.test(mention)) {
      return `Git commit '${mention}' (see below for commit info)`;
    } else if (mention === 'terminal') {
      return `Terminal Output (see below for output)`;
    }
    return match;
  });

  const urlMention = Array.from(mentions).find((mention) =>
    mention.startsWith('http'),
  );
  let launchBrowserError: Error | undefined;
  if (urlMention) {
    // try {
    //   await urlContentFetcher.launchBrowser();
    // } catch (error) {
    //   launchBrowserError = error;
    //   const errorMessage = getErrorMessage(error);
    //   vscode.window.showErrorMessage(
    //     `Error fetching content for ${urlMention}: ${errorMessage}`,
    //   );
    // }
  }

  for (const mention of mentions) {
    // if (mention.startsWith('http')) {
    //   let result: string;
    //   if (launchBrowserError) {
    //     const errorMessage =
    //       launchBrowserError instanceof Error
    //         ? launchBrowserError.message
    //         : String(launchBrowserError);
    //     result = `Error fetching content: ${errorMessage}`;
    //   } else {
    //     try {
    //       const markdown = await urlContentFetcher.urlToMarkdown(mention);
    //       result = markdown;
    //     } catch (error) {
    //       console.error(`Error fetching URL ${mention}:`, error);

    //       // Get raw error message for AI
    //       const rawErrorMessage = getErrorMessage(error);

    //       // Get localized error message for UI notification
    //       const localizedErrorMessage = getUrlErrorMessage(error);

    //       vscode.window.showErrorMessage(
    //         t('common:errors.url_fetch_error_with_url', {
    //           url: mention,
    //           error: localizedErrorMessage,
    //         }),
    //       );

    //       // Send raw error message to AI model
    //       result = `Error fetching content: ${rawErrorMessage}`;
    //     }
    //   }
    //   parsedText += `\n\n<url_content url="${mention}">\n${result}\n</url_content>`;
    // } else if (mention.startsWith('/')) {
    //   const mentionPath = mention.slice(1);
    //   try {
    //     const content = await getFileOrFolderContent(
    //       mentionPath,
    //       cwd,
    //       rooIgnoreController,
    //       showRooIgnoredFiles,
    //       maxReadFileLine,
    //     );
    //     if (mention.endsWith('/')) {
    //       parsedText += `\n\n<folder_content path="${mentionPath}">\n${content}\n</folder_content>`;
    //     } else {
    //       parsedText += `\n\n<file_content path="${mentionPath}">\n${content}\n</file_content>`;
    //       if (fileContextTracker) {
    //         await fileContextTracker.trackFileContext(
    //           mentionPath,
    //           'file_mentioned',
    //         );
    //       }
    //     }
    //   } catch (error) {
    //     if (mention.endsWith('/')) {
    //       parsedText += `\n\n<folder_content path="${mentionPath}">\nError fetching content: ${getErrorMessage(error)}\n</folder_content>`;
    //     } else {
    //       parsedText += `\n\n<file_content path="${mentionPath}">\nError fetching content: ${getErrorMessage(error)}\n</file_content>`;
    //     }
    //   }
    // } else if (mention === 'problems') {
    //   try {
    //     const problems = await getWorkspaceProblems(
    //       cwd,
    //       includeDiagnosticMessages,
    //       maxDiagnosticMessages,
    //     );
    //     parsedText += `\n\n<workspace_diagnostics>\n${problems}\n</workspace_diagnostics>`;
    //   } catch (error) {
    //     parsedText += `\n\n<workspace_diagnostics>\nError fetching diagnostics: ${getErrorMessage(error)}\n</workspace_diagnostics>`;
    //   }
    // } else if (mention === 'git-changes') {
    //   try {
    //     const workingState = await getWorkingState(cwd);
    //     parsedText += `\n\n<git_working_state>\n${workingState}\n</git_working_state>`;
    //   } catch (error) {
    //     parsedText += `\n\n<git_working_state>\nError fetching working state: ${getErrorMessage(error)}\n</git_working_state>`;
    //   }
    // } else if (/^[a-f0-9]{7,40}$/.test(mention)) {
    //   try {
    //     const commitInfo = await getCommitInfo(mention, cwd);
    //     parsedText += `\n\n<git_commit hash="${mention}">\n${commitInfo}\n</git_commit>`;
    //   } catch (error) {
    //     parsedText += `\n\n<git_commit hash="${mention}">\nError fetching commit info: ${getErrorMessage(error)}\n</git_commit>`;
    //   }
    // } else if (mention === 'terminal') {
    //   try {
    //     const terminalOutput = await getLatestTerminalOutput();
    //     parsedText += `\n\n<terminal_output>\n${terminalOutput}\n</terminal_output>`;
    //   } catch (error) {
    //     parsedText += `\n\n<terminal_output>\nError fetching terminal output: ${getErrorMessage(error)}\n</terminal_output>`;
    //   }
    // }
  }

  // Process valid command mentions using cached results
  // for (const [commandName, command] of validCommands) {
  //   try {
  //     let commandOutput = '';
  //     if (command.description) {
  //       commandOutput += `Description: ${command.description}\n\n`;
  //     }
  //     commandOutput += command.content;
  //     parsedText += `\n\n<command name="${commandName}">\n${commandOutput}\n</command>`;
  //   } catch (error) {
  //     parsedText += `\n\n<command name="${commandName}">\nError loading command '${commandName}': ${getErrorMessage(error)}\n</command>`;
  //   }
  // }

  if (urlMention) {
    // try {
    //   await urlContentFetcher.closeBrowser();
    // } catch (error) {
    //   console.error(`Error closing browser: ${getErrorMessage(error)}`);
    // }
  }

  return parsedText;
}


// Export processUserContentMentions from its own file
export { processUserContentMentions } from './processUserContentMentions';
