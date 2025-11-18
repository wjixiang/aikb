import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { libraryItemVectorProto } from 'proto-ts';
import { Observable } from 'rxjs';

export class TestGrpcClient {
  private client: any;
  private packageDefinition: any;

  constructor() {
    // Load the proto file
    this.packageDefinition = protoLoader.loadSync(
      '/workspace/protos/libraryItemVector.proto',
      {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true,
      },
    );

    const protoDescriptor = grpc.loadPackageDefinition(this.packageDefinition);
    const libraryItemVectorService = protoDescriptor.libraryItemVector as any;

    // Create the gRPC client
    this.client = new libraryItemVectorService.LibraryItemVectorService(
      process.env['LIBRARYITEMVECTOR_SERVICE_GRPC_URL'] || 'localhost:50051',
      grpc.credentials.createInsecure(),
    );
  }

  createChunkEmbedGroup(
    request: libraryItemVectorProto.CreateChunkEmbedGroupRequest,
  ): Observable<libraryItemVectorProto.CreateChunkEmbedGroupResponse> {
    return new Observable<libraryItemVectorProto.CreateChunkEmbedGroupResponse>(
      (observer) => {
        this.client.createChunkEmbedGroup(
          request,
          (error: any, response: any) => {
            if (error) {
              observer.error(error);
            } else {
              // Convert snake_case response to camelCase to match TypeScript types
              const camelCaseResponse = this.convertSnakeToCamelCase(response);
              observer.next(camelCaseResponse);
              observer.complete();
            }
          },
        );
      },
    );
  }

  private convertSnakeToCamelCase(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.convertSnakeToCamelCase(item));
    }

    const result: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const camelKey = key.replace(/_([a-z])/g, (_, letter) =>
          letter.toUpperCase(),
        );
        result[camelKey] = this.convertSnakeToCamelCase(obj[key]);
      }
    }

    return result;
  }
}
