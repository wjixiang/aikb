import type { Skill, SkillSummary } from '../../skills/types.js';

export interface SkillsUsageGuidanceOptions {
    availableSkills: SkillSummary[];
    activeSkill: Skill | null;
}

export function generateSkillsUsageGuidance(options: SkillsUsageGuidanceOptions): string {
    const { availableSkills, activeSkill } = options;

    if (availableSkills.length === 0) {
        return '';
    }

    const activeSkillSection = activeSkill ? `
✅ CURRENT ACTIVE SKILL: ${activeSkill.name} (${activeSkill.displayName})
This skill is currently enhancing your capabilities with specialized prompts and tools.
Use deactivate_skill when you no longer need this specialization.
` : '';

    return `
------------------------
Skills Usage Guidance
------------------------
You have access to specialized SKILLS that enhance your capabilities for specific task types.

🎯 WHEN TO USE SKILLS:
• Tasks requiring specialized domain expertise (e.g., literature search, data analysis, PICO extraction)
• Complex workflows that benefit from optimized prompts and toolsets
• Tasks that match skill descriptions or trigger keywords
• When you want to leverage task-specific guidance and best practices

📋 AVAILABLE SKILLS TOOLS:
- get_skill: Activate a skill by ID (use list_skills first to see options - ALWAYS use the Skill ID in backticks, NOT the display name)
- list_skills: List all available skills with descriptions
- deactivate_skill: Deactivate the current skill and return to default mode

⚙️ HOW SKILLS WORK:
1. Skills provide SPECIALIZED PROMPTS that enhance your understanding of specific task types
2. Skills may include CUSTOM TOOLS that are only available when the skill is active
3. Skills offer TASK-SPECIFIC GUIDANCE for optimal workflow execution
4. Activating a skill modifies your capabilities and available toolset

🔄 SKILL SWITCHING WORKFLOW:
Step 1: Use list_skills to see all available skills and their descriptions
Step 2: Identify skills that match your current task (check triggers and descriptions)
Step 3: Use get_skill with the Skill ID (the value in backticks, NOT the display name) to activate it
Step 4: The skill's specialized prompts and tools become available
Step 5: When the specialized task is complete, use deactivate_skill to return to default mode

💡 BEST PRACTICES:
• Review skill descriptions carefully before activation
• Skills are designed for specific phases - activate when appropriate
• Deactivate skills when their specialized phase is complete
• Multiple skills may be relevant - switch between them as the task evolves
• Check the "Active:" indicator in the SKILLS section to see current skill
• CRITICAL: When activating skills, ALWAYS use the Skill ID (shown in backticks), never the display name

${activeSkillSection}
ℹ️ NO SKILL ACTIVE: You are in default mode with general capabilities.
`;
}
