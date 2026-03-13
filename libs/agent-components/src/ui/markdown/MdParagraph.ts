/**
 * MdParagraph - Paragraph element for Markdown rendering
 */

import { MdElement } from './MdElement.js';
import type { ElementMetadata } from '../core/types.js';

/**
 * Markdown paragraph element
 */
export class MdParagraph extends MdElement {
    /**
     * Render the MdParagraph element
     */
    render(): string {
        const content = this.metadata.content ?? '';
        return content;
    }
}
