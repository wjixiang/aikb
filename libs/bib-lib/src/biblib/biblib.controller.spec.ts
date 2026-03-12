import { Test, TestingModule } from '@nestjs/testing';
import { BiblibController } from './biblib.controller';

describe('BiblibController', () => {
  let controller: BiblibController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BiblibController],
    }).compile();

    controller = module.get<BiblibController>(BiblibController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
