import { Test, TestingModule } from '@nestjs/testing';
import { ToolExecutionService } from './tool-execution.service';

describe('ToolExecutionService', () => {
  let service: ToolExecutionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ToolExecutionService],
    }).compile();

    service = module.get<ToolExecutionService>(ToolExecutionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
