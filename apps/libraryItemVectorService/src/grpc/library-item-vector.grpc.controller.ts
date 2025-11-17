// import { Controller } from '@nestjs/common';
// import { GrpcMethod } from '@nestjs/microservices';
// import { LibraryItemVectorService } from '../app/library-item-vector/library-item-vector.service';

// @Controller()
// export class LibraryItemVectorController {
//   constructor(private readonly libraryItemVectorService: LibraryItemVectorService) {}

//   @GrpcMethod('LibraryItemVectorService', 'GenerateEmbedding')
//   async generateEmbedding(request: any): Promise<any> {
//     return await this.libraryItemVectorService.generateEmbedding(request);
//   }

//   @GrpcMethod('LibraryItemVectorService', 'StoreEmbedding')
//   async storeEmbedding(request: any): Promise<any> {
//     return await this.libraryItemVectorService.storeEmbedding(request);
//   }

//   @GrpcMethod('LibraryItemVectorService', 'SearchSimilarItems')
//   async searchSimilarItems(request: any): Promise<any> {
//     return await this.libraryItemVectorService.searchSimilarItems(request);
//   }

//   @GrpcMethod('LibraryItemVectorService', 'DeleteEmbedding')
//   async deleteEmbedding(request: any): Promise<any> {
//     return await this.libraryItemVectorService.deleteEmbedding(request);
//   }

//   @GrpcMethod('LibraryItemVectorService', 'UpdateEmbedding')
//   async updateEmbedding(request: any): Promise<any> {
//     return await this.libraryItemVectorService.updateEmbedding(request);
//   }

//   @GrpcMethod('LibraryItemVectorService', 'GetEmbedding')
//   async getEmbedding(request: any): Promise<any> {
//     return await this.libraryItemVectorService.getEmbedding(request);
//   }

//   @GrpcMethod('LibraryItemVectorService', 'BatchGenerateEmbeddings')
//   async batchGenerateEmbeddings(request: any): Promise<any> {
//     return await this.libraryItemVectorService.batchGenerateEmbeddings(request);
//   }
// }