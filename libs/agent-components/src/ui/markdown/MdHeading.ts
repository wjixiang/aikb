/**
 * MdHeading - Heading element for Markdown rendering
 */

import { MdElement } from './MdElement.js';
import type { ElementMetadata } from '../core/types.js';

/**
 * Markdown heading element
 */
export class MdHeading extends MdElement {
    /**
     * Render the MdHeading element
     */
    render(): string {
        const content = this.metadata.content ?? '';
        // Calculate heading level from depth (base 1, max 6)
        const level = Math.min(this.depth + 1, 6);
        const hashes = '#'.repeat(level);

        return `${hashes} ${content}`;
    }
}
