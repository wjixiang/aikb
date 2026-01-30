import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { AgentLibModule } from 'agent-lib';
import { AuthLibModule } from 'auth-lib';
import { TaskResolver } from './task.resolver';
import { TaskService } from './task.service';

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
    TaskResolver,
    TaskService,
  ],
})
export class AppModule { }
