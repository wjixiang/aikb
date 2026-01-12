import { Module } from '@nestjs/common';
import { LibraryItemController } from './library-item/library-item.controller';
import { LibraryItemService } from './library-item/library-item.service';
import { LibraryItemResolver } from './library-item/library-item.resolver';
import { S3Module } from './s3/s3.module';
import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { BibliographyGrpcController } from '../grpc/bibliography.grpc.controller';
import { BibliographyDBPrismaService, BibliographyDBModule } from 'bibliography-db';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { join } from 'path';
import { VectorModule } from 'bibliography-lib';
import { BibliographyModule } from 'bibliography';
import { S3Service } from '@aikb/s3-service';

@Module({
  imports: [
    BibliographyDBModule,
    S3Module,
    RabbitMQModule.forRoot({
      exchanges: [
        {
          name: 'library',
          type: 'topic',
        },
      ],
      uri: `amqp://${process.env['RABBITMQ_USERNAME']}:${process.env['RABBITMQ_PASSWORD']}@${process.env['RABBITMQ_HOSTNAME']}:${process.env['RABBITMQ_AMQP_PORT']}/${process.env['RABBITMQ_VHOST']}`,
      connectionInitOptions: {
        timeout: 30000,
      },
    }),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      playground: true,
      typePaths: ['/workspace/apps/bibliography-service/graphql/**/*.graphql'],
      // definitions: {
      //   path: '/workspace/apps/bibliography-service/src/graphql.ts',
      // },
    }),
    VectorModule,
    BibliographyModule.registerAsync({
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
  controllers: [LibraryItemController, BibliographyGrpcController],
  providers: [
    LibraryItemService,
    LibraryItemResolver,
  ],
})
export class AppModule { }
