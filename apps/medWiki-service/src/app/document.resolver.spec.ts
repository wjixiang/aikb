import { Test, TestingModule } from '@nestjs/testing';
import { DocumentResolver } from './document.resolver';

describe('DocumentResolver', () => {
  let resolver: DocumentResolver;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DocumentResolver],
    }).compile();

    resolver = module.get<DocumentResolver>(DocumentResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });
});
