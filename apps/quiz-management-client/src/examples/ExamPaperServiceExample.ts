import { ExamPaperService } from '../services/ExamPaperService';
import { QuizProcessingService } from '../services/QuizProcessingService';
import { quesiton } from '../varible';
import { answer } from '../varible_answer';

/**
 * 试卷服务示例
 * 演示如何使用新的服务层来管理试卷和处理数据
 */
async function examPaperServiceExample() {
  console.log('=== 试卷服务层示例 ===\n');
  
  // 创建服务实例
  const examPaperService = new ExamPaperService();
  const processingService = new QuizProcessingService();
  
  try {
    // 1. 创建试卷
    console.log('1. 创建试卷...');
    const examPaper = await examPaperService.createExamPaperFromText(
      '2026ljy模考一',
      quesiton,
      answer,
      '2026ljy模考一',
      {
        year: '2026',
        tags: ['2026', '模考'],
        subject: '综合',
        metadata: {
          difficulty: 'medium',
          duration: '120分钟'
        }
      }
    );
    
    console.log(`✓ 试卷创建成功，ID: ${examPaper.id}`);
    console.log(`  标题: ${examPaper.title}`);
    console.log(`  来源: ${examPaper.source}`);
    console.log(`  标签: ${examPaper.tags.join(', ')}\n`);
    
    // 2. 列出所有试卷
    console.log('2. 列出所有试卷...');
    const allPapers = await examPaperService.listExamPapers();
    console.log(`✓ 共找到 ${allPapers.length} 个试卷:`);
    allPapers.forEach(paper => {
      console.log(`  - ${paper.title} (${paper.id}) - ${paper.source}`);
    });
    console.log();
    
    // 3. 处理试卷
    console.log('3. 处理试卷...');
    const processResult = await examPaperService.processExamPaper(examPaper.id, {
      source: '2026ljy模考一',
      tags: ['2026', '模考'],
      class: '综合',
      unit: '第一单元'
    });
    
    console.log(`✓ 试卷处理完成:`);
    console.log(`  成功: ${processResult.successCount} 道题`);
    console.log(`  失败: ${processResult.failureCount} 道题`);
    
    if (processResult.errors && processResult.errors.length > 0) {
      console.log('  错误信息:');
      processResult.errors.forEach(error => console.log(`    - ${error}`));
    }
    console.log();
    
    // 4. 搜索试卷
    console.log('4. 搜索试卷...');
    const searchResults = await examPaperService.searchExamPapers({
      source: '2026ljy模考一',
      tags: ['2026']
    });
    
    console.log(`✓ 搜索结果: ${searchResults.length} 个试卷`);
    searchResults.forEach(paper => {
      console.log(`  - ${paper.title} (${paper.year}) - ${paper.subject}`);
    });
    console.log();
    
    // 5. 处理并发送到服务器（可选）
    console.log('5. 处理并发送题目到服务器...');
    console.log('注意: 这将尝试发送到配置的服务器地址');
    
    const sendResult = await processingService.processAndSendQuizzes(
      processResult.quizzes.slice(0, 5), // 只发送前5题作为示例
      {
        maxRetries: 2,
        concurrency: 2,
        onProgress: (processed, total, current) => {
          console.log(`  进度: ${processed}/${total} (成功: ${current.successCount}, 失败: ${current.failureCount})`);
        }
      }
    );
    
    console.log(`✓ 发送完成:`);
    console.log(`  成功: ${sendResult.successCount} 道题`);
    console.log(`  失败: ${sendResult.failureCount} 道题`);
    
    if (sendResult.failureCount > 0) {
      console.log('  提示: 可以使用 --retry-failed 参数重试失败的题目');
    }
    
  } catch (error) {
    console.error('❌ 示例执行失败:', error);
  }
}

/**
 * 演示失败重试功能
 */
async function retryFailedExample() {
  console.log('\n=== 失败重试示例 ===\n');
  
  const processingService = new QuizProcessingService();
  
  // 检查失败数量
  const failedCount = processingService.getFailedQuizzesCount();
  console.log(`当前失败题目数量: ${failedCount}`);
  
  if (failedCount > 0) {
    console.log('正在重试失败的题目...');
    const retryCount = await processingService.retryFailedQuizzes(2, 500);
    console.log(`✓ 成功重试 ${retryCount} 道题`);
  } else {
    console.log('没有失败的题目需要重试');
  }
}

/**
 * 演示试卷管理功能
 */
async function examPaperManagementExample() {
  console.log('\n=== 试卷管理示例 ===\n');
  
  const examPaperService = new ExamPaperService();
  
  try {
    // 列出所有试卷
    const papers = await examPaperService.listExamPapers();
    console.log(`当前共有 ${papers.length} 个试卷:`);
    
    if (papers.length > 0) {
      // 显示第一个试卷的详细信息
      const firstPaper = papers[0];
      console.log(`\n试卷详情:`);
      console.log(`  ID: ${firstPaper.id}`);
      console.log(`  标题: ${firstPaper.title}`);
      console.log(`  来源: ${firstPaper.source}`);
      console.log(`  年份: ${firstPaper.year || '未设置'}`);
      console.log(`  科目: ${firstPaper.subject || '未设置'}`);
      console.log(`  标签: ${firstPaper.tags.join(', ')}`);
      console.log(`  创建时间: ${firstPaper.createdAt.toLocaleString()}`);
      console.log(`  更新时间: ${firstPaper.updatedAt.toLocaleString()}`);
      console.log(`  问题文本长度: ${firstPaper.questionsText.length} 字符`);
      console.log(`  答案文本长度: ${firstPaper.answersText.length} 字符`);
      
      // 更新试卷
      console.log(`\n更新试卷信息...`);
      const updatedPaper = await examPaperService.updateExamPaper(firstPaper.id, {
        tags: [...firstPaper.tags, '已处理'],
        metadata: {
          ...firstPaper.metadata,
          lastProcessed: new Date().toISOString()
        }
      });
      
      console.log(`✓ 试卷更新成功，新标签: ${updatedPaper.tags.join(', ')}`);
    }
  } catch (error) {
    console.error('❌ 试卷管理示例执行失败:', error);
  }
}

// 运行示例
async function runExamples() {
  await examPaperServiceExample();
  await retryFailedExample();
  await examPaperManagementExample();
  
  console.log('\n=== 示例完成 ===');
  console.log('您可以使用以下命令来运行CLI:');
  console.log('  npm run quiz:cli -- --use-service                    # 使用服务层模式');
  console.log('  npm run quiz:cli -- --use-service --chunks 3        # 使用服务层模式并分块处理');
  console.log('  npm run quiz:cli -- --retry-failed                  # 重试失败的题目');
  console.log('  npm run quiz:cli -- --check-failed                  # 检查失败题目数量');
}

// 如果直接运行此文件，则执行示例
if (require.main === module) {
  runExamples().catch(console.error);
}

export {
  examPaperServiceExample,
  retryFailedExample,
  examPaperManagementExample
};