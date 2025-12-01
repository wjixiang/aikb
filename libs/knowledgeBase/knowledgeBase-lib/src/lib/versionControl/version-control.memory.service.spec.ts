import { Test, TestingModule } from '@nestjs/testing';
import { VersionControlMemoryService } from './version-control.memory.service';

describe('VersionControlMemoryService', () => {
  let service: VersionControlMemoryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [VersionControlMemoryService],
    }).compile();

    service = module.get<VersionControlMemoryService>(
      VersionControlMemoryService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
