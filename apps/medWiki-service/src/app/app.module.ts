import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
// import { AgentLibModule } from 'agent-lib';
// import { AuthLibModule } from 'auth-lib';
import { EntityResolver } from './entity.resolver';
import { EntityService, WIKI_PRISMA_SERVICE_TOKEN } from './entity.service';
import { wikiPrismaService } from 'wiki-db';

@Module({
  imports: [
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      playground: true,
      typePaths: ['/workspace/apps/medWiki-service/graphql/**/*.graphql'],
      context: ({ req }) => ({ req }), // Pass request to GraphQL context
    }),
    // AgentLibModule,
    // AuthLibModule,
  ],
  controllers: [],
  providers: [
    EntityResolver,
    EntityService,
    {
      provide: WIKI_PRISMA_SERVICE_TOKEN,
      useClass: wikiPrismaService,
    }
  ],
})
export class AppModule { }
