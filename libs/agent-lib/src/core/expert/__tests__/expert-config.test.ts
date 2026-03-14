import { describe, it, expect, beforeEach, vi } from 'vitest';
import { sampleSOPContent } from './fixtures/mock-config';

describe('ExpertConfig', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('parseSOP', () => {
        const getSection = (content: string, name: string): string => {
            const pattern = new RegExp(`## ${name}[\\s\\S]*?(?=##|$)`, 'i');
            const match = content.match(pattern);
            return match ? match[0].replace(`## ${name}`, '').trim() : '';
        };

        it('should extract Overview section', () => {
            const overview = getSection(sampleSOPContent, 'Overview');
            expect(overview).toContain('test expert');
        });

        it('should extract Constraints section', () => {
            const constraints = getSection(sampleSOPContent, 'Constraints');
            expect(constraints).toContain('You MUST');
        });
    });

    describe('build prompts', () => {
        it('should build capability from overview and constraints', () => {
            const overview = 'Test overview';
            const constraints = 'You MUST complete';

            const capability = [
                overview,
                constraints ? `## Constraints\n${constraints}` : ''
            ].filter(Boolean).join('\n\n');

            expect(capability).toContain('Test overview');
            expect(capability).toContain('## Constraints');
        });

        it('should handle empty constraints', () => {
            const overview = 'Test overview';
            const constraints = '';

            const capability = [
                overview,
                constraints ? `## Constraints\n${constraints}` : ''
            ].filter(Boolean).join('\n\n');

            expect(capability).toBe('Test overview');
        });
    });
});
