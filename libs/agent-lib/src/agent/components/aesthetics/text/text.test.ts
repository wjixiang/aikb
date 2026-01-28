/**
 * Tests for TUI text elements (th, tp, ttext)
 */

import { describe, it, expect } from 'vitest';
import { th } from './th';
import { tp } from './tp';
import { ttext } from './ttext';

describe('th (Heading Element)', () => {
    it('should render a simple heading', () => {
        const heading = new th({
            content: 'Test Heading'
        });

        const result = heading.render();
        expect(result).toContain('Test Heading');
    });

    it('should render heading with underline', () => {
        const heading = new th({
            content: 'Test Heading',
            underline: true
        });

        const result = heading.render();
        expect(result).toContain('Test Heading');
        expect(result).toContain('─'.repeat('Test Heading'.length));
    });

    it('should render heading with bold text', () => {
        const heading = new th({
            content: 'Test Heading',
            textStyle: { bold: true }
        });

        const result = heading.render();
        expect(result).toContain('TEST HEADING');
    });

    it('should render heading with level', () => {
        const heading = new th({
            content: 'Test Heading',
            level: 2
        });

        const result = heading.render();
        expect(result).toContain('Test Heading');
    });

    it('should handle multi-line content', () => {
        const heading = new th({
            content: 'Line 1\nLine 2'
        });

        const result = heading.render();
        expect(result).toContain('Line 1');
        expect(result).toContain('Line 2');
    });
});

describe('tp (Paragraph Element)', () => {
    it('should render a simple paragraph', () => {
        const paragraph = new tp({
            content: 'This is a test paragraph.'
        });

        const result = paragraph.render();
        expect(result).toContain('This is a test paragraph.');
    });

    it('should render paragraph with indent', () => {
        const paragraph = new tp({
            content: 'Indented paragraph',
            indent: 4
        });

        const result = paragraph.render();
        expect(result).toContain('    Indented paragraph');
    });

    it('should render paragraph with bold text', () => {
        const paragraph = new tp({
            content: 'Bold paragraph',
            textStyle: { bold: true }
        });

        const result = paragraph.render();
        expect(result).toContain('BOLD PARAGRAPH');
    });

    it('should handle multi-line content', () => {
        const paragraph = new tp({
            content: 'Line 1\nLine 2\nLine 3'
        });

        const result = paragraph.render();
        expect(result).toContain('Line 1');
        expect(result).toContain('Line 2');
        expect(result).toContain('Line 3');
    });
});

describe('ttext (Styled Text Element)', () => {
    it('should render simple text', () => {
        const text = new ttext({
            content: 'Simple text'
        });

        const result = text.render();
        expect(result).toContain('Simple text');
    });

    it('should render bold text', () => {
        const text = new ttext({
            content: 'Bold text',
            bold: true
        });

        const result = text.render();
        expect(result).toContain('BOLD TEXT');
    });

    it('should render underlined text', () => {
        const text = new ttext({
            content: 'Underlined',
            underline: true
        });

        const result = text.render();
        expect(result).toContain('Underlined');
        expect(result).toContain('─────────');
    });

    it('should render strikethrough text', () => {
        const text = new ttext({
            content: 'Strikethrough',
            strikethrough: true
        });

        const result = text.render();
        expect(result).toContain('Strikethrough');
        expect(result).toContain('─────────────');
    });

    it('should handle multi-line content', () => {
        const text = new ttext({
            content: 'Line 1\nLine 2'
        });

        const result = text.render();
        expect(result).toContain('Line 1');
        expect(result).toContain('Line 2');
    });
});
