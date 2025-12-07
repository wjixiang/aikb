import { Module } from '@nestjs/common';
import { LibraryItemController } from './library-item/library-item.controller';
import { LibraryItemService } from './library-item/library-item.service';
import { LibraryItemResolver } from './library-item/library-item.resolver';
import { S3ServiceProvider } from './s3/s3.provider';
import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { BibliographyGrpcController } from '../grpc/bibliography.grpc.controller';
import { BibliographyDBPrismaService } from 'bibliography-db';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { join } from 'path';
import {VectorModule} from 'bibliography-lib'

@Module({
  imports: [
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
    VectorModule
  ],
  controllers: [LibraryItemController, BibliographyGrpcController],
  providers: [LibraryItemService, LibraryItemResolver, S3ServiceProvider,BibliographyDBPrismaService],
})
export class AppModule {}
