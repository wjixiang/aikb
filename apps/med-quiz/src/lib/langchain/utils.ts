// TODO: Deprecate this. Note mentions should be an object with title and path (optional).
// When user input `[[` the popup should show title and path for selection.
// The selected item has path to avoid duplicate titles. If user manually types
// the full title, path can still be missing. In that case title is used to retrieve

import { MemoryVariables } from '@langchain/core/memory';

// the note.
export function extractNoteTitles(query: unknown): string[] {
  // Ensure query is a string
  if (typeof query !== 'string') {
    return [];
  }

  // Use a regular expression to extract note titles wrapped in [[]]
  const regex = /\[\[(.*?)\]\]/g;
  const matches = query.match(regex);
  const uniqueTitles = new Set(
    matches ? matches.map((match) => match.slice(2, -2)) : [],
  );
  return Array.from(uniqueTitles);
}

/**
 * @deprecated File display title can be duplicated, so we should use file path
 * instead of title to find the note file.
 */
export async function getNoteFileFromTitle(noteTitle: string) {
  // Get all markdown files in the vault
  // const files = vault.getMarkdownFiles();

  // Iterate through all files to find a match by title
  // for (const file of files) {
  //   // Extract the title from the filename by removing the extension
  //   const title = file.basename;

  //   if (title === noteTitle) {
  //     // If a match is found, return the file path
  //     return file;
  //   }
  // }

  // If no match is found, return null
  return null;
}

export function extractChatHistory(
  memoryVariables: MemoryVariables,
): [string, string][] {
  const chatHistory: [string, string][] = [];
  const { history } = memoryVariables;

  for (let i = 0; i < history.length; i += 2) {
    const userMessage = history[i]?.content || '';
    const aiMessage = history[i + 1]?.content || '';
    chatHistory.push([userMessage, aiMessage]);
  }

  return chatHistory;
}
