import { Client, Transport, type ClientGrpc } from '@nestjs/microservices';
import { Injectable } from '@nestjs/common';
import { Observable } from 'rxjs';
import { libraryItemVectorProto } from 'proto-ts';

@Injectable()
export class LibraryItemVectorGrpcClient {
  @Client({
    transport: Transport.GRPC,
    options: {
      package: 'libraryItemVector',
      protoPath: '/workspace/protos/libraryItemVector.proto',
      url: process.env['LIBRARYITEMVECTOR_SERVICE_GRPC_URL'] || 'localhost:50051',
    },
  })
  private client!: ClientGrpc;

  private libraryItemVectorServiceService!: libraryItemVectorProto.LibraryItemVectorServiceClient;

  onModuleInit() {
    this.libraryItemVectorServiceService =
      this.client.getService<libraryItemVectorProto.LibraryItemVectorServiceClient>(
        'LibraryItemVectorService',
      );
  }

  createChunkEmbedGroup(
    request: libraryItemVectorProto.CreateChunkEmbedGroupRequest,
  ): Observable<libraryItemVectorProto.CreateChunkEmbedGroupResponse> {
    return this.libraryItemVectorServiceService
      .createChunkEmbedGroup(request);
  }

  listChunkEmbedGroupMetadata(
    request: libraryItemVectorProto.ListItemChunkEmbedGroupMetadataRequest,
  ): Observable<libraryItemVectorProto.ListItemChunkEmbedGroupMetadataResponse> {
    return this.libraryItemVectorServiceService
      .listChunkEmbedGroupMetadata(request);
  }
}