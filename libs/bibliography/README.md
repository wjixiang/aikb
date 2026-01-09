# bibliography

This library was generated with [Nx](https://nx.dev).

## Building

Run `nx build bibliography` to build the library.

## Running unit tests

Run `nx test bibliography` to execute the unit tests via [Vitest](https://vitest.dev/).

## NestJS Module Usage

This library provides a NestJS module for managing bibliography/library items.

### Installation

The library is a workspace dependency and should be available via `pnpm`.

### Module Registration

#### Synchronous Registration

```typescript
import { BibliographyModule } from 'bibliography';

@Module({
  imports: [
    BibliographyModule.register({
      prisma: prismaService,
      s3ServiceConfig: {
        accessKeyId: 'your-access-key',
        secretAccessKey: 'your-secret-key',
        bucketName: 'your-bucket',
        region: 'us-east-1',
        endpoint: 's3.amazonaws.com',
        forcePathStyle: true,
      },
    }),
  ],
})
export class AppModule {}
```

#### Asynchronous Registration

```typescript
import { BibliographyModule } from 'bibliography';

@Module({
  imports: [
    BibliographyModule.registerAsync({
      imports: [],
      inject: [BibliographyDBPrismaService, 'S3_SERVICE'],
      useFactory: (
        prismaService: BibliographyDBPrismaService,
        s3Service: S3Service,
      ) => ({
        prisma: prismaService,
        s3ServiceConfig: {
          accessKeyId: process.env.OSS_ACCESS_KEY_ID || '',
          secretAccessKey: process.env.OSS_SECRET_ACCESS_KEY || '',
          bucketName: process.env.PDF_OSS_BUCKET_NAME || '',
          region: process.env.OSS_REGION || '',
          endpoint: process.env.S3_ENDPOINT || '',
          forcePathStyle: true,
        },
      }),
    }),
  ],
})
export class AppModule {}
```

### Using LibraryService

Inject `LibraryService` into your services or controllers:

```typescript
import { Injectable } from '@nestjs/common';
import { LibraryService } from 'bibliography';

@Injectable()
export class MyService {
  constructor(private libraryService: LibraryService) {}

  async createItem() {
    return await this.libraryService.createItem({
      title: 'My Book',
      authors: [{ firstName: 'John', lastName: 'Doe' }],
    });
  }

  async getItem(id: string) {
    return await this.libraryService.getItem(id);
  }

  async searchItems(query: string) {
    return await this.libraryService.searchItems({ query });
  }
}
```

### Available Methods

The `LibraryService` provides the following methods:

- `createItem(metadata: Partial<ItemMetadata>): Promise<LibraryItem>` - Create a new library item
- `getItem(id: string): Promise<LibraryItem | null>` - Get a library item by ID
- `searchItems(filter: SearchFilter): Promise<LibraryItem[]>` - Search for library items
- `createCollection(name, description?, parentCollectionId?): Promise<Collection>` - Create a new collection
- `getCollections(): Promise<Collection[]>` - Get all collections
- `addItemToCollection(itemId, collectionId): Promise<void>` - Add item to collection
- `removeItemFromCollection(itemId, collectionId): Promise<void>` - Remove item from collection
- `generateCitation(itemId, style): Promise<Citation>` - Generate citation for an item
- `deleteItem(id): Promise<boolean>` - Delete a library item
- `deleteCollection(id): Promise<boolean>` - Delete a collection
- `deleteItemsInCollection(collectionId): Promise<number>` - Delete all items in a collection

### Accessing Storage

For direct access to storage methods (like `updateMetadata`, `getPdfDownloadUrl`), you can access the storage property:

```typescript
await this.libraryService.storage.updateMetadata(metadata);
const downloadUrl = await this.libraryService.storage.getPdfDownloadUrl(s3Key);
```
