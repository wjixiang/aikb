/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 */

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { SpelunkerModule } from 'nestjs-spelunker';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);
  const port = process.env.PORT || 3000;
  await app.listen(port);

    // 1. Generate the tree as text
  const tree = SpelunkerModule.explore(app);
  const root = SpelunkerModule.graph(tree);
  const edges = SpelunkerModule.findGraphEdges(root);
  const mermaidEdges = edges
    .filter( // I'm just filtering some extra Modules out
      ({ from, to }) =>
        !(
          from.module.name === 'ConfigHostModule' ||
          from.module.name === 'LoggerModule' ||
          to.module.name === 'ConfigHostModule' ||
          to.module.name === 'LoggerModule'
        ),
    )
    .map(({ from, to }) => `${from.module.name}-->${to.module.name}`);
  console.log(`graph TD\n\t${mermaidEdges.join('\n\t')}`);

  Logger.log(
    `🚀 Application is running on: http://localhost:${port}/${globalPrefix}`,
  );
}

bootstrap();
