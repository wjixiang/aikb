import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { QueryResolver } from './query.resolver';
import { MutationResolver } from './mutation.resolver';
import { MessageContentResolver } from './message-content.resolver';
import { ContentBlockResolver } from './content-block.resolver';
import { AgentLibModule } from 'agent-lib';
import { AuthLibModule } from 'auth-lib';
import { AppService } from './app.service';

@Module({
  imports: [
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      playground: true,
      typePaths: ['/workspace/apps/MedAgent-service/graphql/**/*.graphql'],
      context: ({ req }) => ({ req }), // Pass request to GraphQL context
    }),
    AgentLibModule,
    AuthLibModule,
  ],
  controllers: [],
  providers: [
    QueryResolver,
    MutationResolver,
    MessageContentResolver,
    ContentBlockResolver,
    AppService,
  ],
})
export class AppModule { }
