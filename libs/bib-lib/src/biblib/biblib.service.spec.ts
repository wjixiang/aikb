import { Test, TestingModule } from '@nestjs/testing';
import { BiblibService } from './biblib.service';

describe('BiblibService', () => {
  let service: BiblibService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BiblibService],
    }).compile();

    service = module.get<BiblibService>(BiblibService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
