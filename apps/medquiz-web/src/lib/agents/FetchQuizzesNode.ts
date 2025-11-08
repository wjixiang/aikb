import { AgentNode, AgentStep } from './agent.types';
import { ChatMessage } from './agent.types';
import { QuizQueryService } from '../quiz/quiz_graph_query_service';

export class FetchQuizzesNode implements AgentNode {
  taskName = 'Fetch_Quizzes';
  private quizService: QuizQueryService;

  constructor(quizService: QuizQueryService) {
    this.quizService = quizService;
  }

  async *execute(
    state: ChatMessage[],
    query: string,
  ): AsyncGenerator<AgentStep> {
    try {
      const quizzes = await this.quizService.getQuizzesFromUserQuery(query);
      yield {
        type: 'result',
        content: 'Quizzes fetched successfully',
        task: this.taskName,
        // data: { quizzes }
      };
    } catch (error) {
      console.error('Error in FetchQuizzesNode:', error);
      yield {
        type: 'error',
        content: error instanceof Error ? error.message : 'Unknown error',
        task: this.taskName,
      };
    }
  }
}
