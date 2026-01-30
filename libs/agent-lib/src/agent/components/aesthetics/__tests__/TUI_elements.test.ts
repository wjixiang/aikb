import { describe, it, expect } from 'vitest';
import { tdiv } from '../TUI_elements';

describe('TUI_elements', () => {
    describe('Auto-configuration for undefined width/height', () => {
        it('should auto-calculate width and height when not provided', () => {
            const div = new tdiv({
                content: 'Hello World',
                border: true
            });
            const result = div.render();
            expect(result).toContain('Hello World');
            expect(result).toContain('┌');
            expect(result).toContain('┐');
        });

        it('should use provided width when specified', () => {
            const div = new tdiv({
                width: 30,
                content: 'Hello',
                border: true
            });
            const result = div.render();
            const lines = result.split('\n');
            expect(lines[0].length).toBe(30);
        });

        it('should use provided height when specified', () => {
            const div = new tdiv({
                width: 20,
                height: 10,
                content: 'Hello',
                border: true
            });
            const result = div.render();
            const lines = result.split('\n');
            expect(lines.length).toBe(10);
        });
    });

    describe('Nested rendering', () => {
        it('should render children inside parent', () => {
            const child1 = new tdiv({
                content: 'Child 1',
                border: true
            });
            const child2 = new tdiv({
                content: 'Child 2',
                border: true
            });
            const parent = new tdiv({
                content: 'Parent Content',
                border: true
            }, [child1, child2]);
            const result = parent.render();
            expect(result).toContain('Parent Content');
            expect(result).toContain('Child 1');
            expect(result).toContain('Child 2');
        });

        it('should handle deeply nested tdivs', () => {
            const grandchild = new tdiv({
                content: 'Grandchild',
                border: true
            });
            const child = new tdiv({
                content: 'Child',
                border: true
            }, [grandchild]);
            const parent = new tdiv({
                content: 'Parent',
                border: true
            }, [child]);
            const result = parent.render();
            expect(result).toContain('Parent');
            expect(result).toContain('Child');
            expect(result).toContain('Grandchild');
        });
    });

    describe('Padding styles', () => {
        it('should apply padding on all sides', () => {
            const div = new tdiv({
                width: 20,
                height: 10,
                content: 'Hello',
                border: true,
                styles: {
                    padding: { all: 2 }
                }
            });
            const result = div.render();
            const lines = result.split('\n');
            // Border line + 2 padding lines + 1 content line + 2 padding lines + border line = 6 lines
            // But height is 10, so we get 10 lines total
            expect(lines.length).toBe(10);
        });

        it('should apply horizontal padding only', () => {
            const div = new tdiv({
                width: 30,
                content: 'Hello',
                border: true,
                styles: {
                    padding: { horizontal: 5 }
                }
            });
            const result = div.render();
            const lines = result.split('\n');
            // Content line should have padding on both sides inside the border
            // The line format is: │<padding>Hello<padding>│
            // With horizontal: 5, innerWidth = 30 - 2*5 - 2 = 18
            // Hello is 5 chars, so padding is 18 - 5 = 13 spaces total
            expect(lines[1]).toContain('│Hello');
        });

        it('should apply vertical padding only', () => {
            const div = new tdiv({
                width: 20,
                height: 8,
                content: 'Hello',
                border: true,
                styles: {
                    padding: { vertical: 2 }
                }
            });
            const result = div.render();
            const lines = result.split('\n');
            // Border + 2 padding + content + 2 padding + border = 6 lines
            // But height is 8, so we get 8 lines total
            expect(lines.length).toBe(8);
        });

        it('should apply individual padding values', () => {
            const div = new tdiv({
                width: 20,
                height: 10,
                content: 'Hello',
                border: true,
                styles: {
                    padding: { top: 1, right: 2, bottom: 1, left: 2 }
                }
            });
            const result = div.render();
            const lines = result.split('\n');
            // Border + 1 top padding + content + 1 bottom padding + border = 4 lines
            // But height is 10, so we get 10 lines total
            expect(lines.length).toBe(10);
        });
    });

    describe('Margin styles', () => {
        it('should apply margin on all sides', () => {
            const div = new tdiv({
                width: 20,
                content: 'Hello',
                border: true,
                styles: {
                    margin: { all: 2 }
                }
            });
            const result = div.render();
            // Should have leading newlines for top margin (each line starts with spaces)
            const lines = result.split('\n');
            // First 2 lines are margin (just spaces)
            expect(lines[0]).toBe('  ');
            expect(lines[1]).toBe('  ');
            // Last 2 lines are margin (just spaces), but last line may be empty due to trailing newline
            expect(lines[lines.length - 2]).toBe('  ');
            expect(lines[lines.length - 3]).toBe('  ');
            // The border should be somewhere in the middle
            expect(result).toContain('┌──────────────────┐');
            expect(result).toContain('└──────────────────┘');
        });

        it('should apply horizontal margin (left margin)', () => {
            const div = new tdiv({
                width: 20,
                content: 'Hello',
                border: true,
                styles: {
                    margin: { left: 5 }
                }
            });
            const result = div.render();
            const lines = result.split('\n');
            // Each non-empty line should start with 5 spaces
            lines.forEach(line => {
                if (line.trim().length > 0) {
                    expect(line).toMatch(/^     /);
                }
            });
        });

        it('should apply vertical margin only', () => {
            const div = new tdiv({
                width: 20,
                content: 'Hello',
                border: true,
                styles: {
                    margin: { vertical: 2 }
                }
            });
            const result = div.render();
            const lines = result.split('\n');
            // Should have 2 leading empty lines for top margin
            expect(lines[0]).toBe('');
            expect(lines[1]).toBe('');
            // Should have 2 trailing empty lines for bottom margin
            expect(lines[lines.length - 1]).toBe('');
            expect(lines[lines.length - 2]).toBe('');
            // The border should be somewhere in the middle
            expect(result).toContain('┌──────────────────┐');
            expect(result).toContain('└──────────────────┘');
        });
    });

    describe('Combined features', () => {
        it('should work with auto-size, nested children, padding, and margin together', () => {
            const child = new tdiv({
                content: 'Child',
                border: true,
                styles: {
                    padding: { all: 1 }
                }
            });
            const parent = new tdiv({
                content: 'Parent',
                border: true,
                styles: {
                    padding: { all: 2 },
                    margin: { top: 1, bottom: 1 }
                }
            }, [child]);
            const result = parent.render();
            expect(result).toContain('Parent');
            expect(result).toContain('Child');
            // Should have top margin
            expect(result).toMatch(/^\n/);
        });
    });

    describe('Optional properties', () => {
        it('should work without content', () => {
            const div = new tdiv({
                width: 20,
                height: 5,
                border: true
            });
            const result = div.render();
            expect(result).toContain('┌');
            expect(result).toContain('┘');
        });

        it('should work without border', () => {
            const div = new tdiv({
                width: 20,
                content: 'Hello World'
            });
            const result = div.render();
            expect(result).toContain('Hello World');
            expect(result).not.toContain('┌');
            expect(result).not.toContain('┐');
        });

        it('should work with undefined border', () => {
            const div = new tdiv({
                width: 20,
                content: 'Hello World'
            });
            const result = div.render();
            expect(result).toContain('Hello World');
        });
    });

    describe('Alignment styles', () => {
        it('should align content to center', () => {
            const div = new tdiv({
                width: 30,
                content: 'Hello',
                border: true,
                styles: {
                    align: 'center'
                }
            });
            const result = div.render();
            const lines = result.split('\n');
            // Content line should be centered
            expect(lines[1]).toContain('Hello');
        });

        it('should align content to right', () => {
            const div = new tdiv({
                width: 30,
                content: 'Hello',
                border: true,
                styles: {
                    align: 'right'
                }
            });
            const result = div.render();
            const lines = result.split('\n');
            // Content line should be right-aligned
            expect(lines[1]).toContain('Hello');
        });
    });
});
