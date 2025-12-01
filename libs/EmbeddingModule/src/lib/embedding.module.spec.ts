import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { EmbeddingModule } from './embedding.module';
import { EmbeddingService } from './services/embedding.service';
import { EmbeddingController } from './controllers/embedding.controller';

describe('EmbeddingModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [],
        }),
        EmbeddingModule,
      ],
    }).compile();
  });

  afterEach(async () => {
    await module.close();
  });

  it('should be defined', () => {
    expect(module).toBeDefined();
  });

  it('should provide EmbeddingService', () => {
    const service = module.get<EmbeddingService>(EmbeddingService);
    expect(service).toBeDefined();
    expect(service).toBeInstanceOf(EmbeddingService);
  });

  it('should provide EmbeddingController', () => {
    const controller = module.get<EmbeddingController>(EmbeddingController);
    expect(controller).toBeDefined();
    expect(controller).toBeInstanceOf(EmbeddingController);
  });

  it('should export EmbeddingService', () => {
    const moduleRef = module.get(EmbeddingModule);
    expect(moduleRef).toBeDefined();

    // Check if the service can be resolved from the module
    const service = module.get<EmbeddingService>(EmbeddingService);
    expect(service).toBeDefined();
  });
});
