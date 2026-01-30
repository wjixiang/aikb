import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { EntityWhereInput, Entity, CreateDocumentInput, UpdateDocumentInput, DeleteDocumentInput, DocumentWhereInput, Document } from '../graphql';
import { DocumentService } from './document.service';

@Resolver('document')
export class DocumentResolver {
    constructor(
        private documentService: DocumentService
    ) { }

    /**
     * Get all documents based on filter criteria
     * @param where - The filter criteria to match documents
     * @returns Array of matching documents
     */
    @Query()
    async documents(@Args('where') where: DocumentWhereInput): Promise<Document[]> {
        return await this.documentService.getDocuments(where);
    }

    /**
     * Get a single document based on filter criteria
     * @param where - The filter criteria to match documents
     * @returns The first matching document or null if no match found
     */
    @Query()
    async document(@Args('where') where: DocumentWhereInput): Promise<Document | null> {
        return await this.documentService.getDocument(where);
    }

    @Mutation()
    async createDocument(@Args('input') input: CreateDocumentInput) {
        return await this.documentService.createDocument(input)
    }

    @Mutation()
    async updateDocument(@Args('input') input: UpdateDocumentInput) {
        return await this.documentService.updateDocument(input)
    }

    @Mutation()
    async deleteDocument(@Args('input') input: DeleteDocumentInput) {
        return await this.documentService.deleteDocument(input)
    }
}
