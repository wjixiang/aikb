/**
 * MdDiv - Container element for Markdown rendering
 */

import { MdElement } from './MdElement.js';
import type { ElementMetadata } from '../core/types.js';

/**
 * Markdown container element (div-like)
 */
export class MdDiv extends MdElement {
    constructor(metadata?: ElementMetadata, children?: MdElement[], depth?: number) {
        super(metadata, children, depth);
    }

    /**
     * Render the MdDiv element
     */
    render(): string {
        const content = this.metadata.content ?? '';
        const childRenders = this.children.map(c => c.render()).join('\n\n');

        // Use horizontal rule for containers with borders
        const prefix = this.metadata.styles?.showBorder
            ? '\n---\n\n'
            : '';

        const result = [content, childRenders].filter(Boolean).join('\n\n');

        return prefix + result;
    }
}
