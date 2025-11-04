import QuizStorage from '../QuizStorage';
import { connectToDatabase } from '../../db/mongodb';
import { ObjectId } from 'mongodb';
import { quizSelector } from '@/types/quizSelector.types';

async function main() {
  const selector: quizSelector = {
    cls: [],
    mode: [],
    quizNum: 0,
    unit: [],
    source: [],
    extractedYear: [],
    reviewMode: 'review',
    scoringWeights: {
      errorRate: 1,
      consecutiveWrong: 0,
      recency: 0,
    },
  };

  const storage = new QuizStorage();

  const res = await storage.getWrongQuizzes('wjixiang27@gmail.com', selector);
  console.log(res);
}

main();
