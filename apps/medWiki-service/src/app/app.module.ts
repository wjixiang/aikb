import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { AgentLibModule } from 'agent-lib';
import { AuthLibModule } from 'auth-lib';
import { AppService } from './app.service';

@Module({
  imports: [
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      playground: true,
      typePaths: ['/workspace/apps/medWiki-service/graphql/**/*.graphql'],
      context: ({ req }) => ({ req }), // Pass request to GraphQL context
    }),
    AgentLibModule,
    AuthLibModule,
  ],
  controllers: [],
  providers: [
    AppService,
  ],
})
export class AppModule { }
