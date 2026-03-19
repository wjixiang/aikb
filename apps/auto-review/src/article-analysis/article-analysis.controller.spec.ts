import { Test, TestingModule } from '@nestjs/testing';
import { ArticleAnalysisController } from './article-analysis.controller';

describe('ArticleAnalysisController', () => {
  let controller: ArticleAnalysisController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ArticleAnalysisController],
    }).compile();

    controller = module.get<ArticleAnalysisController>(ArticleAnalysisController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
