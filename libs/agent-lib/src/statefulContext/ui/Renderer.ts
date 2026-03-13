/**
 * Renderer Interface and Implementations
 * Provides abstraction for TUI and Markdown rendering modes
 */

import type { TUIElement } from './TUIElement.js';
import type { MdElement } from './markdown/MdElement.js';
import type { ElementMetadata, HeadingLevel, RenderMode } from '../types.js';
import { tdiv } from './tdiv.js';
import { th } from './text/th.js';
import { tp } from './text/tp.js';
import { ttext } from './text/ttext.js';
import { MdDiv } from './markdown/MdDiv.js';
import { MdHeading } from './markdown/MdHeading.js';
import { MdParagraph } from './markdown/MdParagraph.js';
import { MdText } from './markdown/MdText.js';

/**
 * Renderer Interface
 * Defines contract for creating UI elements in different rendering modes
 */
export interface IRenderer {
    /**
     * Create a container element
     */
    createContainer(metadata: ElementMetadata, children?: TUIElement[] | MdElement[]): TUIElement | MdElement;

    /**
     * Create a heading element
     */
    createHeading(metadata: { content?: string; level?: HeadingLevel }, depth?: number): TUIElement | MdElement;

    /**
     * Create a paragraph element
     */
    createParagraph(metadata: ElementMetadata): TUIElement | MdElement;

    /**
     * Create a text element
     */
    createText(metadata: ElementMetadata): TUIElement | MdElement;

    /**
     * Get the render mode
     */
    getMode(): RenderMode;
}

/**
 * TUI Renderer Implementation
 * Creates Terminal UI elements using ASCII box-drawing characters
 */
export class TUIRenderer implements IRenderer {
    createContainer(metadata: ElementMetadata, children?: TUIElement[]): tdiv {
        return new tdiv(metadata as any, children);
    }

    createHeading(metadata: { content?: string; level?: HeadingLevel }): th {
        return new th(metadata as any);
    }

    createParagraph(metadata: ElementMetadata): tp {
        return new tp(metadata as any);
    }

    createText(metadata: ElementMetadata): ttext {
        return new ttext(metadata as any);
    }

    getMode(): 'tui' {
        return 'tui';
    }
}

/**
 * Markdown Renderer Implementation
 * Creates Markdown elements for text-based rendering
 */
export class MarkdownRenderer implements IRenderer {
    private baseDepth: number;

    constructor(baseDepth: number = 0) {
        this.baseDepth = baseDepth;
    }

    createContainer(metadata: ElementMetadata, children?: MdElement[]): MdDiv {
        return new MdDiv(metadata, children, this.baseDepth);
    }

    createHeading(metadata: { content?: string; level?: HeadingLevel }, depth?: number): MdHeading {
        return new MdHeading(
            { content: metadata.content },
            undefined,
            (depth ?? 0) + this.baseDepth
        );
    }

    createParagraph(metadata: ElementMetadata): MdParagraph {
        return new MdParagraph(metadata, undefined, this.baseDepth);
    }

    createText(metadata: ElementMetadata): MdText {
        return new MdText(metadata, undefined, this.baseDepth);
    }

    getMode(): 'markdown' {
        return 'markdown';
    }
}
