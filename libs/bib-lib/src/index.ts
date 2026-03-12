// bib-lib - Bibliography library
// ESM exports

export * from './prisma/prisma.module';
export * from './prisma/prisma.service';
export * from './sync/sync.module';
export * from './sync/sync.service';
export * from './sync/parsers/types';
export * from './sync/embed/embed.module';
export * from './sync/embed/embed.service';

export interface BibliographyItem {
    id: string;
    title: string;
    authors: string[];
    year?: number;
    journal?: string;
    doi?: string;
}

export class BibService {
    private items: BibliographyItem[] = [];

    addItem(item: BibliographyItem): void {
        this.items.push(item);
    }

    getItems(): BibliographyItem[] {
        return [...this.items];
    }

    findByTitle(title: string): BibliographyItem[] {
        return this.items.filter(item =>
            item.title.toLowerCase().includes(title.toLowerCase())
        );
    }
}

export function createBibService(): BibService {
    return new BibService();
}
