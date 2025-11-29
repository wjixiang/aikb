import { Test, TestingModule } from '@nestjs/testing';
import { PropertyStorageService } from './property-storage.service';

describe('PropertyStorageService', () => {
  let service: PropertyStorageService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PropertyStorageService],
    }).compile();

    service = module.get<PropertyStorageService>(PropertyStorageService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
