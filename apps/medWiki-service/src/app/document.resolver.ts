import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { EntityWhereInput, Entity, CreateDocumentInput, UpdateDocumentInput } from '../graphql';
import { DocumentService } from './document.service';

@Resolver('document')
export class DocumentResolver {
    constructor(
        private documentService: DocumentService
    ) { }

    @Mutation()
    async createDocument(@Args('input') input: CreateDocumentInput) {
        return await this.documentService.createDocument(input)
    }

    @Mutation()
    async updateDocument(@Args('input') input: UpdateDocumentInput) {
        return await this.documentService.updateDocument(input)
    }
}
