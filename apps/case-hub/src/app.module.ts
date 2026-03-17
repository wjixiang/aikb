import { Module, Controller, Get } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CasesModule } from './cases/cases.module.js';
import { GeneratorModule } from './generator/generator.module.js';
import { StorageModule } from './storage/storage.module.js';

@Controller('health')
class HealthController {
  @Get()
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'case-hub',
    };
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local'],
    }),
    StorageModule,
    CasesModule,
    GeneratorModule,
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
