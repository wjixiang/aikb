import { Test, TestingModule } from '@nestjs/testing';
import { EUtilitiesService } from './e-utilities.service';

describe('EUtilitiesService', () => {
  let service: EUtilitiesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EUtilitiesService],
    }).compile();

    service = module.get<EUtilitiesService>(EUtilitiesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
