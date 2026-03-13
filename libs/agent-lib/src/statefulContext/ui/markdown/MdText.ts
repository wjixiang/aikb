/**
 * MdText - Text element for Markdown rendering
 */

import { MdElement } from './MdElement.js';
import type { ElementMetadata } from '../../types.js';

/**
 * Markdown text element (inline text)
 */
export class MdText extends MdElement {
    /**
     * Render the MdText element
     */
    render(): string {
        return this.metadata.content ?? '';
    }
}
