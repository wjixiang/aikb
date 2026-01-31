# Agent Demo Script

This script demonstrates the functionality of `Agent` with `KmsWorkspace`.

## Running the Demo

```bash
npx tsx scripts/demo-agent.ts
```

## What the Demo Does

1. **Creates KmsWorkspace** - Instantiates a workspace with 3 components:
   - `book_viewer` - For viewing and searching book content
   - `workspace_info` - Displays workspace information
   - `knowledge_explorer` - For managing knowledge base documents

2. **Displays Workspace Information**:
   - Component list
   - Workspace context (rendered output)
   - Statistics (component count, states, etc.)
   - Available tools (`execute_script`, `attempt_completion`)

3. **Creates Agent Instance**:
   - Uses real AI configuration (zai provider with glm-4.7 model)
   - Sets up observers for message/status events
   - Displays script execution guide

4. **Shows Script Execution Guide**:
   - Available tools
   - Available states from all components
   - Example usage patterns

## Running with Real AI

To actually run the agent with real AI calls:

1. **Set the API key**:

   ```bash
   export GLM_API_KEY=your-api-key-here
   ```

2. **Uncomment the agent.start() call** in `scripts/demo-agent.ts`:

   ```typescript
   // Uncomment this section (around line 136-141)
   try {
     await agent.start('Search for information about medical terminology');
     console.log('Agent completed successfully');
   } catch (error) {
     console.error('Agent failed:', error);
   }
   ```

3. **Run the script**:
   ```bash
   npx tsx scripts/demo-agent.ts
   ```

## Important Notes

- **API Calls**: When `agent.start()` is uncommented, the agent will make actual API calls to the LLM service
- **Hanging**: The agent may hang if:
  - No valid API key is provided
  - Network connectivity issues
  - API service is down
- **Quota**: Running with real AI will consume API quota
- **Timeout**: The default timeout is 60 seconds (configurable via `apiRequestTimeout`)

## Demo Output

The demo shows:

- Workspace initialization
- Component registration
- State management
- Tool availability
- Observer registration
- Script execution guide

## Example Agent Workflow

When running with real AI, the agent will:

1. Receive a user query
2. Render workspace context
3. Send API request to LLM
4. Receive tool use instructions from LLM
5. Execute scripts to modify workspace states
6. Repeat until `attempt_completion` is called

## Troubleshooting

### Agent hangs after starting

This usually means the API call is waiting for response. Check:

- API key is valid and set
- Network connectivity
- API service is operational

### Connection errors for bibliography/wiki services

These are expected if services aren't running. The demo focuses on agent/workspace instantiation, not external service connections.

### Apollo cache warnings

`canonizeResults is deprecated` warnings can be ignored - they're from Apollo Client and don't affect functionality.
