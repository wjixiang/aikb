import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { QueryResolver } from './query.resolver';
import { MutationResolver } from './mutation.resolver';
import { AgentLibModule } from 'agent-lib';
import { AuthLibModule } from 'auth-lib';

@Module({
  imports: [
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      playground: true,
      typePaths: ['/workspace/apps/MedAgent-service/graphql/**/*.graphql'],
      context: ({ req }) => ({ req }), // Pass request to GraphQL context
    }),
    AgentLibModule,
    AuthLibModule
  ],
  controllers: [AppController],
  providers: [AppService, QueryResolver, MutationResolver],
})
export class AppModule { }
