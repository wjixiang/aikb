/**
 * Base class for all Markdown elements
 */

import type { ElementMetadata } from '../core/types.js';

/**
 * Abstract base class for all Markdown elements
 */
export abstract class MdElement {
    protected metadata: ElementMetadata;
    protected children: MdElement[];
    protected depth: number;

    constructor(metadata?: ElementMetadata, children?: MdElement[], depth?: number) {
        this.metadata = metadata || {};
        this.children = children || [];
        this.depth = depth ?? 0;
    }

    /**
     * Render the element to a markdown string
     */
    abstract render(): string;

    /**
     * Add a child element
     */
    addChild(child: MdElement): void {
        this.children.push(child);
    }

    /**
     * Get children elements
     */
    getChildren(): MdElement[] {
        return this.children;
    }

    /**
     * Get the depth level for heading calculation
     */
    getDepth(): number {
        return this.depth;
    }
}
