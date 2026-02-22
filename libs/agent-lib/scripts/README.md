# Agent Library Scripts

This directory contains standalone TypeScript scripts for testing and demonstrating agent-lib functionality.

## Article Retrieval Skill Script

The [`article-retrieval-skill.ts`](article-retrieval-skill.ts) script demonstrates the article-retrieval skill in action.

### Running the script

From the `libs/agent-lib` directory:

```bash
pnpm run run:article-retrieval
```

Or from the project root:

```bash
pnpm --filter agent-lib run run:article-retrieval
```

### What it does

1. Creates a MetaAnalysisWorkspace with all registered skills
2. Initializes an agent with observers for detailed logging
3. Sends a clinical research query about SGLT2 inhibitors and cardiovascular outcomes
4. Displays detailed information about the agent's execution including:
   - Conversation history
   - Token usage
   - Tool usage
   - Active skill information

### Environment variables

The script loads environment variables from `.env` file. Make sure to set up the required API keys and configuration before running.
