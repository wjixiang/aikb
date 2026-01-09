import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Library, ILibrary } from './library/library.js';
import { PrismaLibraryStorage } from './library/storage/prismaLibraryStorage.js';
import type { BibliographyModuleOptions } from './bibliography.interface.js';

@Injectable()
export class LibraryService implements ILibrary, OnModuleDestroy {
    private library: Library;

    constructor(options: BibliographyModuleOptions) {
        const storage = new PrismaLibraryStorage(
            options.prisma,
            options.s3ServiceConfig,
        );
        this.library = new Library(storage);
    }

    async createItem(metadata: any): Promise<any> {
        return await this.library.createItem(metadata);
    }

    async getItem(id: string): Promise<any> {
        return await this.library.getItem(id);
    }

    async searchItems(filter: any): Promise<any[]> {
        return await this.library.searchItems(filter);
    }

    async createCollection(
        name: string,
        description?: string,
        parentCollectionId?: string,
    ): Promise<any> {
        return await this.library.createCollection(name, description, parentCollectionId);
    }

    async getCollections(): Promise<any[]> {
        return await this.library.getCollections();
    }

    async addItemToCollection(itemId: string, collectionId: string): Promise<void> {
        return await this.library.addItemToCollection(itemId, collectionId);
    }

    async removeItemFromCollection(
        itemId: string,
        collectionId: string,
    ): Promise<void> {
        return await this.library.removeItemFromCollection(itemId, collectionId);
    }

    async generateCitation(itemId: string, style: string): Promise<any> {
        return await this.library.generateCitation(itemId, style);
    }

    async deleteItem(id: string): Promise<boolean> {
        return await this.library.deleteItem(id);
    }

    async deleteCollection(id: string): Promise<boolean> {
        return await this.library.deleteCollection(id);
    }

    async deleteItemsInCollection(collectionId: string): Promise<number> {
        return await this.library.deleteItemsInCollection(collectionId);
    }

    // Expose storage for direct access if needed
    get storage() {
        return (this.library as any).storage;
    }

    async onModuleDestroy(): Promise<void> {
        // Cleanup if needed
    }
}
