// bib-lib - Bibliography library
// ESM exports

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
