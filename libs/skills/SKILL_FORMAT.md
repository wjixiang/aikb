# Skill Markdown Format Specification

## Frontmatter

Skills use YAML frontmatter to define metadata. The frontmatter must be at the beginning of the file, enclosed by `---`.

### Required Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `name` | string | Unique skill identifier (kebab-case) | `systematic-literature-review` |
| `version` | string | Semantic version | `1.0.0` |
| `description` | string | Brief description of the skill | `Conduct systematic literature reviews` |

### Optional Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `category` | string | Skill category | `medical-research` |
| `tags` | array | Tags for discovery | `[pubmed, review, analysis]` |

### Example

```yaml
---
name: systematic-literature-review
version: 1.0.0
description: Conduct systematic literature reviews using PubMed database following PRISMA guidelines
category: medical-research
tags: [pubmed, systematic-review, meta-analysis, literature]
---
```

## Body Structure

After the frontmatter, the skill body follows this structure:

### 1. Title (Required)

```markdown
# Skill Title
```

The title should be a human-readable version of the skill name.

### 2. Description (Optional)

A more detailed description can follow the title. If provided, this supplements the frontmatter description.

```markdown
Conduct systematic literature reviews using PubMed database following PRISMA guidelines.
```

### 3. Capabilities (Recommended)

List what the skill can do:

```markdown
## Capabilities

- Design and execute comprehensive search strategies
- Screen and filter articles based on criteria
- Extract key information from relevant articles
```

### 4. Work Direction (Recommended)

Step-by-step guide on how to use the skill:

```markdown
## Work Direction

When conducting a systematic review:

1. **Define Research Question**: Clarify the PICO framework
2. **Design Search Strategy**: Create comprehensive search terms
3. **Execute Search**: Use search_pubmed with appropriate filters
```

### 5. Required Tools (Optional)

List external tools the skill depends on:

```markdown
## Required Tools

- `search_pubmed`: Search PubMed database
- `view_article`: View article details
- `navigate_page`: Navigate result pages
```

### 6. Provided Tools (Optional)

Define new tools the skill provides:

```markdown
## Provided Tools

### design_search_strategy

Design a comprehensive PubMed search strategy.

**Parameters:**
- `research_question` (string, required): The research question
- `include_filters` (array, optional): Article types to include

**Returns:**
- `search_terms` (array): List of search term combinations
- `filters` (array): Recommended filters

**Implementation:**

\`\`\`typescript
async (params, context) => {
  // Implementation code
}
\`\`\`
```

### 7. Orchestration (Optional)

Define workflow orchestration logic:

```markdown
## Orchestration

Execute complete workflow.

**Parameters:**
- `research_question` (string, required): Research question

**Workflow:**

\`\`\`typescript
async (tools, params, context) => {
  // Orchestration code
}
\`\`\`
```

### 8. Helper Functions (Optional)

Internal utility functions:

```markdown
## Helper Functions

\`\`\`typescript
function extractPICO(question: string) {
  // Helper implementation
}
\`\`\`
```

### 9. Test Cases (Recommended)

Example test cases:

```markdown
## Test Cases

### Test Case 1: Basic Search

**Input:**
\`\`\`json
{
  "research_question": "What is the efficacy of metformin?"
}
\`\`\`

**Expected Output:**
\`\`\`json
{
  "status": "completed",
  "results": [...]
}
\`\`\`
```

### 10. Metadata (Optional)

Additional metadata:

```markdown
## Metadata

- **Author**: AI Knowledge Base Team
- **Created**: 2025-02-17
- **Last Updated**: 2025-02-17
- **Complexity**: High
- **Domain**: Medical Research
```

## Complete Example

```markdown
---
name: paper-analysis
version: 1.0.0
description: Advanced paper analysis utilities for academic research
category: analysis
tags: [paper, analysis, statistics]
---

# Paper Analysis

Advanced paper analysis utilities for academic research.

## Capabilities

- Calculate paper complexity scores
- Extract and rank key citations
- Compare papers side-by-side

## Work Direction

When analyzing papers:
1. Use `calculate_complexity` for metrics
2. Use `extract_key_citations` for references
3. Use `compare_papers` for comparisons

## Required Tools

- `preprocess_paper`: Preprocess paper content
- `assess_novelty`: Assess novelty

## Provided Tools

### calculate_complexity

Calculate paper complexity score.

**Parameters:**
- `paper_content` (string, required): Paper to analyze

**Returns:**
- `overall_score` (number): Complexity score (0-1)

**Implementation:**

\`\`\`typescript
async (params, context) => {
  const { paper_content } = params;
  // Implementation
  return { overall_score: 0.5 };
}
\`\`\`

## Test Cases

### Test Case 1: Calculate Complexity

**Input:**
\`\`\`json
{
  "paper_content": "Sample paper..."
}
\`\`\`

**Expected Output:**
\`\`\`json
{
  "overall_score": 0.5
}
\`\`\`

## Metadata

- **Author**: AI Knowledge Base Team
- **Created**: 2025-02-17
- **Complexity**: Medium
```

## Best Practices

### Frontmatter

1. **Use descriptive names**: Use kebab-case for skill names
2. **Write clear descriptions**: Keep frontmatter description concise (1-2 sentences)
3. **Version properly**: Follow semantic versioning (MAJOR.MINOR.PATCH)
4. **Tag appropriately**: Use relevant, searchable tags
5. **Categorize correctly**: Use consistent category names

### Body

1. **Be comprehensive**: Include all relevant sections
2. **Provide examples**: Always include test cases
3. **Document thoroughly**: Explain parameters and return values
4. **Use TypeScript**: Provide type-safe implementations
5. **Follow conventions**: Use consistent formatting

### Code

1. **Error handling**: Include try-catch blocks
2. **Validation**: Validate input parameters
3. **Comments**: Add inline comments for complex logic
4. **Modularity**: Use helper functions for reusability
5. **Testing**: Ensure test cases cover edge cases

## Validation

Skills should be validated for:

- ✅ Valid YAML frontmatter
- ✅ Required fields present (name, version, description)
- ✅ Valid semantic version
- ✅ Unique skill name
- ✅ Valid TypeScript code in implementations
- ✅ Test cases with valid JSON
- ✅ No syntax errors in markdown

## Tools

Use the provided tools to validate and format skills:

```bash
# Validate skill
skill-dev validate <skill-file>

# Format skill
skill-dev format <skill-file>

# Lint skill
skill-dev lint <skill-file>
```

## Migration

If you have skills without description in frontmatter:

```bash
# Auto-migrate skills to add description
skill-dev migrate --add-description ./repository/builtin/*.skill.md
```

Or manually:

1. Open the skill file
2. Add `description:` field to frontmatter
3. Copy the first paragraph after the title
4. Paste as the description value
5. Save the file

---

For more information, see [README.md](README.md) and [AUTO_DEV.md](AUTO_DEV.md).
