import { describe, it, expect } from 'vitest';
import { BibService, createBibService, type BibliographyItem } from '../index';

describe('BibService', () => {
    it('should create a new BibService instance', () => {
        const service = createBibService();
        expect(service).toBeDefined();
        expect(service.getItems()).toEqual([]);
    });

    it('should add items to the service', () => {
        const service = createBibService();
        const item: BibliographyItem = {
            id: '1',
            title: 'Test Title',
            authors: ['Author One'],
            year: 2024,
        };

        service.addItem(item);
        expect(service.getItems()).toHaveLength(1);
        expect(service.getItems()[0].title).toBe('Test Title');
    });

    it('should find items by title', () => {
        const service = createBibService();
        const item1: BibliographyItem = {
            id: '1',
            title: 'Introduction to Testing',
            authors: ['Author One'],
            year: 2024,
        };
        const item2: BibliographyItem = {
            id: '2',
            title: 'Advanced TypeScript',
            authors: ['Author Two'],
            year: 2023,
        };

        service.addItem(item1);
        service.addItem(item2);

        const results = service.findByTitle('Testing');
        expect(results).toHaveLength(1);
        expect(results[0].id).toBe('1');
    });
});
