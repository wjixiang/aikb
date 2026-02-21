import { describe, it, expect } from 'vitest';
import { VirtualWorkspace } from '../../statefulContext/virtualWorkspace.js';

describe("VirtualWorkspace Skills Rendering", () => {
    it('should render skills in workspace context', async () => {
        // Create a simple workspace
        const workspace = new VirtualWorkspace({
            id: 'test-workspace',
            name: 'Test Workspace',
            description: 'Test workspace for skill rendering'
        });

        // Get the available skills
        const availableSkills = workspace.getAvailableSkills();
        console.log('Available skills:', availableSkills);
        console.log('Number of skills:', availableSkills.length);

        // Verify skills are registered
        expect(availableSkills.length).toBeGreaterThan(0);

        // Render the workspace
        const rendered = await workspace.render();
        console.log('=== RENDERED WORKSPACE ===');
        console.log(rendered);
        console.log('=== END RENDERED WORKSPACE ===');

        // Verify skills section is present in the rendered output
        expect(rendered).toContain('SKILLS');
        expect(rendered).toContain('AVAILABLE SKILLS');

        // Verify at least one skill is shown
        const hasSkillName = availableSkills.some(skill => rendered.includes(skill.name));
        expect(hasSkillName).toBe(true);
    });
});
