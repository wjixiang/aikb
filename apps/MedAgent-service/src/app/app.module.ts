import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { QueryResolver } from './query.resolver';
import { MutationResolver } from './mutation.resolver';
import { AgentLibModule } from 'agent-lib';

@Module({
  imports: [
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      playground: true,
      typePaths: ['/workspace/apps/MedAgent-service/graphql/**/*.graphql'],
    }),
    AgentLibModule
  ],
  controllers: [AppController],
  providers: [AppService, QueryResolver, MutationResolver],
})
export class AppModule { }
