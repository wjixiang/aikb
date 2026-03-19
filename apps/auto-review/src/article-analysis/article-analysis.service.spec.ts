import { Test, TestingModule } from '@nestjs/testing';
import { ArticleAnalysisService } from './article-analysis.service';

describe('ArticleAnalysisService', () => {
  let service: ArticleAnalysisService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ArticleAnalysisService],
    }).compile();

    service = module.get<ArticleAnalysisService>(ArticleAnalysisService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
